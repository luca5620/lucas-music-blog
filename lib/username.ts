/**
 * Username rules — one copy, three screens.
 *
 * /signup, the social-login /welcome step and settings all ask
 * someone to pick a handle, and Postgres is the real judge (the
 * charset constraint from migration 006, the reserved list from
 * 028's trigger). Keeping the client-side mirror of those rules in
 * one file means the three UIs can't drift apart from each other —
 * or from the database.
 */

/** Matches the DB constraint exactly. We lowercase as people type. */
export const USERNAME_REGEX = /^[a-z0-9_]{3,20}$/;

/** Names that would let someone impersonate the platform or staff.
    Same list the 028 trigger raises USERNAME_RESERVED for. */
export const RESERVED_USERNAMES = new Set([
  "admin", "peak", "mod", "moderator", "staff", "support",
  "api", "root", "system", "official", "help",
]);

/**
 * Format check for a handle someone typed. Returns the message to
 * show, or null when the format is fine (availability is a separate,
 * async question — see the ilike lookup the signup/welcome pages do).
 */
/**
 * LANGUAGES: the same checks as usernameFormatError, answered as a KEY
 * into messages → "auth.signup" (min3 / max20 / charset / reserved) so
 * a client page can show the line in the visitor's language. Keep the
 * two in step.
 */
export type UsernameFormatErrorKey = "min3" | "max20" | "charset" | "reserved";

export function usernameFormatErrorKey(value: string): UsernameFormatErrorKey | null {
  const lower = value.toLowerCase();
  if (lower.length === 0) return null;
  if (lower.length < 3) return "min3";
  if (lower.length > 20) return "max20";
  if (!USERNAME_REGEX.test(lower)) return "charset";
  if (RESERVED_USERNAMES.has(lower)) return "reserved";
  return null;
}

export function usernameFormatError(value: string): string | null {
  const lower = value.toLowerCase();
  if (lower.length === 0) return null;
  if (lower.length < 3) return "Username must be at least 3 characters";
  if (lower.length > 20) return "Username must be 20 characters or fewer";
  if (!USERNAME_REGEX.test(lower)) return "Letters, numbers, and underscores only";
  if (RESERVED_USERNAMES.has(lower)) return "That name is reserved";
  return null;
}

/**
 * Turn an email address or a real name into a legal handle — the
 * starting suggestion on the social-login welcome screen, where
 * nobody typed a username at any point (Google sends a name, Apple
 * usually sends nothing but a private relay address).
 *
 * Returns "" when there's nothing usable to work with, which the
 * caller shows as an empty box rather than a bad guess.
 */
export function suggestUsername(seed: string): string {
  const base = seed.includes("@") ? seed.split("@")[0] : seed;
  const cleaned = base
    .toLowerCase()
    .replace(/[\s.\-+]+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
  return cleaned.length >= 3 && !RESERVED_USERNAMES.has(cleaned) ? cleaned : "";
}
