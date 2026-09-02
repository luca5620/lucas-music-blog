/**
 * Date display helpers (Luca 2026-09-02: "get rid of the 2026-01-01
 * thing, just have it say Sept 2, 2026 — doesn't confuse people who
 * are used to different calendar orders").
 *
 * Deliberately NOT toLocaleDateString with the visitor's locale: that
 * reintroduces exactly the confusion we're removing (2/9 vs 9/2 by
 * region). One explicit, unambiguous format for everyone, web and app.
 *
 * Month names are AP-style abbreviations — "Sept" for September, the
 * spelling Luca asked for — held in an array rather than Intl so the
 * output can't drift with the device's locale.
 */

const MONTHS = [
  "Jan", "Feb", "March", "April", "May", "June",
  "July", "Aug", "Sept", "Oct", "Nov", "Dec",
] as const;

/**
 * "Sept 2, 2026" from either a date-only string ("2026-09-02") or a
 * full timestamp. Returns null for anything unparseable, so callers
 * can decide what to render instead of printing "Invalid Date".
 *
 * WHY the date-only branch parses by hand: `new Date("2026-09-02")` is
 * spec'd as UTC midnight, so formatting it in any negative-offset zone
 * (Pacific, where the owner is) yields the PREVIOUS day. Splitting the
 * string keeps a calendar date a calendar date, with no timezone in
 * the middle of it. Full timestamps are a real instant, so those are
 * correctly rendered in local time.
 */
export function formatDate(value: string | null | undefined): string | null {
  if (!value) return null;

  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const monthName = MONTHS[Number(month) - 1];
    if (!monthName) return null;
    return `${monthName} ${Number(day)}, ${year}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${MONTHS[parsed.getMonth()]} ${parsed.getDate()}, ${parsed.getFullYear()}`;
}
