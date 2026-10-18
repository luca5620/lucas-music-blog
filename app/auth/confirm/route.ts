import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types/database";
import { destinationAfterSignIn, ONBOARDED_COOKIE } from "@/lib/onboarding";

/**
 * GET /auth/confirm — where auth email links land.
 *
 * Two shapes, both supported:
 *  - token_hash + type  → verifyOtp. Comes from email templates using
 *    {{ .TokenHash }} — works in ANY browser, which matters because
 *    "reset password" is tapped in the app but the email link opens
 *    in Safari.
 *  - code               → PKCE exchange. Comes from Supabase's default
 *    {{ .ConfirmationURL }} templates with a redirect_to pointing
 *    here. Same-browser only (the code verifier lives in a cookie set
 *    when the email was requested).
 *
 * On success the session cookies are set and we bounce to ?next=
 * (recovery links use /reset-password; signup links use /start, the
 * first-rating screen — 2026-10-05). Because this is a SERVER
 * redirect, the very first page render already sees the session — the
 * old "/?code=" signup link left the new member looking logged out.
 * On failure we still land on `next` with ?error=link so the page can
 * offer a fresh start (/start passes it on to /login, which explains).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";
  // Relative same-site paths only — never an open redirect.
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  const supabase = await createClient();

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url));
    }
  } else if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      // Recovery (reset-password) links go exactly where they asked.
      if (safeNext.startsWith("/reset-password")) {
        return NextResponse.redirect(new URL(safeNext, request.url));
      }
      // Anything else that exchanged a code here may be a brand-new
      // account — an email signup, OR a Google/Apple sign-in that
      // Supabase sent to the home page (src=root, see lib/supabase/
      // middleware.ts). Same decisions as /auth/callback (2026-10-18):
      // a fresh invented social handle → /welcome first, a brand-new
      // account → /start, everyone else straight on.
      const destination = await destinationAfterSignIn(
        supabase,
        data.user,
        safeNext,
        request.cookies.get(ONBOARDED_COOKIE)?.value ?? null
      );
      const { data: profile } = await supabase
        .from("profiles")
        .select("username_auto")
        .eq("id", data.user.id)
        .maybeSingle();
      const target = (profile as Pick<Profile, "username_auto"> | null)?.username_auto
        ? `/welcome?next=${encodeURIComponent(destination)}`
        : destination;
      return NextResponse.redirect(new URL(target, request.url));
    }
  }

  // A code from the home-page fallback that couldn't be used is far
  // more likely a social sign-in that started in another browser (the
  // app's Safari sheet) than an emailed link — say "sign-in didn't go
  // through, try again" (/login?error=oauth) rather than talk about a
  // link the person never clicked.
  if (code && searchParams.get("src") === "root") {
    return NextResponse.redirect(new URL("/login?error=oauth", request.url));
  }

  const failed = new URL(safeNext, request.url);
  failed.searchParams.set("error", "link");
  return NextResponse.redirect(failed);
}
