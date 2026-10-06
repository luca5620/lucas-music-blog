/**
 * First-run onboarding — "is this a brand-new account that should see
 * /start?" in ONE place.
 *
 * Why this file exists (2026-10-05): 36 people signed up in 30 days
 * and only 7 ever posted a review. The home page promises "your first
 * rating takes two taps", so a new account now lands on /start — rate
 * three records you already know — exactly once.
 *
 * Every sign-in path asks the same question, and they must never
 * drift apart (same lesson as OAuthButtons.finish ↔ /auth/callback):
 *   - app/auth/callback/route.ts       Google/Apple on the web (server)
 *   - components/auth/OAuthButtons.tsx Google/Apple inside the app
 *   - app/login/page.tsx               email/username + password
 *   - app/welcome/page.tsx             after claiming a social handle
 * Email signup doesn't ask — its confirmation link points straight at
 * /auth/confirm?next=/start (see app/signup/page.tsx).
 *
 * NOT a second way to review (Quick Rate was rejected for exactly
 * that, ROADMAP 2026-09-08). /start is first-run only: it refuses
 * anyone with 3+ published reviews, and nothing links to it once the
 * shelf has a record on it.
 *
 * This module is imported by BOTH server and client code, so it must
 * not import lib/supabase/server.ts (cookies()) or anything
 * browser-only — the caller hands in whichever Supabase client it has.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";

/** The first-rating screen's path. */
export const START_PATH = "/start";

/** How many ratings the screen asks for. */
export const FIRST_RATINGS_GOAL = 3;

/**
 * "This browser already showed /start to this account" — the fallback
 * marker for before migration 056 runs (and a cheap short-circuit
 * after). The VALUE is the user id, so a second account signing in on
 * the same phone still gets its own first run. Not httpOnly on
 * purpose: the in-app OAuth finish reads it from document.cookie, and
 * it holds nothing secret (it only decides which page you land on).
 */
export const ONBOARDED_COOKIE = "pmr_onboarded";

/**
 * Only accounts younger than this are ever routed automatically —
 * the guarantee that a long-standing member who simply never wrote a
 * review is never ambushed by an onboarding screen on sign-in.
 */
const NEW_ACCOUNT_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** Relative same-site paths only — never an open redirect. */
export function safeNextPath(path: string | null | undefined): string {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

/**
 * The /start URL, carrying where to go afterwards. `next` of "/" (the
 * default) is left off so the common URL stays clean.
 */
export function startPath(next: string = "/"): string {
  const safe = safeNextPath(next);
  // Already headed to /start — don't wrap it in itself.
  if (safe === START_PATH || safe.startsWith(`${START_PATH}?`)) return safe;
  return safe === "/" ? START_PATH : `${START_PATH}?next=${encodeURIComponent(safe)}`;
}

/**
 * Pull our cookie's value out of a raw Cookie header / document.cookie
 * string. Tiny hand parser so the same code runs on both sides.
 */
export function readOnboardedCookie(cookieString: string | null | undefined): string | null {
  if (!cookieString) return null;
  for (const part of cookieString.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ONBOARDED_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/** Account created within the new-account window? */
export function isRecentAccount(createdAt: string | null | undefined, now = Date.now()): boolean {
  if (!createdAt) return false;
  const created = new Date(createdAt).getTime();
  return !Number.isNaN(created) && now - created < NEW_ACCOUNT_WINDOW_MS;
}

/**
 * Should this signed-in user be sent to /start right now?
 *
 * ALL of these must hold — and every failure mode answers "no", so the
 * worst case of a hiccup is a skipped onboarding, never a trapped user:
 *   1. this browser hasn't already shown it to them (cookie)
 *   2. the account is less than 7 days old
 *   3. profiles.onboarded_at is NULL (migration 056 — if the column
 *      isn't there yet the select errors and we treat it as NULL,
 *      leaning on 1 + 2 + 4 instead)
 *   4. zero PUBLISHED reviews
 */
export async function needsFirstRating(
  supabase: SupabaseClient<Database>,
  user: { id: string; created_at?: string | null },
  cookieValue: string | null
): Promise<boolean> {
  if (cookieValue === user.id) return false;
  if (!isRecentAccount(user.created_at)) return false;

  try {
    // Typed loosely: onboarded_at is optional on Profile until 056
    // runs, and a missing column comes back as an error, not a throw.
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("onboarded_at")
      .eq("id", user.id)
      .maybeSingle();
    if (!profileError && (profile as { onboarded_at?: string | null } | null)?.onboarded_at) {
      return false;
    }

    const { count, error } = await supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_published", true);
    if (error) return false;
    return (count ?? 0) === 0;
  } catch {
    return false;
  }
}

/**
 * Where a successful sign-in should land: `next`, or /start (carrying
 * `next`) for a brand-new account. Handle-claiming (/welcome) is
 * layered on top by the callers that need it.
 */
export async function destinationAfterSignIn(
  supabase: SupabaseClient<Database>,
  user: { id: string; created_at?: string | null },
  next: string,
  cookieValue: string | null
): Promise<string> {
  const safe = safeNextPath(next);
  return (await needsFirstRating(supabase, user, cookieValue)) ? startPath(safe) : safe;
}
