/**
 * Upcoming-release date helpers.
 *
 * A release is "upcoming" when its release_date is strictly after
 * today (UTC). Dates in the catalog are plain YYYY-MM-DD strings, so
 * all comparisons happen on date strings / UTC midnights — no
 * timezone math, no Date-parsing surprises. The moment the calendar
 * flips past release day, every countdown UI disappears on its own.
 */

/** Today as a YYYY-MM-DD string (UTC). */
export function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

/** True when the release date is in the future (strictly after today). */
export function isUpcoming(releaseDate: string | null | undefined): boolean {
  if (!releaseDate || releaseDate.length < 10) return false;
  return releaseDate.slice(0, 10) > todayUtc();
}

/**
 * Whole days from today until the release date (1 = tomorrow).
 * Returns null when the date is missing or not in the future.
 */
export function daysUntil(releaseDate: string | null | undefined): number | null {
  if (!isUpcoming(releaseDate)) return null;
  const target = Date.parse(`${releaseDate!.slice(0, 10)}T00:00:00Z`);
  const today = Date.parse(`${todayUtc()}T00:00:00Z`);
  if (Number.isNaN(target)) return null;
  return Math.round((target - today) / 86_400_000);
}

/** "in 10 days" / "tomorrow" / "today" — countdown phrasing for UI. */
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
