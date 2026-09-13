import { createClient } from "@/lib/supabase/server";
import type {
  AuxGame,
  AuxMatch,
  AuxMember,
  AuxMessage,
  AuxRoom,
  Profile,
} from "@/lib/types/database";

/**
 * DB reads for aux battles (migration 042). Everything here runs
 * through the viewer's own client + RLS: public rooms are readable by
 * anyone, private rooms only by the host and the members who entered
 * the code — so a getter that comes back empty for a private room
 * simply means "not let in", never an error.
 *
 * Writes live in lib/aux/engine.ts (the host's bracket moves) and the
 * API routes under app/api/aux-battles (everyone else's).
 */

/* --- Shapes the UI consumes --- */

export type AuxProfile = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url" | "role"
>;

/** The wins stat shown on a player (Luca: "counted and shown when playing"). */
export interface AuxWins {
  battles: number;
  rounds: number;
}

export interface AuxRoomWithMeta extends AuxRoom {
  host: AuxProfile | null;
  champion: AuxProfile | null;
}

export interface AuxMemberWithProfile extends AuxMember {
  profile: AuxProfile;
  wins: AuxWins;
}

export interface AuxMessageWithProfile extends AuxMessage {
  profile: AuxProfile;
}

/** Everything the room page needs in one bundle. */
export interface AuxRoomState {
  room: AuxRoomWithMeta;
  members: AuxMemberWithProfile[];
  matches: AuxMatch[];
  games: AuxGame[];
}

const ROOM_SELECT = `*,
  host:profiles!aux_rooms_host_id_fkey(id, username, display_name, avatar_url, role),
  champion:profiles!aux_rooms_champion_id_fkey(id, username, display_name, avatar_url, role)`;

type RoomRow = AuxRoom & {
  host: AuxProfile | AuxProfile[] | null;
  champion: AuxProfile | AuxProfile[] | null;
};

/* PostgREST hands a joined row back as an object OR a one-element
   array depending on how it inferred the relationship. */
function first<T>(joined: T | T[] | null | undefined): T | null {
  if (!joined) return null;
  return Array.isArray(joined) ? joined[0] ?? null : joined;
}

function shapeRoom(row: RoomRow): AuxRoomWithMeta {
  return { ...row, host: first(row.host), champion: first(row.champion) };
}

/* --- Rooms --- */

/** The index: what's live, what's filling up, what just finished. */
export async function listAuxRooms(): Promise<{
  live: AuxRoomWithMeta[];
  lobby: AuxRoomWithMeta[];
  finished: AuxRoomWithMeta[];
}> {
  const supabase = await createClient();
  const [liveRes, lobbyRes, doneRes] = await Promise.all([
    supabase
      .from("aux_rooms")
      .select(ROOM_SELECT)
      .eq("status", "live")
      .eq("is_private", false)
      .order("started_at", { ascending: false })
      .limit(24),
    supabase
      .from("aux_rooms")
      .select(ROOM_SELECT)
      .eq("status", "lobby")
      .eq("is_private", false)
      .order("created_at", { ascending: false })
      .limit(24),
    supabase
      .from("aux_rooms")
      .select(ROOM_SELECT)
      .eq("status", "finished")
      .eq("is_private", false)
      .not("champion_id", "is", null)
      .order("finished_at", { ascending: false })
      .limit(12),
  ]);
  const shape = (res: { data: unknown }) =>
    ((res.data ?? []) as unknown as RoomRow[]).map(shapeRoom);
  return { live: shape(liveRes), lobby: shape(lobbyRes), finished: shape(doneRes) };
}

/** Every room ONE member hosted (private ones included — RLS lets the host see them). */
export async function listAuxRoomsByHost(userId: string): Promise<AuxRoomWithMeta[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aux_rooms")
    .select(ROOM_SELECT)
    .eq("host_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as RoomRow[]).map(shapeRoom);
}

/** The private rooms this viewer was let into (the code page remembers them). */
export async function listAuxRoomsJoined(userId: string): Promise<AuxRoomWithMeta[]> {
  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("aux_members")
    .select("room_id")
    .eq("user_id", userId)
    .limit(100);
  const ids = ((rows ?? []) as { room_id: string }[]).map((r) => r.room_id);
  if (ids.length === 0) return [];
  const { data } = await supabase
    .from("aux_rooms")
    .select(ROOM_SELECT)
    .in("id", ids)
    .neq("host_id", userId)
    .order("created_at", { ascending: false });
  return ((data ?? []) as unknown as RoomRow[]).map(shapeRoom);
}

export async function getAuxRoomBySlug(slug: string): Promise<AuxRoomWithMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aux_rooms")
    .select(ROOM_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  return data ? shapeRoom(data as unknown as RoomRow) : null;
}

export async function getAuxRoomById(id: string): Promise<AuxRoom | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("aux_rooms").select("*").eq("id", id).maybeSingle();
  return (data as AuxRoom | null) ?? null;
}

