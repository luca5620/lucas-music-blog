import { createClient } from "@/lib/supabase/server";
import { getBlockedIds } from "@/lib/db/moderation";

/**
 * Notifications data helpers (migrations 025 + 052).
 *
 * Everything runs with the CALLER's session. Reads go through RLS
 * (only the recipient can read/update their rows). Writes go through
 * two SECURITY DEFINER functions from migration 052 — notify_user() and
 * notify_followers() — instead of plain inserts, because the rules
 * that matter for writing can't be checked from the actor's session:
 *
 *  - "Have I already told them about this?" The actor can't SELECT a
 *    notification it wrote (025's select policy is recipient-only), so
 *    the old check-then-insert dedup ALWAYS found nothing and every
 *    like/unlike loop re-rang the bell and re-buzzed the phone. 052
 *    adds a partial UNIQUE index and the functions insert with ON
 *    CONFLICT DO NOTHING — a repeat is skipped by the database itself.
 *    The push trigger (032) only fires for rows actually inserted, so
 *    a skipped repeat sends no push either.
 *  - "Has either of us blocked the other?" The actor can't read the
 *    recipient's block list. The functions can, and silently skip.
 *  - The ACTOR is always auth.uid() inside the function — never a
 *    parameter — so nobody can send a notification "from" someone else.
 *
 * createNotification / notifyFollowers are BEST-EFFORT everywhere
 * they're called: the like/follow/comment succeeded already, and a
 * notification hiccup must never surface as an action failure. They
 * swallow their own errors.
 *
 * Before migration 052 runs, the functions don't exist; the helpers
 * then fall back to the old direct insert (025's insert policy still
 * allows it), so a deploy that beats the migration loses dedup and
 * block-filtering for a few minutes, not notifications.
 */

export type NotificationType =
  | "follow"
  | "review_like"
  | "comment"
  | "comment_reply"
  | "post_like"
  | "list_like"
  // Follow-feed (033): someone you follow made a thing.
  | "new_review"
  | "new_post"
  | "new_list"
  | "new_debate"
  // Aux Wars (042): someone you follow is hosting a room.
  | "new_aux"
  // Aux Wars (045): a friend pulled you into their room.
  | "aux_invite";

/** The things the CREATE tab makes — the only types that fan out. */
export type FollowFeedType =
  | "new_review"
  | "new_post"
  | "new_list"
  | "new_debate"
  | "new_aux";

/** Everything else: one actor → one recipient. */
export type DirectNotificationType = Exclude<NotificationType, FollowFeedType>;

export interface NotificationRow {
  id: string;
  user_id: string;
  actor_id: string;
  type: NotificationType;
  href: string;
  title: string | null;
  read: boolean;
  created_at: string;
  actor: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

/**
 * One notification to one person — "X liked your review".
 *
 * Dedup + block rules live in the database (see the file header):
 * calling this twice for the same like is harmless, and calling it
 * across a block quietly does nothing.
 */
export async function createNotification(input: {
  recipientId: string;
  actorId: string;
  type: DirectNotificationType;
  href: string;
  title?: string | null;
}): Promise<void> {
  const { recipientId, actorId, type, href, title } = input;
  // Self-actions never notify (the function would skip it anyway —
  // this just saves the round trip).
  if (recipientId === actorId) return;

  const cleanHref = href.slice(0, 300);
  const cleanTitle = title ? title.slice(0, 200) : null;

  try {
    const supabase = await createClient();

    // Note: no actorId is sent — notify_user() takes the actor from the
    // session (auth.uid()), which is the whole point. actorId is only
    // used above for the self-check. These functions are the ONLY way
    // to write a notification since migration 057 removed the direct-
    // insert policy (no fallback here any more).
    const { error } = await supabase.rpc("notify_user", {
      p_recipient: recipientId,
      p_type: type,
      p_href: cleanHref,
      p_title: cleanTitle,
    } as never);

    if (error) {
      console.error("createNotification failed (non-fatal):", error.message);
    }
  } catch (err) {
    console.error("createNotification failed (non-fatal):", err);
  }
}

/**
 * "Someone you follow posted" — one notification per follower.
 *
 * The whole fan-out is ONE database call however many followers there
 * are: notify_followers() looks up the caller's followers and inserts
 * a row for each in a single INSERT … SELECT.
 *
 * Deduped by (follower, actor, type, href) via the unique index,
 * because publishing is not a one-way door: unpublishing a post and
 * publishing it again, or editing a draft repeatedly, must not refill
 * everyone's bell. First publish wins, forever.
 *
 * Best-effort like everything else here — the thing was already
 * created, and a notification hiccup must never surface as a failure
 * to publish.
 *
 * Each inserted row fires the push trigger (032), so a creator with N
 * followers sends N pushes. That's the intent, and at current scale
 * it's nothing; if the site ever gets someone with thousands of
 * followers this wants a queue rather than a trigger per row.
 */
export async function notifyFollowers(input: {
  /** Kept so callers read clearly; notify_followers() ignores it and
      takes the actor from the session, which is what makes it safe. */
  actorId: string;
  type: FollowFeedType;
  href: string;
  title?: string | null;
}): Promise<void> {
  const { type, href, title } = input;
  const cleanHref = href.slice(0, 300);
  const cleanTitle = title ? title.slice(0, 200) : null;

  try {
    const supabase = await createClient();

    const { error } = await supabase.rpc("notify_followers", {
      p_type: type,
      p_href: cleanHref,
      p_title: cleanTitle,
    } as never);

    if (error) {
      console.error("notifyFollowers failed (non-fatal):", error.message);
    }
  } catch (err) {
    console.error("notifyFollowers failed (non-fatal):", err);
  }
}

/**
 * PostgREST filter value for "actor is not one of these ids":
 * `(id1,id2,…)`. Only ever built from uuids out of our own
 * user_blocks table, so there's nothing to escape.
 */
function notInList(ids: string[]): string {
  return `(${ids.join(",")})`;
}

/**
 * The viewer's latest notifications, actor profile joined in.
 *
 * Rows from people the viewer has BLOCKED are filtered out. New ones
 * can't be created any more (052's notify_user() skips blocked pairs), but
 * this also hides the ones from before the block — blocking someone
 * should make them vanish from your bell, not just stop new rows.
 */
export async function getNotifications(
  userId: string,
  limit = 25
): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const blocked = await getBlockedIds(userId);

  let query = supabase
    .from("notifications")
    .select(
      "*, profiles!notifications_actor_id_fkey(username, display_name, avatar_url)"
    )
    .eq("user_id", userId);
  if (blocked.length > 0) {
    query = query.not("actor_id", "in", notInList(blocked));
  }
  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type Row = Omit<NotificationRow, "actor"> & {
    profiles:
      | NotificationRow["actor"]
      | NonNullable<NotificationRow["actor"]>[]
      | null;
  };
  return (data as unknown as Row[]).map((row) => {
    const { profiles, ...rest } = row;
    return {
      ...rest,
      actor: Array.isArray(profiles) ? profiles[0] ?? null : profiles,
    };
  });
}

/**
 * How many unread — the badge number. Same blocked-actor filter as
 * getNotifications, so the badge never counts rows the list hides.
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const blocked = await getBlockedIds(userId);

  let query = supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  if (blocked.length > 0) {
    query = query.not("actor_id", "in", notInList(blocked));
  }
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

/** Opening the bell clears the badge. */
export async function markAllRead(userId: string): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("notifications")
    .update({ read: true } as never)
    .eq("user_id", userId)
    .eq("read", false);
}
