import { createClient } from "@/lib/supabase/server";

/**
 * Notifications data helpers (migration 025).
 *
 * Everything runs with the CALLER's session, so RLS is the real
 * boundary: only the recipient can read/update their rows, and an
 * insert must carry the signed-in user as the actor.
 *
 * createNotification is BEST-EFFORT everywhere it's called: the
 * like/follow/comment succeeded already, and a notification hiccup
 * must never surface as an action failure. Callers don't await
 * anything from it beyond completion; it swallows its own errors.
 *
 * Before migration 025 runs, every query here just errors → empty
 * results / silent no-ops. Nothing breaks pre-migration.
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
  | "new_debate";

/** The four the CREATE tab makes — the only types that fan out. */
export type FollowFeedType =
  | "new_review"
  | "new_post"
  | "new_list"
  | "new_debate";

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

/** One-shot types where a repeat action shouldn't re-notify. */
const DEDUP_TYPES: NotificationType[] = [
  "follow",
  "review_like",
  "post_like",
  "list_like",
];

export async function createNotification(input: {
  recipientId: string;
  actorId: string;
  type: NotificationType;
  href: string;
  title?: string | null;
}): Promise<void> {
  const { recipientId, actorId, type, href, title } = input;
  // Self-actions never notify (the DB check would reject them anyway).
  if (recipientId === actorId) return;

  try {
    const supabase = await createClient();

    // Like/follow toggles: one notification per (actor, thing), ever —
    // an unlike/relike loop must not refill the bell. Check-then-insert;
    // a race's worst case is one duplicate row, which is harmless.
    if (DEDUP_TYPES.includes(type)) {
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", recipientId)
        .eq("actor_id", actorId)
        .eq("type", type)
        .eq("href", href)
        .limit(1)
        .maybeSingle();
      if (existing) return;
    }

    await supabase.from("notifications").insert({
      user_id: recipientId,
      actor_id: actorId,
      type,
      href: href.slice(0, 300),
      title: title ? title.slice(0, 200) : null,
    } as never);
  } catch (err) {
    console.error("createNotification failed (non-fatal):", err);
  }
}

/**
 * "Someone you follow posted" — one notification per follower.
 *
 * The other helper answers a single person; this one answers a crowd,
 * so it does the whole fan-out in three queries no matter how many
 * followers there are: who follows me, who have I already told, insert
 * the rest. Doing it per-follower through createNotification would be
 * two round trips each.
 *
 * Deduped by (actor, type, href) because publishing is not a one-way
 * door: unpublishing a post and publishing it again, or editing a
 * draft repeatedly, must not refill everyone's bell. First publish
 * wins, forever.
 *
 * Best-effort like everything else here — the thing was already
 * created, and a notification hiccup must never surface as a failure
 * to publish.
 *
 * Note each inserted row also fires the push trigger (033/032), so a
 * creator with N followers sends N pushes. That's the intent, and at
 * current scale it's nothing; if the site ever gets someone with
 * thousands of followers this wants a queue rather than a loop.
 */
export async function notifyFollowers(input: {
  actorId: string;
  type: FollowFeedType;
  href: string;
  title?: string | null;
}): Promise<void> {
  const { actorId, type, href, title } = input;

  try {
    const supabase = await createClient();

    const { data: followers } = await supabase
      .from("follows")
      .select("follower_id")
      .eq("following_id", actorId);

    const followerIds = (followers ?? []).map(
      (row) => (row as { follower_id: string }).follower_id
    );
    if (followerIds.length === 0) return;

    // Already told about this exact thing? Then this is a re-publish.
    const { data: existing } = await supabase
      .from("notifications")
      .select("user_id")
      .eq("actor_id", actorId)
      .eq("type", type)
      .eq("href", href);

    const told = new Set(
      (existing ?? []).map((row) => (row as { user_id: string }).user_id)
    );

    const rows = followerIds
      // A self-follow shouldn't exist, but the DB check would reject
      // the whole insert if one ever did.
      .filter((id) => id !== actorId && !told.has(id))
      .map((id) => ({
        user_id: id,
        actor_id: actorId,
        type,
        href: href.slice(0, 300),
        title: title ? title.slice(0, 200) : null,
      }));

    if (rows.length === 0) return;

    await supabase.from("notifications").insert(rows as never);
  } catch (err) {
    console.error("notifyFollowers failed (non-fatal):", err);
  }
}

/** The viewer's latest notifications, actor profile joined in. */
export async function getNotifications(
  userId: string,
  limit = 25
): Promise<NotificationRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notifications")
    .select(
      "*, profiles!notifications_actor_id_fkey(username, display_name, avatar_url)"
    )
    .eq("user_id", userId)
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

/** How many unread — the badge number. */
export async function getUnreadCount(userId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
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
