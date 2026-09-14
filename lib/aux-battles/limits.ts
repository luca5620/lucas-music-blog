/**
 * Aux battle lobby caps (Luca 2026-09-14). No imports on purpose, so
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
