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
import { useTranslations } from "next-intl";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [loading, setLoading] = useState(false);
  // LANGUAGES: messages → "auth.forgot".
  const t = useTranslations("auth.forgot");

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
            <h1 className="crt-title text-3xl">{t("title")}</h1>
            <p className="text-text-secondary text-sm">{t("sub")}</p>
          </div>

          {sent && (
            <div className="mb-6 p-4 rounded bg-accent-primary/10 border border-accent-primary/30 space-y-1">
              <p className="text-sm text-text-primary">{t("sentTitle")}</p>
              <p className="text-xs text-text-muted">{t("sentNote")}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
              >
                {t("emailLabel")}
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
              <p className="mt-2 text-xs text-text-muted">{t("emailHint")}</p>
            </div>

            <button
              type="submit"
              disabled={loading || cooldown > 0}
              className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cooldown > 0
                ? t("sentAgainIn", { s: cooldown })
                : loading
                  ? t("sending")
                  : t("send")}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-text-secondary">
            {t("remembered")}{" "}
            <Link
              href="/login"
              className="text-accent-primary hover:text-accent-glow hover:underline"
            >
              {t("signIn")}
            </Link>
          </p>

          <div className="scan-bar" />
        </div>
      </div>
    </div>
  );
}
