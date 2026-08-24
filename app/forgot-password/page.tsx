"use client";

/**
 * /forgot-password — request a reset link.
 *
 * Email only (a username can't be resolved to an email without the
 * password — that's deliberate, no enumeration). The result message
 * is the same whether or not the address has an account, for the
 * same reason. The link in the email lands on /auth/confirm which
 * signs the browser in and forwards to /reset-password.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || cooldown > 0 || !email.trim()) return;
    setLoading(true);

    const supabase = createClient();
    // Errors are deliberately not surfaced (they'd leak which emails
    // exist); rate-limit failures land in the same quiet bucket.
    await supabase.auth
      .resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/confirm?next=/reset-password`,
      })
      .catch(() => null);

    setSent(true);
    setCooldown(60);
    setLoading(false);
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="panel-xbox-glow p-8 relative overflow-hidden">
          <div className="text-center mb-8 space-y-2">
            <h1 className="crt-title text-3xl">RESET PASSWORD</h1>
            <p className="text-text-secondary text-sm">
              we&apos;ll email you a link to set a new one
            </p>
          </div>

          {sent && (
            <div className="mb-6 p-4 rounded bg-accent-primary/10 border border-accent-primary/30 space-y-1">
              <p className="text-sm text-text-primary">
                If that email has an account, a reset link is on its
                way. Check spam too.
              </p>
              <p className="text-xs text-text-muted">
                Open the link on this device if you can — it signs
                this browser in to set the new password.
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="form-input"
                placeholder="you@example.com"
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
              />
              <p className="mt-2 text-xs text-text-muted">
                Your email, not your username — reset links only travel
                by mail.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0
                ? `Sent — again in ${cooldown}s`
                : loading
                  ? "Sending…"
                  : "Send reset link"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            Remembered it?{" "}
            <Link
              href="/login"
              className="text-accent-primary hover:text-accent-glow hover:underline"
            >
              Sign in
            </Link>
          </p>

          <div className="scan-bar" />
        </div>
      </div>
    </div>
  );
}
