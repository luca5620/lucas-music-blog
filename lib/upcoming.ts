/**
 * Upcoming-release date helpers.
 *
 * THE TIMEZONE RULE (Luca 2026-08-26): music drops at MIDNIGHT
 * EASTERN (US release convention — Spotify/Apple flip at 12:00 AM
 * ET), so every countdown and every "is it out yet?" check in the
 * app anchors to 00:00 America/New_York on release day — never UTC
 * midnight (that made clocks run 4–5 hours ahead). DST is handled
 * (EDT −4 / EST −5 picked per-date via Intl), and ANY new feature
 * that needs "when does it drop" must call easternMidnightUtcMs /
 * isUpcoming from this file instead of rolling its own date math.
 *
 * Dates in the catalog are plain YYYY-MM-DD strings. These helpers
 * run on both server (Vercel, full ICU) and client (browsers ship
 * Intl with timezone data).
 */

/**
 * The exact UTC timestamp (ms) of midnight Eastern on the given
 * date — i.e. the moment the release actually drops. Tries both
 * possible Eastern offsets and keeps the one that really lands on
 * 00:00 of that date in America/New_York, so DST just works.
 * Returns NaN for unparseable input.
 */
export function easternMidnightUtcMs(
  releaseDate: string | null | undefined
): number {
  if (!releaseDate || releaseDate.length < 10) return NaN;
  const day = releaseDate.slice(0, 10);

  for (const offset of ["-04:00", "-05:00"]) {
    const ts = Date.parse(`${day}T00:00:00${offset}`);
    if (Number.isNaN(ts)) return NaN;
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/New_York",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(ts);
    const get = (type: string) =>
      parts.find((p) => p.type === type)?.value ?? "";
    const rendered = `${get("year")}-${get("month")}-${get("day")}`;
    if (rendered === day && get("hour") === "00") return ts;
  }
  // Fallback (should never hit for a valid date): EST offset.
  return Date.parse(`${day}T00:00:00-05:00`);
}

/* ------------------------------------------------------------------
   NOT EVERYTHING DROPS AT MIDNIGHT EASTERN (Luca 2026-10-25: ILLIT's
   BREAK EVEN said "out now" at midnight ET but K-pop comes out at 6pm
   Korea time, 5am ET). Migration 064 gives each release two facts,
   filled in every 5 minutes by the drop-check edge function:
     drops_at         THE EXACT DROP MOMENT. Spotify's embed page
                      carries it for every pre-release record
                      (releaseDate.isoString — "2026-10-26T09:00:00Z"
                      for BREAK EVEN, 05:00Z = midnight ET for US
                      records), so countdowns run to the real second
                      (Luca 2026-10-26: "why not just have the accurate
                      countdown?"). When there's no time on the embed,
                      it's the moment Spotify was first seen playing it.
     drop_waiting_at  the last time the check found it NOT out yet —
                      only used when drops_at is unknown
   No drops_at → midnight Eastern stays the default; after it, a fresh
   "not out yet" report holds it back, and if the checker stops
   reporting (30 minutes of silence) or a whole day passes it falls
   back to the old midnight rule.
   Every helper below takes the row's DropInfo as an optional second
   argument; without it they behave exactly like before.
   ------------------------------------------------------------------ */

/** The two drop facts from migration 064 (any release row has them). */
export interface DropInfo {
  drops_at?: string | null;
  drop_waiting_at?: string | null;
}

/** A "not out yet" report older than this no longer counts. */
const WAITING_FRESH_MS = 30 * 60_000;
/** Reports from just before midnight ET count (the checker runs every 5 min). */
const WAITING_EARLY_MS = 15 * 60_000;
/** An exact time this far from the release date's midnight ET is
    ignored (the date was moved and the row is stale). */
const EXACT_SLACK_MS = 36 * 3_600_000;

/** The row's exact drop moment (ms), or NaN when there isn't a
    believable one. */
function exactDropMs(
  releaseDate: string | null | undefined,
  drop?: DropInfo | null
): number {
  const at = drop?.drops_at ? Date.parse(drop.drops_at) : NaN;
  if (Number.isNaN(at)) return NaN;
  const midnight = easternMidnightUtcMs(releaseDate);
  if (!Number.isNaN(midnight) && Math.abs(at - midnight) > EXACT_SLACK_MS) return NaN;
  return at;
}

/**
 * Past midnight Eastern on release day, but not out yet — "out later
 * today". Either the exact time is still ahead (BREAK EVEN between
 * midnight and 5am ET), or, with no exact time, Spotify said "not
 * playable" in the last 30 minutes. Can only DELAY "out now".
 */
