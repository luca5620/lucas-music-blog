/**
 * The Aux War engine — SERVER ONLY. Since migration 053 this file is
 * a thin wrapper: every bracket move is ONE Postgres function that
 * runs as a single transaction with the room row locked, and this
 * file just calls it and turns its error codes into HTTP answers.
 *
 * WHY IT MOVED INTO THE DATABASE (code review, 2026-10-05). The old
 * engine lived here as a string of small writes — mark the game done,
 * bump the match, open the next game, point the room at it — each its
 * own request, most of them ignoring errors. Two things went wrong:
 *   1. If step 3 failed, step 1 had already happened, so every retry
 *      said "already called" and the room was stuck for good.
 *   2. "Call it" acted on whatever game was current. A stale tab or
 *      the host's second phone could call the NEXT game while it was
 *      still picking — which counts as a forfeit — and hand a match
 *      to side A.
 * In Postgres the whole move is all-or-nothing, and the screen now
 * says WHICH game and WHICH phase it was looking at; if either moved
 * on, the function refuses and the API answers 409.
 *
 * The bracket, in plain words (Luca 2026-09-13), unchanged:
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
 * Fair play (053): when the host PLAYS and has to make a call in their
 * own match (forfeit, nobody voted, a second tie) they still can — a
 * room must never get stuck — but if they hand the game to
 * themselves, that match is marked self_decided and their win from it
 * counts nowhere. See supabase/migrations/053-aux-wars-engine.sql.
 */

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

type Client = SupabaseClient<Database>;

export class AuxError extends Error {
  status: number;
  /** True when the screen was out of date — the client should resync. */
  stale: boolean;
  constructor(message: string, status = 400, stale = false) {
    super(message);
    this.status = status;
    this.stale = stale;
  }
}

/**
 * The codes the 053 functions raise, and what the person sees. The
 * functions say WHAT went wrong in one word; the words a human reads
 * live here, next to the HTTP status that goes with them.
 */
const CODES: Record<string, { message: string; status: number; stale?: boolean }> = {
  AUTH_REQUIRED: { message: "Sign in first.", status: 401 },
  NO_ROOM: { message: "Room not found.", status: 404 },
  NOT_HOST: { message: "Only the host can do that.", status: 403 },
  NOT_LIVE: { message: "Nothing is playing right now.", status: 409, stale: true },
  STALE_GAME: {
    message: "The room moved on since your screen last updated. It's caught up now — check it and tap again.",
    status: 409,
    stale: true,
  },
  STALE_PHASE: {
    message: "That game changed phase while you were looking. It's caught up now — check it and tap again.",
    status: 409,
    stale: true,
  },
  NO_GAME: { message: "The game is gone.", status: 404, stale: true },
  NO_MATCH: { message: "Couldn't find a match to play.", status: 500 },
  NEED_SIDE: { message: "Pick who wins.", status: 400 },
  BAD_SIDE: { message: 'side must be "a" or "b".', status: 400 },
  BAD_PHASE: { message: "Unknown phase.", status: 400 },
  ALREADY_STARTED: { message: "This Aux War already started.", status: 409, stale: true },
  NEED_PLAYERS: { message: "You need at least two players to start.", status: 400 },
  ROOM_FULL: { message: "The lobby is full — make room for yourself or switch off playing.", status: 409 },
  BAD_TOPIC: { message: "Topic must be 3–120 characters.", status: 400 },
  SONGS_ON: { message: "Songs are already on for this topic.", status: 409, stale: true },
};

/** Turn a failed rpc into an AuxError the route can send back as-is. */
function toAuxError(error: PostgrestError, fallback: string): AuxError {
  // The function isn't there: this code is deployed but migration 053
  // hasn't been run yet. Say so plainly instead of a raw 404.
  if (error.code === "PGRST202" || /could not find the function/i.test(error.message)) {
    return new AuxError("Aux Wars is being updated — try again in a minute.", 503);
  }
  // `raise exception 'STALE_GAME'` arrives as message "STALE_GAME".
  const code = Object.keys(CODES).find((c) => error.message?.includes(c));
  if (code) {
    const { message, status, stale } = CODES[code];
    return new AuxError(message, status, !!stale);
  }
  console.error(`aux engine: ${fallback}:`, error.message);
  return new AuxError(fallback, 500);
}

/* ------------------------------------------------------------------
   START — draw round 1, put the first match on air
   ------------------------------------------------------------------ */

export async function startRoom(supabase: Client, roomId: string): Promise<void> {
  const { error } = await supabase.rpc("aux_start_room", { p_room_id: roomId } as never);
  if (error) throw toAuxError(error, "Couldn't start the Aux War.");
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

/**
 * gameId + phase are what the HOST'S SCREEN showed when they tapped.
 * If the room has moved past either, nothing happens and the route
 * answers 409 (stale) so the screen resyncs.
 *
 * side: required while picking (the forfeit), in a host-judged room,
 * and when the crowd needs the host (no votes / second tie). Ignored
 * when the crowd has a clear majority — the host can't overrule it.
 */
export async function callGame(
  supabase: Client,
  roomId: string,
  gameId: string,
  phase: "picking" | "listening",
  side: "a" | "b" | null
): Promise<CallResult> {
  const { data, error } = await supabase.rpc("aux_call_game", {
    p_room_id: roomId,
    p_game_id: gameId,
    p_phase: phase,
    p_side: side,
  } as never);
  if (error) throw toAuxError(error, "Couldn't call it. Try again.");
  return (data ?? {}) as CallResult;
}

/* ------------------------------------------------------------------
   TOPIC — the host names this round's (or this game's) topic
   ------------------------------------------------------------------ */

export async function setTopic(
  supabase: Client,
  roomId: string,
  gameId: string | null,
  topic: string
): Promise<{ topic: string; round: number; perGame: boolean }> {
  const { data, error } = await supabase.rpc("aux_set_topic", {
    p_room_id: roomId,
    p_game_id: gameId,
    p_topic: topic,
  } as never);
  if (error) throw toAuxError(error, "Couldn't set the topic. Try again.");
  return data as { topic: string; round: number; perGame: boolean };
}

/* ------------------------------------------------------------------
   END — the host pulls the plug (no champion)
   ------------------------------------------------------------------ */

export async function endRoom(supabase: Client, roomId: string): Promise<void> {
  const { error } = await supabase.rpc("aux_end_room", { p_room_id: roomId } as never);
  if (error) throw toAuxError(error, "Couldn't end the Aux War.");
}
