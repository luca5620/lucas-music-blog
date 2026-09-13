/**
 * The aux battle engine — SERVER ONLY, runs inside the HOST's own
 * request (their Supabase client under RLS: only the host can write
 * matches and games for their room, migration 042).
 *
 * The bracket, in plain words (Luca 2026-09-13):
 *   - START: the players are shuffled and paired into round 1. An odd
 *     player out gets a BYE — a free win into the next round. The first
 *     real match goes live with game 1 in the "picking" phase.
 *   - A GAME: both players pick a song (aux_pick_song flips the phase
 *     to "listening" when both are in), the crowd votes and fires
 *     🔥/💩, the host CALLS it. bo1 rooms need one game per match,
 *     bo3 rooms need two wins.
 *   - CALLING: judge = crowd → majority vote; a tie goes to OVERTIME
 *     (a fresh game, new songs) and a second tie — or no votes at
 *     all — puts it on the host. judge = host → the host picks.
 *   - ADVANCE: the next pending match in the round goes live. When a
 *     round is done its winners (byes included) are shuffled into the
 *     next round, odd one out gets the bye again, until one is left:
 *     the CHAMPION.
 *
 * Every step is a few small writes, not a transaction — the host is
 * the only writer, so the worst case of a dropped request is a room
 * one tap behind, which the next tap fixes.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuxGame, AuxMatch, AuxRoom, Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export class AuxError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

function shuffle<T>(list: T[]): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function winsNeeded(room: AuxRoom): number {
  return room.format === "bo3" ? 2 : 1;
}

/* ------------------------------------------------------------------
   Small writes
   ------------------------------------------------------------------ */

async function insertGame(
  supabase: Client,
  room: AuxRoom,
  match: AuxMatch,
  gameNo: number,
  isOt: boolean
): Promise<AuxGame> {
  const { data, error } = await supabase
    .from("aux_games")
    .insert({ match_id: match.id, room_id: room.id, game_no: gameNo, is_ot: isOt } as never)
    .select("*")
    .single();
  if (error || !data) throw new AuxError(`Couldn't open the next game: ${error?.message}`, 500);
  return data as unknown as AuxGame;
}

async function setCurrentGame(supabase: Client, room: AuxRoom, gameId: string | null) {
  const { error } = await supabase
    .from("aux_rooms")
    .update({ current_game_id: gameId } as never)
    .eq("id", room.id);
  if (error) throw new AuxError(`Couldn't move the room on: ${error.message}`, 500);
}

/** Put a pending match on air with its first game. */
async function goLive(supabase: Client, room: AuxRoom, match: AuxMatch): Promise<AuxGame> {
  const { error } = await supabase
    .from("aux_matches")
    .update({ status: "live" } as never)
    .eq("id", match.id);
  if (error) throw new AuxError(`Couldn't start the match: ${error.message}`, 500);
  const game = await insertGame(supabase, room, match, 1, false);
  await setCurrentGame(supabase, room, game.id);
  return game;
}

/**
 * Write one round of matches for these players. The odd one out (if
 * any) gets a bye — already "done" with themselves as the winner.
 */
async function createRound(
  supabase: Client,
  room: AuxRoom,
  round: number,
  playerIds: string[]
): Promise<AuxMatch[]> {
  const order = shuffle(playerIds);
  const rows: Record<string, unknown>[] = [];
  let position = 0;
  for (let i = 0; i + 1 < order.length; i += 2) {
    rows.push({
      room_id: room.id,
      round,
      position: position++,
      player_a_id: order[i],
      player_b_id: order[i + 1],
    });
  }
  if (order.length % 2 === 1) {
    const lucky = order[order.length - 1];
    rows.push({
      room_id: room.id,
      round,
      position: position++,
      player_a_id: lucky,
      player_b_id: null,
      is_bye: true,
      winner_id: lucky,
      status: "done",
    });
  }
  const { data, error } = await supabase
    .from("aux_matches")
    .insert(rows as never)
    .select("*")
    .order("position", { ascending: true });
  if (error || !data) throw new AuxError(`Couldn't draw the bracket: ${error?.message}`, 500);
  return data as unknown as AuxMatch[];
}

