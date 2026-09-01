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

/** True when the release hasn't dropped yet (now < midnight ET). */
export function isUpcoming(releaseDate: string | null | undefined): boolean {
  const target = easternMidnightUtcMs(releaseDate);
  return !Number.isNaN(target) && target > Date.now();
}

/**
 * Whole days (rounded up) from now until the drop moment.
 * Returns null when the date is missing or already past.
 */
export function daysUntil(releaseDate: string | null | undefined): number | null {
  const target = easternMidnightUtcMs(releaseDate);
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
