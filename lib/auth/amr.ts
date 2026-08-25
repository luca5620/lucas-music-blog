/**
 * AMR ("Authentication Methods References") helpers — how we know
 * WHAT kind of login produced the current session.
 *
 * Supabase stamps every access token with an `amr` claim: a list of
 * the auth methods the session went through, e.g.
 *   [{ "method": "password", "timestamp": 1724500000 }]
 * A password-only session says exactly that. A session that went
 * through the emailed 6-digit code (or clicked the emailed link, or
 * the password-recovery link — all of which prove control of the
 * inbox) carries "otp" / "magiclink" / "recovery" instead.
 *
 * Admin tools require one of those email-proven methods (Luca
 * 2026-08-25): a stolen password alone must never be enough to
 * moderate, grant badges, or import. The login page sends admins the
 * code; this helper is how the middleware and the /api/admin routes
 * VERIFY it. The same rule is enforced a third time inside Postgres
 * (migration 021) so even direct Supabase API calls can't skip it.
 */

/** Auth methods that prove the user controls the account's inbox. */
const EMAIL_PROVEN_METHODS = ["otp", "magiclink", "recovery"];

/** One entry of the token's `amr` claim. */
interface AmrEntry {
  method?: string;
}

/**
 * Did this session go through an email code (or emailed link)?
 *
 * We only DECODE the token here, we don't verify its signature —
 * that's fine, because every caller already authenticated the
 * session via supabase.auth.getUser() first; this just reads how
 * that (already trusted) session was created.
 */
export function sessionUsedEmailCode(accessToken?: string | null): boolean {
  if (!accessToken) return false;

  try {
    // A JWT is three base64url segments; the middle one is the claims.
    const payload = accessToken.split(".")[1];
    if (!payload) return false;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const claims = JSON.parse(json) as { amr?: AmrEntry[] };

    return (claims.amr ?? []).some(
      (entry) => entry.method && EMAIL_PROVEN_METHODS.includes(entry.method)
    );
  } catch {
    // Unreadable token = not verified. Fail closed.
    return false;
  }
}