export function isWaitingForDrop(
  releaseDate: string | null | undefined,
  drop?: DropInfo | null
): boolean {
  const midnight = easternMidnightUtcMs(releaseDate);
  if (Number.isNaN(midnight) || !drop) return false;
  const now = Date.now();
  const exact = exactDropMs(releaseDate, drop);
  if (!Number.isNaN(exact)) return now >= midnight && now < exact;
  if (!drop.drop_waiting_at) return false;
  const waited = Date.parse(drop.drop_waiting_at);
  if (Number.isNaN(waited)) return false;
  return (
    now >= midnight &&
    now < midnight + 86_400_000 && // a full day late → give up waiting
    waited >= midnight - WAITING_EARLY_MS &&
    now - waited < WAITING_FRESH_MS
  );
}

/** The moment a countdown should run to: the exact drop time when we
 *  know it, otherwise midnight Eastern. */
export function dropMomentMs(
  releaseDate: string | null | undefined,
  drop?: DropInfo | null
): number {
  const exact = exactDropMs(releaseDate, drop);
  return Number.isNaN(exact) ? easternMidnightUtcMs(releaseDate) : exact;
}

/** True when the release hasn't dropped yet. */
export function isUpcoming(
  releaseDate: string | null | undefined,
  drop?: DropInfo | null
): boolean {
  const target = dropMomentMs(releaseDate, drop);
  if (Number.isNaN(target)) return false;
  return target > Date.now() || isWaitingForDrop(releaseDate, drop);
}

/** True once the drop moment has passed — the mirror of isUpcoming,
 *  minus the "unparseable date" case (a missing date never counts as
 *  dropped). */
export function hasDropped(
  releaseDate: string | null | undefined,
  drop?: DropInfo | null
): boolean {
  const target = dropMomentMs(releaseDate, drop);
  return !Number.isNaN(target) && !isUpcoming(releaseDate, drop);
}

/**
 * How long a release lingers on the Dropping Soon shelf AFTER it
 * drops (Luca 2026-09-02). Before this, a release vanished from the
 * shelf the instant the clock hit zero, so a drop everyone was
 * waiting for disappeared at exactly the moment people came looking
 * for it. 24 hours of "OUT NOW", then it lives in Recent only —
 * bounded, so the shelf stays room for what's actually coming.
 */
export const DROP_GRACE_MS = 86_400_000;

/**
 * True while a release belongs on the Dropping Soon shelf: still
 * upcoming, OR dropped less than DROP_GRACE_MS ago.
 *
 * Note the window lines up exactly with the Eastern calendar day:
 * the drop is 00:00 ET on release day and the grace runs to 00:00 ET
 * the next day, so "eligible" == release_date >= today in ET. That's
 * why the SQL side can still filter on todayEastern() alone.
 */
export function isDroppingSoonEligible(
  releaseDate: string | null | undefined
): boolean {
  const target = easternMidnightUtcMs(releaseDate);
  return !Number.isNaN(target) && Date.now() < target + DROP_GRACE_MS;
}

/**
 * Whole days (rounded up) from now until the drop moment.
 * Returns null when the date is missing or already past.
 */
export function daysUntil(
  releaseDate: string | null | undefined,
  drop?: DropInfo | null
): number | null {
  const target = dropMomentMs(releaseDate, drop);
  if (Number.isNaN(target) || target <= Date.now()) return null;
  return Math.ceil((target - Date.now()) / 86_400_000);
}

/** "in 10 days" / "tomorrow" — countdown phrasing for UI. */
export function dropsInLabel(releaseDate: string | null | undefined): string | null {
  const days = daysUntil(releaseDate);
  if (days === null) return null;
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** "Sep 4, 2026" — the drop date, formatted like the site's other dates. */
export function formatDropDate(releaseDate: string | null | undefined): string | null {
  if (!releaseDate || releaseDate.length < 10) return null;
  const parsed = new Date(`${releaseDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * UTC ms of the most recent Friday 00:00 Eastern — the reset moment
 * for the Social page's "Top Reviews This Week" chart (Luca
 * 2026-08-31: likes received since Friday, any-age reviews qualify).
 * On a Friday the week started TODAY at midnight ET. Same Eastern
 * anchor as release drops — one timezone rule everywhere.
 */
export function lastFridayEasternUtcMs(): number {
  const today = todayEastern(); // YYYY-MM-DD as it reads in ET
  // Weekday of that calendar date (UTC-noon parse = DST-safe).
  const noonUtc = Date.parse(`${today}T12:00:00Z`);
  const weekday = new Date(noonUtc).getUTCDay(); // 0 Sun … 5 Fri
  const daysBack = (weekday - 5 + 7) % 7;
  const friday = new Date(noonUtc - daysBack * 86_400_000)
    .toISOString()
    .slice(0, 10);
  return easternMidnightUtcMs(friday);
}

/** Today's date (YYYY-MM-DD) in Eastern time — for SQL date filters. */
export function todayEastern(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
