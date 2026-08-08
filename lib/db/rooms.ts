import { createClient } from "@/lib/supabase/server";
import type {
  Profile,
  ReleaseRoom,
  RoomMessage,
  RoomReaction,
  TrackReactionCounts,
} from "@/lib/types/database";

/**
 * Lazy-create-or-fetch the room for a release. Wraps the
 * `get_release_room` SQL function which is `security definer`, so callers
 * don't need direct insert privilege on release_rooms.
 */
export async function getOrCreateRoom(
  releaseId: string
): Promise<ReleaseRoom> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_release_room", {
    release_uuid: releaseId,
  } as never);

  if (error || !data) {
    throw new Error(
      `getOrCreateRoom failed: ${error?.message ?? "no data returned"}`
    );
  }

  // The function returns a single composite row; supabase-js may surface
  // it as either the row directly or wrapped in a single-element array.
  const row = Array.isArray(data) ? data[0] : data;
  return row as ReleaseRoom;
}

/**
 * Read-only room lookup — returns null if no room exists yet.
 * Used by public GET endpoints so anonymous readers never trigger an
 * insert (room creation only happens when someone actually posts).
 */
export async function getRoom(releaseId: string): Promise<ReleaseRoom | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("release_rooms")
    .select("*")
    .eq("release_id", releaseId)
    .maybeSingle();
  return (data as ReleaseRoom | null) ?? null;
}

export type RoomMessageWithProfile = RoomMessage & {
  profile: Pick<
    Profile,
    "id" | "username" | "display_name" | "avatar_url" | "role"
  >;
};

/**
 * Paginated list of room messages, latest first. Pass `before` (a
 * `created_at` ISO string) to fetch the next older page.
 */
export async function getRoomMessages(
  roomId: string,
  opts?: { limit?: number; before?: string }
): Promise<RoomMessageWithProfile[]> {
  const supabase = await createClient();
  const limit = opts?.limit ?? 50;

  let query = supabase
    .from("room_messages")
    .select(
      "*, profiles!inner(id, username, display_name, avatar_url, role)"
    )
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (opts?.before) {
    query = query.lt("created_at", opts.before);
  }

  const { data, error } = await query;
  if (error || !data) return [];

  type Row = RoomMessage & {
    profiles:
      | Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "role">
      | Pick<Profile, "id" | "username" | "display_name" | "avatar_url" | "role">[]
      | null;
  };

  return (data as unknown as Row[])
    .map((r) => {
      const { profiles, ...rest } = r;
      const profile = Array.isArray(profiles) ? profiles[0] : profiles;
      if (!profile) return null;
      return { ...rest, profile } as RoomMessageWithProfile;
    })
    .filter((r): r is RoomMessageWithProfile => r !== null);
}

export async function postRoomMessage(input: {
  roomId: string;
  userId: string;
  content: string;
  trackPosition?: number;
}): Promise<RoomMessage> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_messages")
    .insert({
      room_id: input.roomId,
      user_id: input.userId,
      content: input.content,
      track_position: input.trackPosition ?? null,
    } as never)
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `postRoomMessage failed: ${error?.message ?? "no data returned"}`
    );
  }
  return data as RoomMessage;
}

export async function deleteRoomMessage(messageId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.from("room_messages").delete().eq("id", messageId);
}

/**
 * Aggregated emoji counts per track in a room. Used to render the static
 * counts shown on each track row.
 */
export async function getTrackReactionCounts(
  roomId: string
): Promise<TrackReactionCounts[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_reactions")
    .select("track_position, emoji")
    .eq("room_id", roomId)
    .eq("target_type", "track");

  if (error || !data) return [];

  const buckets = new Map<string, TrackReactionCounts>();
  for (const r of data as { track_position: number | null; emoji: string }[]) {
    if (r.track_position === null || r.track_position === undefined) continue;
    const key = `${r.track_position}::${r.emoji}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, {
        track_position: r.track_position,
        emoji: r.emoji,
        count: 1,
      });
    }
  }

  return Array.from(buckets.values());
}

export async function getMessageReactionCounts(
  messageIds: string[]
): Promise<{ message_id: string; emoji: string; count: number }[]> {
  if (messageIds.length === 0) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_reactions")
    .select("message_id, emoji")
    .eq("target_type", "message")
    .in("message_id", messageIds);

  if (error || !data) return [];

  const buckets = new Map<
    string,
    { message_id: string; emoji: string; count: number }
  >();
  for (const r of data as { message_id: string | null; emoji: string }[]) {
    if (!r.message_id) continue;
    const key = `${r.message_id}::${r.emoji}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      buckets.set(key, { message_id: r.message_id, emoji: r.emoji, count: 1 });
    }
  }

  return Array.from(buckets.values());
}