/* ------------------------------------------------------------------
   START
   ------------------------------------------------------------------ */

export async function startRoom(supabase: Client, room: AuxRoom): Promise<void> {
  if (room.status !== "lobby") throw new AuxError("This battle already started.");

  const { data: members } = await supabase
    .from("aux_members")
    .select("user_id, role")
    .eq("room_id", room.id);
  const players = new Set(
    ((members ?? []) as { user_id: string; role: string }[])
      .filter((m) => m.role === "player")
      .map((m) => m.user_id)
  );
  // A playing host is always in, even if they never tapped "join".
  if (room.host_plays) {
    if (!players.has(room.host_id)) {
      await supabase
        .from("aux_members")
        .upsert({ room_id: room.id, user_id: room.host_id, role: "player" } as never, {
          onConflict: "room_id,user_id",
        });
      players.add(room.host_id);
    }
  } else {
    players.delete(room.host_id);
  }
  if (players.size < 2) throw new AuxError("You need at least two players to start.");

  const matches = await createRound(supabase, room, 1, [...players]);
  const firstReal = matches.find((m) => !m.is_bye);
  if (!firstReal) throw new AuxError("Couldn't find a match to start.", 500);

  const { error } = await supabase
    .from("aux_rooms")
    .update({ status: "live", started_at: new Date().toISOString() } as never)
    .eq("id", room.id);
  if (error) throw new AuxError(`Couldn't start the battle: ${error.message}`, 500);

  await goLive(supabase, { ...room, status: "live" }, firstReal);
}

/* ------------------------------------------------------------------
   CALL — the host closes the game everyone just listened to
   ------------------------------------------------------------------ */

export interface CallResult {
  /** Set when the host has to pick — the crowd tied (after OT) or nobody voted. */
  needsHost?: "tie" | "no_votes";
  /** True when a tie sent the match into overtime. */
  overtime?: boolean;
  winnerSide?: "a" | "b";
  matchWon?: boolean;
  champion?: string | null;
  finished?: boolean;
}

export async function callGame(
  supabase: Client,
  room: AuxRoom,
  side: "a" | "b" | null
): Promise<CallResult> {
  if (room.status !== "live" || !room.current_game_id) {
    throw new AuxError("Nothing is playing right now.");
  }
  const { data: gameRow } = await supabase
    .from("aux_games")
    .select("*")
    .eq("id", room.current_game_id)
    .maybeSingle();
  const game = gameRow as unknown as AuxGame | null;
  if (!game) throw new AuxError("The game is gone.", 404);
  const { data: matchRow } = await supabase
    .from("aux_matches")
    .select("*")
    .eq("id", game.match_id)
    .maybeSingle();
  const match = matchRow as unknown as AuxMatch | null;
  if (!match) throw new AuxError("The match is gone.", 404);

  /* Forfeit: while still PICKING, the host can hand the whole match to
     one side (a player walked off and never put a song on). */
  if (game.phase === "picking") {
    if (!side) throw new AuxError("Pick who moves on before anyone has played a song.");
    await supabase
      .from("aux_games")
      .update({ phase: "done", winner_side: side, decided_by: "host", closed_at: new Date().toISOString() } as never)
      .eq("id", game.id);
    const winnerId = side === "a" ? match.player_a_id : match.player_b_id;
    await supabase
      .from("aux_matches")
      .update({ winner_id: winnerId, status: "done" } as never)
      .eq("id", match.id);
    const after = await advance(supabase, room);
    return { winnerSide: side, matchWon: true, ...after };
  }

  if (game.phase !== "listening") throw new AuxError("This game is already called.");

  /* Who won this game? */
  let winner: "a" | "b" | null = null;
  let decidedBy: "crowd" | "host" = "crowd";
  if (room.judge === "host") {
    if (!side) throw new AuxError("Pick a winner.");
    winner = side;
    decidedBy = "host";
  } else {
    const total = game.votes_a + game.votes_b;
    if (game.votes_a !== game.votes_b) {
      // The host can't overrule a clear crowd — that's the whole point.
      winner = game.votes_a > game.votes_b ? "a" : "b";
    } else if (total === 0) {
      if (!side) return { needsHost: "no_votes" };
      winner = side;
      decidedBy = "host";
    } else if (!game.is_ot) {
      // A tie → OVERTIME: new songs, vote again.
      await supabase
        .from("aux_games")
        .update({ phase: "done", closed_at: new Date().toISOString() } as never)
        .eq("id", game.id);
      const ot = await insertGame(supabase, room, match, game.game_no + 1, true);
      await setCurrentGame(supabase, room, ot.id);
      return { overtime: true };
    } else {
      if (!side) return { needsHost: "tie" };
      winner = side;
      decidedBy = "host";
    }
  }

  await supabase
    .from("aux_games")
    .update({ phase: "done", winner_side: winner, decided_by: decidedBy, closed_at: new Date().toISOString() } as never)
    .eq("id", game.id);

  const winsA = match.wins_a + (winner === "a" ? 1 : 0);
  const winsB = match.wins_b + (winner === "b" ? 1 : 0);
  const needed = winsNeeded(room);
  const matchWon = winsA >= needed || winsB >= needed;

  if (!matchWon) {
    await supabase
      .from("aux_matches")
      .update({ wins_a: winsA, wins_b: winsB } as never)
      .eq("id", match.id);
    // Same match, next game — count OT games in game_no so ids stay unique.
    const next = await insertGame(supabase, room, match, game.game_no + 1, false);
    await setCurrentGame(supabase, room, next.id);
    return { winnerSide: winner, matchWon: false };
  }

  const winnerId = winner === "a" ? match.player_a_id : match.player_b_id;
  await supabase
    .from("aux_matches")
    .update({ wins_a: winsA, wins_b: winsB, winner_id: winnerId, status: "done" } as never)
    .eq("id", match.id);

  const after = await advance(supabase, room);
  return { winnerSide: winner, matchWon: true, ...after };
}

