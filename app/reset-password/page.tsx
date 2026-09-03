"use client";

/**
 * /reset-password — set the new password.
 *
 * Reached from the email link via /auth/confirm, which has already
 * signed this browser in (that's what authorizes the change). Three
 * states:
 *  - session present → the form
 *  - ?error=link (or no session) → the link was expired/used/opened
 *    in a browser the reset wasn't requested from → offer a fresh one
 *  - success → straight back into the app, signed in
 */

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/components/auth/AuthProvider";
import { useTranslations } from "next-intl";

function ResetPasswordInner() {
  const { user, loading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const linkFailed = searchParams.get("error") === "link";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  // LANGUAGES: messages → "auth.reset".
  const t = useTranslations("auth.reset");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError(t("min6"));
      return;
    }
    if (password !== confirm) {
      setError(t("mismatch"));
      return;
    }
    setSaving(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(
        /different from the old/i.test(updateError.message)
          ? t("samePassword")
          : updateError.message
      );
      setSaving(false);
      return;
    }

    setDone(true);
    setTimeout(() => {
      router.push("/");
      router.refresh();
    }, 1500);
  };

  const showForm = !linkFailed && !authLoading && !!user;
  const showExpired = linkFailed || (!authLoading && !user);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="panel-xbox-glow p-8 relative overflow-hidden">
          <div className="text-center mb-8 space-y-2">
            <h1 className="crt-title text-3xl">{t("title")}</h1>
            <p className="text-text-secondary text-sm">{t("sub")}</p>
          </div>

          {done ? (
            <div className="p-4 rounded bg-accent-primary/10 border border-accent-primary/30">
              <p className="text-sm text-text-primary">{t("done")}</p>
            </div>
          ) : showExpired ? (
            <div className="space-y-4">
              <div className="p-4 rounded bg-osd-amber/10 border border-osd-amber/30">
                <p className="text-sm text-text-primary">{t("expired")}</p>
              </div>
              <Link
                href="/forgot-password"
                className="btn-y2k btn-y2k-primary w-full justify-center"
              >
                {t("freshLink")}
              </Link>
            </div>
          ) : !showForm ? (
            <p className="text-sm text-text-secondary text-center">{t("checking")}</p>
          ) : (
            <>
              {error && (
                <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label
                    htmlFor="new-password"
                    className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
                  >
                    {t("newPassword")}
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="form-input"
                    placeholder={t("newPlaceholder")}
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
                  >
                    {t("repeat")}
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="form-input"
                    placeholder={t("repeatPlaceholder")}
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? t("saving") : t("set")}
                </button>
              </form>
            </>
          )}

          <div className="scan-bar" />
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  // useSearchParams needs a Suspense boundary in the app router.
  return (
    <Suspense fallback={null}>
      <ResetPasswordInner />
    </Suspense>
  );
}
