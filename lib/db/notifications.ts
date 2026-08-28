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
  | "list_like";

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