/* ------------------------------------------------------------------
   ADVANCE — next match, next round, or the champion
   ------------------------------------------------------------------ */

async function advance(
  supabase: Client,
  room: AuxRoom
): Promise<Pick<CallResult, "champion" | "finished">> {
  const { data } = await supabase
    .from("aux_matches")
    .select("*")
    .eq("room_id", room.id)
    .order("round", { ascending: true })
    .order("position", { ascending: true });
  const matches = (data ?? []) as unknown as AuxMatch[];
  const lastRound = matches.reduce((n, m) => Math.max(n, m.round), 0);
  const thisRound = matches.filter((m) => m.round === lastRound);

  const pending = thisRound.find((m) => m.status === "pending");
  if (pending) {
    await goLive(supabase, room, pending);
    return {};
  }
  if (thisRound.some((m) => m.status === "live")) return {};

  const winners = thisRound
    .map((m) => m.winner_id)
    .filter((id): id is string => !!id);

  if (winners.length <= 1) {
    const champion = winners[0] ?? null;
    const { error } = await supabase
      .from("aux_rooms")
      .update({
        status: "finished",
        champion_id: champion,
        current_game_id: null,
        finished_at: new Date().toISOString(),
      } as never)
      .eq("id", room.id);
    if (error) throw new AuxError(`Couldn't crown the champion: ${error.message}`, 500);
    return { champion, finished: true };
  }

  const nextRound = await createRound(supabase, room, lastRound + 1, winners);
  const firstReal = nextRound.find((m) => !m.is_bye);
  if (!firstReal) {
    // Only possible with one winner, handled above — but never hang.
    throw new AuxError("The next round has nobody to play.", 500);
  }
  await goLive(supabase, room, firstReal);
  return {};
}

/* ------------------------------------------------------------------
   END — the host pulls the plug (no champion)
   ------------------------------------------------------------------ */

export async function endRoom(supabase: Client, room: AuxRoom): Promise<void> {
  if (room.status === "finished") return;
  const { error } = await supabase
    .from("aux_rooms")
    .update({ status: "finished", current_game_id: null, finished_at: new Date().toISOString() } as never)
    .eq("id", room.id);
  if (error) throw new AuxError(`Couldn't end the battle: ${error.message}`, 500);
}
