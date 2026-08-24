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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("At least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two entries don't match.");
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
          ? "That's already your password — pick a new one."
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
            <h1 className="crt-title text-3xl">NEW PASSWORD</h1>
            <p className="text-text-secondary text-sm">
              set it and you&apos;re back in
            </p>
          </div>

          {done ? (
            <div className="p-4 rounded bg-accent-primary/10 border border-accent-primary/30">
              <p className="text-sm text-text-primary">
                Password changed — taking you home, signed in. ✓
              </p>
            </div>
          ) : showExpired ? (
            <div className="space-y-4">
              <div className="p-4 rounded bg-osd-amber/10 border border-osd-amber/30">
                <p className="text-sm text-text-primary">
                  This reset link is expired, already used, or was
                  opened in a different browser than it was requested
                  from.
                </p>
              </div>
              <Link
                href="/forgot-password"
                className="btn-y2k btn-y2k-primary w-full justify-center"
              >
                Send me a fresh link
              </Link>
            </div>
          ) : !showForm ? (
            <p className="text-sm text-text-secondary text-center">
              Checking your link…
            </p>
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
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    className="form-input"
                    placeholder="At least 6 characters"
                    autoComplete="new-password"
                  />
                </div>

                <div>
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
                  >
                    Repeat it
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                    minLength={6}
                    className="form-input"
                    placeholder="Same thing again"
                    autoComplete="new-password"
                  />
                </div>

                <button
                  type="submit"
                  disabled={saving}
                  className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? "Saving…" : "Set new password"}
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
