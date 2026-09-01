import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";

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

  if ((profile as Pick<Profile, "username_auto"> | null)?.username_auto) {
    return bounce(`/welcome?next=${encodeURIComponent(safeNext)}`);
  }

  return bounce(safeNext);
}
