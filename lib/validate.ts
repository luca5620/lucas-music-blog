/**
 * Shared input-validation helpers for API routes.
 * Every value that arrives in a request body is untrusted — these helpers
 * make the checks short to write so no route skips them.
 */

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True if the value is a well-formed UUID string. */
export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** True if the value is a URL-safe slug (lowercase letters, digits, hyphens). */
export function isSafeSlug(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9-]{1,120}$/.test(value);
}

/** True if the value is a non-empty string no longer than max. */
export function isText(value: unknown, max: number): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

/** True for null/undefined OR a string within max length. */
export function isOptionalText(value: unknown, max: number): boolean {
  return value == null || (typeof value === "string" && value.length <= max);
}

/** True if value is an https:// URL (or a local /path). Blocks javascript: etc. */
export function isSafeUrl(value: unknown): value is string {
  if (typeof value !== "string") return false;
  return value.startsWith("https://") || value.startsWith("/");
}

/** True for null/undefined OR a safe URL. */
export function isOptionalSafeUrl(value: unknown): boolean {
  return value == null || value === "" || isSafeUrl(value);
}

/** True if value is a YYYY-MM-DD date string that parses to a real date. */
export function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(value + "T00:00:00Z").getTime());
}

/** Parse a rating: number 0–10, rounded to one decimal. Returns null if invalid. */
export function parseRating(value: unknown): number | null {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n !== "number" || Number.isNaN(n) || n < 0 || n > 10) return null;
  return Math.round(n * 10) / 10;
}

export interface StandoutTrack {
  title: string;
  spotifyUrl: string;
}

/**
 * Validate the standout_tracks array on reviews. Each entry must be
 * { title, spotifyUrl } with an https://open.spotify.com/ link — these are
 * rendered as <a href>, so anything else (e.g. javascript:) is an XSS risk.
 */
export function parseStandoutTracks(value: unknown): StandoutTrack[] | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 20) return null;
  const result: StandoutTrack[] = [];
  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      typeof (item as StandoutTrack).title !== "string" ||
      typeof (item as StandoutTrack).spotifyUrl !== "string"
    ) {
      return null;
    }
    const { title, spotifyUrl } = item as StandoutTrack;
    if (title.length === 0 || title.length > 200) return null;
    if (!spotifyUrl.startsWith("https://open.spotify.com/")) return null;
    result.push({ title, spotifyUrl });
  }
  return result;
}
