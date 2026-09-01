"use client";

/**
 * /login — sign in.
 *
 * Two flows live here:
 *
 * 1. Normal accounts: email/username + password, done.
 *
 * 2. Staff accounts (role admin/owner — Luca 2026-08-25): the
 *    password alone is deliberately NOT enough. After the password
 *    checks out we throw the session away, email a 6-digit code, and
 *    only verifyOtp() mints the session that admin tools accept
 *    (middleware + /api/admin + Postgres all check HOW the session
 *    was created — see lib/auth/amr.ts). A stolen admin password
 *    without inbox access gets nobody into the mod tools.
 *
 * Also handled well: someone signs up, never clicks the confirmation
 * email, then tries to log in. Supabase answers "Email not confirmed"
 * — we turn that into a clear message plus a one-click resend (with a
 * cooldown so it can't be spammed).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import OAuthButtons from "@/components/auth/OAuthButtons";
import type { Profile } from "@/lib/types/database";

export default function LoginPage() {
  // Email OR username (Luca 2026-08-22) — never display name.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // The address the sign-in actually ran against — a username entry
  // resolves to this; the confirmation-resend and the admin code
  // step both need it.
  const [resolvedEmail, setResolvedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Admin second step: "credentials" is the normal form, "code" is
  // the emailed 6-digit entry that only staff accounts ever see.
  const [step, setStep] = useState<"credentials" | "code">("credentials");
  const [code, setCode] = useState("");
  // Set when the middleware bounced an admin here (?verify=admin):
  // their session predates the code requirement.
  const [adminNotice, setAdminNotice] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // ?verify=admin / ?error=oauth — read from the raw URL instead of
  // useSearchParams so this client page needs no Suspense boundary.
  // ?error=oauth means a Google/Apple hand-back failed (a plain
  // cancel comes back clean, with nothing to explain).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("verify") === "admin") setAdminNotice(true);
    if (params.get("error") === "oauth") {
      setError(
        "That sign-in didn't come back through — try again, or use your email and password."
      );
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setNeedsConfirmation(false);
    setLoading(true);

    const supabase = createClient();

    // "@" means it's an email; anything else is treated as a
    // username and resolved server-side (migration 017's
    // email_for_login — it only answers when the password is right,
    // so usernames can't be turned into emails).
    // Lowercased because the 6-digit code is verified by hashing
    // code+email together — "Vince@" vs "vince@" makes every code
    // read as wrong, while the emailed LINK (token-hash only)
    // still works (Luca 2026-08-26: exactly that symptom).
    let email = identifier.trim().toLowerCase();
    if (!email.includes("@")) {
      const { data: resolved } = await supabase.rpc("email_for_login", {
        identifier: email,
        pass: password,
      } as never);
      if (!resolved) {
        setError("Wrong username or password.");
        setLoading(false);
        return;
      }
      email = resolved as string;
    }
    setResolvedEmail(email);

    const { data: signInData, error: authError } =
      await supabase.auth.signInWithPassword({
        email,
        password,
      });

    if (authError) {
      // Unconfirmed inbox gets its own path with a resend button.
      if (/email not confirmed/i.test(authError.message)) {
        setNeedsConfirmation(true);
      } else if (/invalid login credentials/i.test(authError.message)) {
        setError("Wrong email/username or password.");
      } else {
        setError(authError.message);
      }
      setLoading(false);
      return;
    }

    // --- Staff detour: password OK, now prove the inbox ---
    const userId = signInData.user?.id;
    if (userId) {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", userId)
        .single();
      const role = (profileData as Pick<Profile, "role"> | null)?.role;

      if (role === "owner" || role === "admin") {
        // Drop the password-only session — locally, so other devices
        // stay signed in — then email the code. verifyOtp() below is
        // what actually signs a staff member in.
        await supabase.auth.signOut({ scope: "local" });

        const { error: otpError } = await supabase.auth.signInWithOtp({
          email,
          options: { shouldCreateUser: false },
        });
        if (otpError) {
          // Most likely Supabase's email rate limit.
          setError(
            "Password OK, but the sign-in code couldn't be sent — wait a minute and try again."
          );
          setLoading(false);
          return;
        }

        setStep("code");
        setResendCooldown(60);
        setLoading(false);
        return;
      }
    }

    router.push("/");
    router.refresh();
  };

  // Step 2 (staff only): the emailed 6-digit code → real session.
  const handleVerifyCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: resolvedEmail,
      token: code.trim(),
      type: "email",
    });

    if (verifyError) {
      // Only staff ever see this screen, so show Supabase's real
      // reason next to the friendly line — "expired", "invalid",
      // rate-limited, etc. — instead of leaving them (and us)
      // guessing which one it was.
      setError(
        `Wrong or expired code — check the newest email. (${verifyError.message})`
      );
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  const handleResendCode = async () => {
    if (resendCooldown > 0 || !resolvedEmail) return;
    setResendNote(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.signInWithOtp({
      email: resolvedEmail,
      options: { shouldCreateUser: false },
    });
    setResendNote(
      resendError
        ? "Couldn't resend — wait a minute and try again."
        : "New code sent. Only the newest one works."
    );
    setResendCooldown(60);
  };

  const handleResend = async () => {
    const email = resolvedEmail || (identifier.includes("@") ? identifier.trim() : "");
    if (resendCooldown > 0 || !email) return;
    setResendNote(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
    });
    setResendNote(
      resendError
        ? "Couldn't resend — wait a minute and try again."
        : "Confirmation link re-sent. Check spam too."
    );
    setResendCooldown(60);
  };

  /* --- Step 2 screen: enter the emailed code --- */
  if (step === "code") {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <div className="w-full max-w-md">
          <div className="panel-xbox-glow p-8 relative overflow-hidden">
            <div className="text-center mb-8 space-y-2">
              <h1 className="crt-title text-3xl">CHECK YOUR EMAIL</h1>
              <p className="text-text-secondary text-sm">
                Admin accounts need the sign-in code we just sent to{" "}
                <span className="text-text-primary">{resolvedEmail}</span>
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleVerifyCode} className="space-y-5">
              <div>
                <label
                  htmlFor="code"
                  className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
                >
                  Sign-in code
                </label>
                <input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  className="form-input text-center tracking-[0.5em] text-lg"
                  placeholder="00000000"
                  /* Supabase's OTP length is a dashboard setting
                     (6–10 digits) and this project sends 8 — the old
                     maxLength={6} silently cut off the last two
                     digits, so no code could ever be entered (Luca
                     2026-08-26). Accept the whole range. */
                  maxLength={10}
                  autoFocus
                />
              </div>

              <button
                type="submit"
                disabled={loading || code.trim().length < 6}
                className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? "Tuning in…" : "Verify"}
              </button>
            </form>

            <div className="mt-6 space-y-2 text-center text-sm">
              <button
                type="button"
                onClick={handleResendCode}
                disabled={resendCooldown > 0}
                className="text-text-secondary hover:text-accent-primary transition-colors disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Resend code in ${resendCooldown}s`
                  : "Resend code"}
              </button>
              {resendNote && (
                <p className="pixel-text text-accent-glow">{resendNote}</p>
              )}
              <p>
                <button
                  type="button"
                  onClick={() => {
                    setStep("credentials");
                    setCode("");
                    setError(null);
                  }}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  ← Back to sign in
                </button>
              </p>
            </div>

            <div className="scan-bar" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="panel-xbox-glow p-8 relative overflow-hidden">
          {/* Header */}
          <div className="text-center mb-8 space-y-2">
            <h1 className="crt-title text-3xl">SIGN IN</h1>
            <p className="text-text-secondary text-sm">welcome back to Peak Music Reviews</p>
          </div>

          {/* Middleware sent an admin here for the code upgrade */}
          {adminNotice && (
            <div className="mb-6 p-3 rounded bg-accent-primary/10 border border-accent-primary/30 text-sm text-text-primary">
              Admin tools now need a sign-in verified by email code.
              Sign in again and we&apos;ll send you one.
            </div>
          )}

          {/* Plain errors */}
          {error && (
            <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Unconfirmed email — explain + offer a resend */}
          {needsConfirmation && (
            <div className="mb-6 p-4 rounded bg-osd-amber/10 border border-osd-amber/30 space-y-3">
              <p className="text-sm text-text-primary">
                This account hasn&apos;t been switched on yet — the
                confirmation link in your inbox does that.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="btn-y2k btn-y2k-outline text-xs disabled:opacity-50"
              >
                {resendCooldown > 0
                  ? `Resend in ${resendCooldown}s`
                  : "Resend confirmation link"}
              </button>
              {resendNote && (
                <p className="pixel-text text-sm text-accent-glow">
                  {resendNote}
                </p>
              )}
            </div>
          )}

          {/* One-tap doors. Renders nothing inside the app shell —
              see components/auth/OAuthButtons. */}
          <div className="mb-6">
            <OAuthButtons />
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
              >
                Email or Username
              </label>
              <input
                id="identifier"
                type="text"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="form-input"
                placeholder="you@example.com or username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
              />
            </div>

            <div>
              <div className="flex items-baseline justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-xs font-bold uppercase tracking-wider text-text-secondary font-[family-name:var(--font-heading)]"
                >
                  Password
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-text-muted hover:text-accent-primary transition-colors"
                >
                  Forgot it?
                </Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="form-input"
                placeholder="Your password"
                autoComplete="current-password"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Tuning in…" : "Sign In"}
            </button>

            {/* App Store 1.2 says the EULA is presented "before
                registering or logging in" — signup has the required
                checkbox; login carries the agreement notice so the
                reviewer's demo-account path sees it too. */}
            <p className="text-xs text-text-muted text-center">
              By signing in you agree to the{" "}
              <Link href="/terms" className="text-accent-primary hover:underline">
                Terms of Use
              </Link>{" "}
              — zero tolerance for objectionable content or abusive users —
              and the{" "}
              <Link href="/privacy" className="text-accent-primary hover:underline">
                Privacy Policy
              </Link>
              .
            </p>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-text-secondary">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-accent-primary hover:text-accent-glow hover:underline"
            >
              Sign up
            </Link>
          </p>

          <div className="scan-bar" />
        </div>
      </div>
    </div>
  );
}
