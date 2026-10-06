/**
 * review-date — which calendar day a review belongs to.
 *
 * THE LOG (the profile calendar) and the "logs completed" stat put a
 * review on its review_date. Until 2026-10-05 the server stamped that
 * with the UTC date, so anyone in the Americas who reviewed in the
 * evening landed on TOMORROW — a whole day of their log could look
 * empty while the next one looked doubled. Now the device sends its
 * own local date ("YYYY-MM-DD", see localDateString below) and the
 * server keeps it.
 *
 * Trust, but check: a device's date can't be more than one day either
 * side of the UTC date (time zones run from UTC−12 to UTC+14), so
 * anything further away — a wrong clock, a hand-crafted request trying
 * to back-fill a month to fake a completed log — is ignored and the
 * UTC date is used instead.
 */

const DAY_MS = 86_400_000;

/** "YYYY-MM-DD" for a Date, read in UTC. */
function utcDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * The date to store for a new review: the device's local date when
 * it's plausible, otherwise today's UTC date. `now` is a parameter
 * only so this is easy to reason about; callers leave it out.
 */
export function reviewDateFrom(localDate: unknown, now: Date = new Date()): string {
  const fallback = utcDateString(now);
  if (typeof localDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    return fallback;
  }
  // Must be a real calendar day (rejects 2026-02-31 and friends).
  const parsed = new Date(`${localDate}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || utcDateString(parsed) !== localDate) {
    return fallback;
  }
  // Within one day of the UTC date.
  const today = new Date(`${fallback}T00:00:00Z`).getTime();
  if (Math.abs(parsed.getTime() - today) > DAY_MS) return fallback;
  return localDate;
}

/**
 * The browser side: today's date on THIS device, as "YYYY-MM-DD".
 * Send it as `local_date` with POST /api/reviews. (Not toISOString —
 * that's UTC, which is the whole bug.)
 */
export function localDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