/** Same as getAuxRoomBySlug, by id — the resync endpoint's read. */
export async function getAuxRoomMetaById(id: string): Promise<AuxRoomWithMeta | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("aux_rooms").select(ROOM_SELECT).eq("id", id).maybeSingle();
  return data ? shapeRoom(data as unknown as RoomRow) : null;
}

/**
 * Whether a private room exists at this slug at all — for the code
 * gate. RLS hides private rooms from outsiders, so the room getter
 * returns null both for "no such room" and "not let in yet"; this
 * tells the two apart without leaking anything but the slug's
 * existence (the slug is what they typed).
 */
export async function auxRoomExists(slug: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("aux_slug_exists", { p_slug: slug } as never);
  return data === true;
}

/* --- Wins --- */

export async function getAuxWins(userIds: string[]): Promise<Map<string, AuxWins>> {
  const map = new Map<string, AuxWins>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return map;
  const supabase = await createClient();
  const { data } = await supabase.rpc("aux_wins_for", { p_user_ids: ids } as never);
  for (const row of ((data ?? []) as { user_id: string; battles: number; rounds: number }[])) {
    map.set(row.user_id, { battles: row.battles, rounds: row.rounds });
  }
  return map;
}

/* --- The room bundle --- */

export async function getAuxRoomState(room: AuxRoomWithMeta): Promise<AuxRoomState> {
  const supabase = await createClient();
  const [membersRes, matchesRes, gamesRes] = await Promise.all([
    supabase
      .from("aux_members")
      .select("*, profiles!aux_members_user_id_fkey(id, username, display_name, avatar_url, role)")
      .eq("room_id", room.id)
      .order("joined_at", { ascending: true }),
    supabase
      .from("aux_matches")
      .select("*")
      .eq("room_id", room.id)
      .order("round", { ascending: true })
      .order("position", { ascending: true }),
    supabase
      .from("aux_games")
      .select("*")
      .eq("room_id", room.id)
      .order("created_at", { ascending: true }),
  ]);

  type MemberRow = AuxMember & { profiles: AuxProfile | AuxProfile[] | null };
  const rawMembers = ((membersRes.data ?? []) as unknown as MemberRow[])
    .map((row) => {
      const profile = first(row.profiles);
      if (!profile) return null;
      const { profiles: _drop, ...member } = row;
      void _drop;
      return { ...member, profile };
    })
    .filter((m): m is AuxMember & { profile: AuxProfile } => m !== null);

  const wins = await getAuxWins(rawMembers.map((m) => m.user_id));
  const members: AuxMemberWithProfile[] = rawMembers.map((m) => ({
    ...m,
    wins: wins.get(m.user_id) ?? { battles: 0, rounds: 0 },
  }));

  return {
    room,
    members,
    matches: (matchesRes.data ?? []) as unknown as AuxMatch[],
    games: (gamesRes.data ?? []) as unknown as AuxGame[],
  };
}

export async function getViewerMembership(
  roomId: string,
  userId: string
): Promise<AuxMember | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aux_members")
    .select("*")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as AuxMember | null) ?? null;
}

export async function getViewerAuxVote(
  gameId: string,
  userId: string
): Promise<"a" | "b" | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aux_votes")
    .select("side")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { side: "a" | "b" } | null)?.side ?? null;
}

/* --- Chat --- */

/** Newest `limit` messages, returned oldest → newest like a chat log. */
export async function getAuxMessages(
  roomId: string,
  limit = 100
): Promise<AuxMessageWithProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aux_messages")
    .select("*, profiles!aux_messages_user_id_fkey(id, username, display_name, avatar_url, role)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  type Row = AuxMessage & { profiles: AuxProfile | AuxProfile[] | null };
  return (data as unknown as Row[])
    .map((row) => {
      const profile = first(row.profiles);
      if (!profile) return null;
      const { profiles: _drop, ...message } = row;
      void _drop;
      return { ...message, profile } as AuxMessageWithProfile;
    })
    .filter((m): m is AuxMessageWithProfile => m !== null)
    .reverse();
}
