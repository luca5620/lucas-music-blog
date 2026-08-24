import { NextRequest, NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

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
 * (recovery links use /reset-password). On failure we still land on
 * `next` with ?error=link so the page can offer a fresh start.
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
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url));
    }
  }

  const failed = new URL(safeNext, request.url);
  failed.searchParams.set("error", "link");
  return NextResponse.redirect(failed);
}
