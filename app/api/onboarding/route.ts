import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";

/**
 * POST /api/onboarding — "this member has now SEEN the first-rating
 * screen". No body.
 *
 * /start calls it the moment it opens, so a skip, a closed tab or a
 * dead battery all still count: the automatic routing in
 * lib/onboarding.ts (needsFirstRating) is meant to fire exactly ONCE
 * per account, never on every sign-in until someone rates something.
 *
 * Two markers, written together:
 *  1. profiles.onboarded_at = now() — the real one, follows the
 *     account across devices. Migration 056. If the column doesn't
 *     exist yet, Postgres answers with an error and we simply carry
 *     on with marker 2 (the response says which ones stuck).
 *  2. the pmr_onboarded cookie (value = user id) — covers this
 *     browser before 056 runs, and saves a query after.
 *
 * Same API contract as every mutation route: the user comes from the
 * session (never the body), and it's rate limited. RLS is the real
 * boundary — "Users can update their own profile" only lets a member
 * touch their own row.
 */
export async function POST() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // It's called once per /start visit — 10 a minute is plenty and
  // keeps a reload loop from hammering the profiles table.
  const limited = await rateLimit(`onboarding:${user.id}`, 10, 60_000);
  if (limited) return limited;

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    // Only stamp the FIRST time — `is null` keeps the original date
    // if they come back via the home page's first-run button.
    // @ts-expect-error — Supabase Relationships type narrowing (same as /welcome)
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", user.id)
    .is("onboarded_at", null);

  const res = NextResponse.json({ ok: true, stored: error ? "cookie" : "profile+cookie" });
  res.cookies.set(ONBOARDED_COOKIE, user.id, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year — the 7-day window is long over by then
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    // Readable by JS on purpose — see ONBOARDED_COOKIE in lib/onboarding.
    httpOnly: false,
  });
  return res;
}
