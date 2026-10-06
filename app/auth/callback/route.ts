import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import {
  destinationAfterSignIn,
  ONBOARDED_COOKIE,
} from "@/lib/onboarding";

/**
 * GET /auth/callback — where Google/Apple sign-ins come back to.
 *
 * The provider redirects to Supabase, Supabase redirects here with a
 * PKCE `code`; exchanging it sets the session cookies. Then one extra
 * decision that email signup doesn't need: a social account arrives
 * with a handle we INVENTED from its email (see migration 031), so if
 * profiles.username_auto is set we send them to /welcome to claim a
 * real one before they land on the site.
 *
 * And a second one (2026-10-05): a BRAND-NEW account goes to /start
 * — the first-rating screen — before `next`. The rule lives in
 * lib/onboarding.ts (needsFirstRating) and is shared with the in-app
 * finish in components/auth/OAuthButtons.tsx; when both apply the
 * order is /welcome → /start → next.
 *
 * Email confirmation links keep using /auth/confirm — that route
 * handles token_hash links too, which arrive in whatever browser the
 * inbox opened.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Relative same-site paths only — never an open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";
  // The provider's own failure (usually "user pressed cancel").
  const providerError =
    searchParams.get("error_description") ?? searchParams.get("error");

  const bounce = (path: string) => NextResponse.redirect(new URL(path, request.url));

  if (providerError || !code) {
    // Nothing to exchange. Back to sign-in with a note the page shows;
    // a plain cancel is silent (no error param on the way out).
    return bounce(
      `/login${providerError && !/access_denied/i.test(providerError) ? "?error=oauth" : ""}`
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    return bounce("/login?error=oauth");
  }

  // Fresh social account → pick a handle first. The profile row is
  // created synchronously by the signup trigger, so it's already
  // there. Guarded: until migration 031 runs the column doesn't
  // exist, the select errors, and we just carry on to `next`.
  const { data: profile } = await supabase
    .from("profiles")
    .select("username_auto")
    .eq("id", data.user.id)
    .maybeSingle();

  // Brand-new account → the first-rating screen, once. Decided here
  // (not on /welcome) so the whole chain is built in one place:
  // /welcome?next=/start?next=<next>. Fails soft to plain `next`.
  const destination = await destinationAfterSignIn(
    supabase,
    data.user,
    safeNext,
    request.cookies.get(ONBOARDED_COOKIE)?.value ?? null
  );

  if ((profile as Pick<Profile, "username_auto"> | null)?.username_auto) {
    return bounce(`/welcome?next=${encodeURIComponent(destination)}`);
  }

  return bounce(destination);
}
