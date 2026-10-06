import { createClient } from "@/lib/supabase/server";
import { AUX_IDLE_MS, auxRoomIsIdle } from "@/lib/aux-wars/limits";
import type {
  AuxBan,
  AuxGame,
  AuxMatch,
  AuxMember,
  AuxMessage,
  AuxRoom,
  AuxSong,
  Profile,
} from "@/lib/types/database";

/**
 * DB reads for Aux Wars (migration 042). Everything here runs
 * through the viewer's own client + RLS: public rooms are readable by
 * anyone, private rooms only by the host and the members who entered
 * the code — so a getter that comes back empty for a private room
 * simply means "not let in", never an error.
 *
 * Writes live in lib/aux-wars/engine.ts (the host's bracket moves —
 * since migration 053, thin calls into locked Postgres functions) and
 * the API routes under app/api/aux-wars (everyone else's). The one
 * write in here is the lazy idle close, which only finishes rooms the
 * clock already says are dead.
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

export interface AuxBanWithProfile extends AuxBan {
  profile: AuxProfile;
}

/** A mutual follow the host can invite, and whether they're already in. */
export interface AuxInvitable {
  profile: AuxProfile;
  alreadyIn: boolean;
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

/**
 * The index: what's live, what's filling up, what just finished.
 *
 * "Just finished" means the LAST 24 HOURS and nothing older (Luca
 * 2026-09-14: "they should get the same dropping soon treatment,
 * where they disappear after 24 hrs to not clutter it up"). The rooms
 * aren't deleted — they keep their page, their bracket and their
 * champion, and they still count on the leaderboard. They just stop
 * sitting on the front of the arena. Same reasoning as the countdown
 * shelf: a result is news for a day.
 */
export async function listAuxRooms(): Promise<{
  live: AuxRoomWithMeta[];
  lobby: AuxRoomWithMeta[];
  finished: AuxRoomWithMeta[];
}> {
  const supabase = await createClient();
  const now = Date.now();
  const dayAgo = new Date(now - 24 * 60 * 60 * 1000).toISOString();
  // Anything quiet for longer than this isn't really on (053).
  const awakeSince = new Date(now - AUX_IDLE_MS).toISOString();

  /* THE IDLE CLOSE, lazily (migration 053, code review 2026-10-05: a
     room the host walked away from used to sit "live" on this page
     forever). Finishing rooms that have been quiet for two hours is a
     database function anyone may trigger, because it only does what
     the clock already says — so the arena runs it on every read and
     there's no cron to maintain. It's cheap (one indexed update) and
     its failure changes nothing: the shelf filter below hides idle
     rooms either way. */
  // supabase-js hands errors back instead of throwing, so ignoring the
  // result IS the error handling here.
  await supabase.rpc("aux_close_idle_rooms");

  /* Migrations are run BY HAND while a push deploys instantly, so
     there is always a window where this code is ahead of the
     database. It cost us a whole empty arena once (2026-09-14: the
     is_hidden filter went out before migration 045 and PostgREST
     answered 42703 for every section, which read as "my room
     disappeared"). So: ask with the idle filter, and if the column
     isn't there yet (053 not run), ask again without it. (The older
     is_private fallback is gone — 045 has been live since 09-14.) */
  const shelf = async (idleFilter: boolean) => {
    // The two OPEN shelves only show rooms something happened in
    // recently. Finished rooms keep their own 24-hour rule.
    let live = supabase.from("aux_rooms").select(ROOM_SELECT).eq("status", "live").eq("is_hidden", false);
    let lobby = supabase.from("aux_rooms").select(ROOM_SELECT).eq("status", "lobby").eq("is_hidden", false);
    if (idleFilter) {
      live = live.gte("last_activity_at", awakeSince);
      lobby = lobby.gte("last_activity_at", awakeSince);
    }
    return Promise.all([
      live.order("started_at", { ascending: false }).limit(24),
      lobby.order("created_at", { ascending: false }).limit(24),
      supabase
        .from("aux_rooms")
        .select(ROOM_SELECT)
        .eq("status", "finished")
        .eq("is_hidden", false)
        .not("champion_id", "is", null)
        .gte("finished_at", dayAgo)
        .order("finished_at", { ascending: false })
        .limit(12),
    ]);
  };

  let [liveRes, lobbyRes, doneRes] = await shelf(true);
  if (liveRes.error?.code === "42703") {
    [liveRes, lobbyRes, doneRes] = await shelf(false);
  }
  const shape = (res: { data: unknown }) =>
    ((res.data ?? []) as unknown as RoomRow[]).map(shapeRoom);
  return { live: shape(liveRes), lobby: shape(lobbyRes), finished: shape(doneRes) };
}

/**
 * Run the idle close for ONE room the viewer just opened, and hand
 * back the fresh row. Called by the room page when the room it read is
 * open but older than the idle window — so a link to a dead room shows
 * "went quiet", not a lobby that will never start. Returns the room
 * unchanged if the close isn't there yet (053 not run) or found
 * nothing to do.
 */
export async function closeAuxRoomIfIdle(room: AuxRoomWithMeta): Promise<AuxRoomWithMeta> {
  if (!auxRoomIsIdle(room)) return room;
  const supabase = await createClient();
  const { error } = await supabase.rpc("aux_close_idle_rooms");
  if (error) return room;
  return (await getAuxRoomBySlug(room.slug)) ?? room;
}

/* --- Recent results: the arena's archive shelf --- */

/** One finished war as the arena shows it when nothing is on air. */
export interface AuxRecentResult {
  room: AuxRoomWithMeta;
  /** The topic the FINAL was played to (game first, then round). */
  topic: string | null;
  /** The two finalists and their songs in the deciding game. Null when
      the final was a forfeit before any song went on. */
  a: { profile: AuxProfile | null; song: AuxSong | null };
  b: { profile: AuxProfile | null; song: AuxSong | null };
  winnerSide: "a" | "b" | null;
}

/**
 * The last few public wars that crowned a champion — however old.
 * The arena's 24-hour "Last results" shelf goes empty on a quiet day,
 * and a visitor landing on NO SIGNAL thought the feature was dead
 * (code review 2026-10-05). This is what fills that gap: the room,
 * the final's topic, both songs, and who took it.
 *
 * Four small reads (rooms → their finals → the deciding games → the
 * finalists' profiles) instead of one clever join, so each step is
 * easy to follow. All through the viewer's own client, so RLS keeps
 * hidden rooms out exactly as it does everywhere else.
 */
export async function listRecentAuxResults(limit = 4): Promise<AuxRecentResult[]> {
  const supabase = await createClient();
  const { data: roomRows } = await supabase
    .from("aux_rooms")
    .select(ROOM_SELECT)
    .eq("status", "finished")
    .eq("is_hidden", false)
    .not("champion_id", "is", null)
    .order("finished_at", { ascending: false })
    .limit(limit);
  const rooms = ((roomRows ?? []) as unknown as RoomRow[]).map(shapeRoom);
  if (rooms.length === 0) return [];

  // The FINAL of each room = its highest round's real (non-bye) match.
  const { data: matchRows } = await supabase
    .from("aux_matches")
    .select("*")
    .in("room_id", rooms.map((r) => r.id))
    .eq("is_bye", false)
    .eq("status", "done");
  const finals = new Map<string, AuxMatch>();
  for (const m of (matchRows ?? []) as unknown as AuxMatch[]) {
    const best = finals.get(m.room_id);
    if (!best || m.round > best.round) finals.set(m.room_id, m);
  }

  // The DECIDING game of each final = the last one that has a winner.
  const finalIds = [...finals.values()].map((m) => m.id);
  const deciding = new Map<string, AuxGame>();
  if (finalIds.length > 0) {
    const { data: gameRows } = await supabase
      .from("aux_games")
      .select("*")
      .in("match_id", finalIds)
      .not("winner_side", "is", null);
    for (const g of (gameRows ?? []) as unknown as AuxGame[]) {
      const best = deciding.get(g.match_id);
      if (!best || g.game_no > best.game_no) deciding.set(g.match_id, g);
    }
  }

  // Finalists' names and faces.
  const playerIds = [...finals.values()].flatMap((m) => [m.player_a_id, m.player_b_id ?? ""]).filter(Boolean);
  const profiles = new Map<string, AuxProfile>();
  if (playerIds.length > 0) {
    const { data: profileRows } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, role")
      .in("id", [...new Set(playerIds)]);
    for (const p of (profileRows ?? []) as AuxProfile[]) profiles.set(p.id, p);
  }

  return rooms.map((room) => {
    const final = finals.get(room.id) ?? null;
    const game = final ? deciding.get(final.id) ?? null : null;
    return {
      room,
      topic: game?.topic ?? final?.topic ?? null,
      a: {
        profile: final ? profiles.get(final.player_a_id) ?? null : null,
        song: game?.song_a ?? null,
      },
      b: {
        profile: final?.player_b_id ? profiles.get(final.player_b_id) ?? null : null,
        song: game?.song_b ?? null,
      },
      // The match winner, not just the last game's — the same thing in
      // a bo1, and the right answer for a bo3 that went 2–1.
      winnerSide: final?.winner_id
        ? final.winner_id === final.player_a_id
          ? "a"
          : "b"
        : null,
    };
  });
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

/* --- Seats + bans (migration 045) --- */

/**
 * Does this viewer hold a SEAT in the room — the right to take a spot
 * in the bracket? Public rooms don't need one; a private room's seat
 * comes from typing the code or from the host's invite. Always false
 * signed out.
 */
export async function hasAuxSeat(roomId: string, userId: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("aux_seats")
    .select("user_id")
    .eq("room_id", roomId)
    .eq("user_id", userId)
    .maybeSingle();
  // Before migration 045 the table doesn't exist, and back then simply
  // BEING in a private room meant you'd typed the code — so the honest
  // fallback is yes, not a locked-out lobby.
  if (error && /42P01|does not exist/i.test(error.message ?? "")) return true;
  return !!data;
}

/** Everyone the host has blocked from this room. */
export async function getAuxBans(roomId: string): Promise<AuxBanWithProfile[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aux_bans")
    .select("*, profiles!aux_bans_user_id_fkey(id, username, display_name, avatar_url, role)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: true });
  type Row = AuxBan & { profiles: AuxProfile | AuxProfile[] | null };
  return ((data ?? []) as unknown as Row[])
    .map((row) => {
      const profile = first(row.profiles);
      if (!profile) return null;
      const { profiles: _drop, ...ban } = row;
      void _drop;
      return { ...ban, profile } as AuxBanWithProfile;
    })
    .filter((b): b is AuxBanWithProfile => b !== null);
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

/**
 * The viewer's ONE reaction on a game (migration 044). Null when they
 * haven't thrown one — the picker highlights whichever they chose so
 * the tap reads as a choice, not a counter.
 */
export async function getViewerAuxReaction(
  gameId: string,
  userId: string
): Promise<{ side: "a" | "b"; kind: "fire" | "poop" } | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("aux_reactions")
    .select("side, kind")
    .eq("game_id", gameId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { side: "a" | "b"; kind: "fire" | "poop" } | null) ?? null;
}

/* --- The leaderboard (Luca 2026-09-14) --- */

export type AuxLeaderPeriod = "all" | "week";

export interface AuxLeaderRow {
  profile: AuxProfile;
  battles: number;
  rounds: number;
}

/**
 * Top players on Aux Wars — all time or THIS WEEK.
 *
 * "This week" means the same thing it means on /social: since Friday
 * 00:00 US Eastern (lib/upcoming.ts lastFridayEasternUtcMs). It used to
 * be a rolling 7 days here, so the two pages disagreed about which
 * wins were "this week" (code review 2026-10-05). The caller passes the
 * boundary as `sinceMs`, the way social_week_leaders takes it (049);
 * migration 053 taught aux_leaderboard the `p_since` argument. Left
 * out, 'week' falls back to the old rolling 7 days.
 *
 * Wins a host handed themselves are excluded inside aux_leaderboard —
 * a room they both played and judged (044), or a match they called
 * for themselves in a crowd room (053) — so nobody can farm the board.
 */
export async function getAuxLeaderboard(
  period: AuxLeaderPeriod = "all",
  limit = 10,
  sinceMs?: number
): Promise<AuxLeaderRow[]> {
  const supabase = await createClient();
  const args: Record<string, unknown> = { p_period: period, p_limit: limit };
  if (period === "week" && sinceMs !== undefined) {
    args.p_since = new Date(sinceMs).toISOString();
  }
  let { data, error } = await supabase.rpc("aux_leaderboard", args as never);
  // Before 053 there's no p_since overload and PostgREST can't match
  // the call — ask the old way rather than show an empty board.
  if (error && args.p_since) {
    ({ data, error } = await supabase.rpc("aux_leaderboard", {
      p_period: period,
      p_limit: limit,
    } as never));
  }
  type Row = {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: AuxProfile["role"];
    battles: number;
    rounds: number;
  };
  return ((data ?? []) as Row[]).map((r) => ({
    profile: {
      id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      role: r.role,
    },
    battles: r.battles,
    rounds: r.rounds,
  }));
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
