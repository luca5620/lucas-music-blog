/**
 * Aux War lobby caps (Luca 2026-09-14) and the idle window (053). No imports on purpose, so
 * the browser and the server read the same numbers — the real wall is
 * the DB trigger in migration 044 (aux_player_cap), this is what the
 * lobby shows and greys out.
 *
 *   bo1 — 32 players. "The biggest the bracket can be will be a round
 *         of 32." Five rounds: 32 → 16 → 8 → 4 → 2.
 *   bo3 — 10 players. Five first-round matches × up to 6 songs each =
 *         30 songs before round two, which is already a long night.
 *
 * Viewers are never capped; this only counts the people in the
 * bracket. Private rooms use the same caps — private only changes WHO
 * can get in (you need the code), never how many.
 */

export const AUX_PLAYER_CAP = { bo1: 32, bo3: 10 } as const;

export function auxPlayerCap(format: "bo1" | "bo3"): number {
  return AUX_PLAYER_CAP[format] ?? AUX_PLAYER_CAP.bo1;
}

/**
 * How long a room can sit with NOTHING happening before it drops off
 * the arena and is auto-finished (migration 053, code review
 * 2026-10-05: an abandoned room used to sit "live" forever). Two
 * hours: a song is three minutes and the chat alone keeps a room
 * awake, so no real war trips it — but a dead one is gone the same
 * evening. MUST match aux_idle_window() in the migration; change both.
 */
export const AUX_IDLE_MS = 2 * 60 * 60 * 1000;

/** True when a room has been quiet longer than AUX_IDLE_MS. Rooms
    from before 053 have no last_activity_at — never idle by this
    test (the SQL idle close still handles them). */
export function auxRoomIsIdle(room: { status: string; last_activity_at?: string | null }, now = Date.now()): boolean {
  if (room.status === "finished" || !room.last_activity_at) return false;
  return now - Date.parse(room.last_activity_at) > AUX_IDLE_MS;
}
