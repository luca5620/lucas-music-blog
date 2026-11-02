/**
 * season — is it Christmas on Peak Music right now?
 *
 * The 2026 holiday look (Luca, 2026-11-02): falling snow across the
 * site, a Santa hat on the header penguin, string lights along the top
 * of the header, and the Rewind card wrapped like a plain present.
 * Picked as a mix of four mockups ("everything else i didnt mention
 * dont add"); the canvas is linked from ROADMAP.md.
 *
 * WHEN: live from the moment it shipped (early November — Luca: "the
 * christmas stuff should be live now") through **December 30, 2026**.
 * It switches itself OFF at midnight US Eastern going into Dec 31 — no
 * push needed, which matters because `main` is frozen while the 1.3
 * build is in App Review.
 *
 * HOW: app/layout.tsx asks this once per request and, when it's on,
 * adds the `xmas` class to <html> and renders <Snowfall />. Every
 * other piece (the hat, the lights, the gift wrap) is markup that is
 * always there but only displayed under `html.xmas` (globals.css,
 * "CHRISTMAS 2026"). So turning the season off is this one function
 * returning false — nothing else to unpick.
 *
 * Next year: change the two dates (or replace them with a yearly rule)
 * and review the look; nothing else is year-specific.
 */

/** First moment of the season: Nov 1, 2026, 00:00 US Eastern (EDT, UTC−4). */
const SEASON_START = Date.UTC(2026, 10, 1, 4, 0, 0);
/** First moment AFTER the season: Dec 31, 2026, 00:00 US Eastern (EST, UTC−5). */
const SEASON_END = Date.UTC(2026, 11, 31, 5, 0, 0);

/** True while the Christmas look should show. `now` is a parameter only for testing. */
export function isChristmasSeason(now: number = Date.now()): boolean {
  return now >= SEASON_START && now < SEASON_END;
}
