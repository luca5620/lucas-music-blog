"use client";

/**
 * /login — sign in.
 *
 * Special case worth handling well: someone signs up, never clicks
 * the confirmation email, then tries to log in. Supabase answers
 * "Email not confirmed" — we turn that into a clear message plus a
 * one-click resend (with a cooldown so it can't be spammed).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  // Email OR username (Luca 2026-08-22) — never display name.
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  // The address the sign-in actually ran against — a username entry
  // resolves to this, and the confirmation-resend needs it.
  const [resolvedEmail, setResolvedEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

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
    let email = identifier.trim();
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

    const { error: authError } = await supabase.auth.signInWithPassword({
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

    router.push("/");
    router.refresh();
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

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="panel-xbox-glow p-8 relative overflow-hidden">
          {/* Header */}
          <div className="text-center mb-8 space-y-2">
            <h1 className="crt-title text-3xl">SIGN IN</h1>
            <p className="text-text-secondary text-sm">welcome back to Peak Music Reviews</p>
          </div>

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