/**
 * Adds a reaction. Idempotent — if the (user, target, emoji) tuple already
 * exists (caught via the partial unique indexes on room_reactions), the
 * existing row is fetched and returned instead of throwing.
 *
 * Exactly one of `trackPosition` or `messageId` must be provided.
 */
export async function addReaction(input: {
  roomId: string;
  userId: string;
  emoji: string;
  trackPosition?: number;
  messageId?: string;
}): Promise<RoomReaction> {
  const hasTrack =
    input.trackPosition !== undefined && input.trackPosition !== null;
  const hasMessage =
    input.messageId !== undefined && input.messageId !== null;

  if (hasTrack === hasMessage) {
    throw new Error(
      "addReaction requires exactly one of trackPosition or messageId"
    );
  }

  const supabase = await createClient();
  const target_type: RoomReaction["target_type"] = hasTrack ? "track" : "message";

  const row = {
    room_id: input.roomId,
    user_id: input.userId,
    emoji: input.emoji,
    target_type,
    track_position: hasTrack ? input.trackPosition! : null,
    message_id: hasMessage ? input.messageId! : null,
  };

  const { data, error } = await supabase
    .from("room_reactions")
    .insert(row as never)
    .select()
    .single();

  if (!error && data) return data as RoomReaction;

  // Postgres unique-violation = 23505. Fall back to fetching the existing
  // row so the call stays idempotent.
  const isUnique =
    error &&
    ((error as { code?: string }).code === "23505" ||
      /duplicate key/i.test(error.message ?? ""));

  if (isUnique) {
    let q = supabase
      .from("room_reactions")
      .select("*")
      .eq("user_id", input.userId)
      .eq("emoji", input.emoji)
      .eq("target_type", target_type);

    if (hasTrack) {
      q = q.eq("room_id", input.roomId).eq("track_position", input.trackPosition!);
    } else {
      q = q.eq("message_id", input.messageId!);
    }

    const { data: existing, error: fetchErr } = await q.single();
    if (!fetchErr && existing) return existing as RoomReaction;
  }

  throw new Error(
    `addReaction failed: ${error?.message ?? "no data returned"}`
  );
}

export async function removeReaction(input: {
  userId: string;
  roomId: string;
  emoji: string;
  trackPosition?: number;
  messageId?: string;
}): Promise<void> {
  const hasTrack =
    input.trackPosition !== undefined && input.trackPosition !== null;
  const hasMessage =
    input.messageId !== undefined && input.messageId !== null;

  if (hasTrack === hasMessage) {
    throw new Error(
      "removeReaction requires exactly one of trackPosition or messageId"
    );
  }

  const supabase = await createClient();
  let q = supabase
    .from("room_reactions")
    .delete()
    .eq("user_id", input.userId)
    .eq("emoji", input.emoji);

  if (hasTrack) {
    q = q
      .eq("room_id", input.roomId)
      .eq("target_type", "track")
      .eq("track_position", input.trackPosition!);
  } else {
    q = q.eq("target_type", "message").eq("message_id", input.messageId!);
  }

  await q;
}

/**
 * Reactions the current viewer has already added in this room — used to
 * highlight active emoji buttons in the UI.
 */
export async function getViewerReactions(
  userId: string,
  roomId: string
): Promise<
  { track_position: number | null; message_id: string | null; emoji: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("room_reactions")
    .select("track_position, message_id, emoji")
    .eq("user_id", userId)
    .eq("room_id", roomId);

  if (error || !data) return [];
  return data as {
    track_position: number | null;
    message_id: string | null;
    emoji: string;
  }[];
}
