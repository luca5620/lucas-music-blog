"use client";

/**
 * /welcome — the one screen a Google/Apple sign-in owes us.
 *
 * Social providers don't ask for a username, so migration 031's
 * signup trigger invents one from the email (Apple's is a private
 * relay address, so it's usually gibberish) and flags the profile
 * username_auto. /auth/callback sends anyone carrying that flag
 * here, once, to claim a real handle — it's in every review URL, so
 * it shouldn't be an accident.
 *
 * The claim is FREE: the 028 name-change trigger doesn't start the
 * 14-day cooldown when it's replacing a generated handle.
 *
 * The EULA checkbox is the same wall /signup has (App Store 1.2 —
 * agreement before registering); a social sign-up never passed it.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { usernameFormatErrorKey, suggestUsername } from "@/lib/username";
import { useTranslations } from "next-intl";
import type { Profile } from "@/lib/types/database";

type Availability = "idle" | "checking" | "free" | "taken";

export default function WelcomePage() {
  const [ready, setReady] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  // The handle the trigger generated — shown so they know what
  // they're replacing, and what they keep if they leave it be.
  const [generated, setGenerated] = useState("");
  const [username, setUsername] = useState("");
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [availability, setAvailability] = useState<Availability>("idle");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  // LANGUAGES: this page's own lines live in "auth.welcome"; the
  // username rules + agreement text are shared with /signup.
  const t = useTranslations("auth.welcome");
  const ts = useTranslations("auth.signup");

  // Where to go once they're set up (?next=, same-site paths only).
  // Read from the raw URL instead of useSearchParams so this client
  // page doesn't need a Suspense boundary — same as /login.
  const nextRef = useRef("/");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") ?? "/";
    nextRef.current = next.startsWith("/") && !next.startsWith("//") ? next : "/";

    async function load() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }
      setUserId(user.id);

      const { data } = await supabase
        .from("profiles")
        .select("username, username_auto")
        .eq("id", user.id)
        .single();
      const profile = data as Pick<Profile, "username" | "username_auto"> | null;

      // Already picked a handle (or migration 031 hasn't run, in
      // which case the flag is undefined) — nothing to do here.
      if (!profile?.username_auto) {
        router.replace(nextRef.current);
        return;
      }

      setGenerated(profile.username);
      // Start from their real name/email when we can do better than
      // the fallback the trigger had to use.
      const meta = user.user_metadata ?? {};
      const seed =
        (meta.full_name as string | undefined) ??
        (meta.name as string | undefined) ??
        user.email ??
        "";
      setUsername(suggestUsername(seed) || profile.username);
      setReady(true);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Format check now, availability check after a quiet moment. */
  const onUsernameChange = (value: string) => {
    const lower = value.toLowerCase();
    setUsername(lower);
    setAvailability("idle");
    if (debounceRef.current) clearTimeout(debounceRef.current);

    const formatKey = usernameFormatErrorKey(lower);
    setUsernameError(formatKey ? ts(formatKey) : null);
    if (formatKey || lower.length === 0) return;

    // Their own generated handle is "free" — keeping it is allowed.
    if (lower === generated) {
      setAvailability("free");
      return;
    }

    setAvailability("checking");
    debounceRef.current = setTimeout(async () => {
      const supabase = createClient();
      // Underscores are LIKE wildcards — escape them or every name
      // carrying one reads as taken.
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .ilike("username", lower.replace(/_/g, "\\_"))
        .maybeSingle();
      setAvailability(data ? "taken" : "free");
    }, 400);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!userId) return;

    const lower = username.trim().toLowerCase();
    const formatKey = usernameFormatErrorKey(lower);
    if (formatKey || lower.length < 3) {
      setUsernameError(formatKey ? ts(formatKey) : t("enterUsername"));
      return;
    }
    if (availability === "taken") {
      setUsernameError(ts("usernameTaken"));
      return;
    }
    if (!agreedToTerms) {
      setError(t("agreeRequired"));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from("profiles")
      // @ts-expect-error — Supabase Relationships type narrowing
      .update({
        username: lower,
        // Cleared even when they keep the generated handle, so
        // /welcome never greets them twice. The trigger allows
        // true -> false and forbids the reverse.
        username_auto: false,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      const msg = updateError.message;
      if (msg.includes("USERNAME_RESERVED")) {
        setError(t("reserved"));
      } else if (/unique|duplicate/i.test(msg)) {
        setError(t("justTaken"));
      } else {
        setError(msg);
      }
      setSaving(false);
      return;
    }

    router.push(nextRef.current);
    router.refresh();
  };

  if (!ready) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center px-4">
        <p className="osd-text text-sm animate-pulse">{t("tuningIn")}</p>
      </div>
    );
  }

  const availabilityLine =
    availability === "checking" ? (
      <p className="mt-1.5 text-xs osd-text animate-pulse">{ts("checking")}</p>
    ) : availability === "free" && !usernameError && username ? (
      <p className="mt-1.5 text-xs text-accent-primary">
        {username === generated ? t("keeping", { username }) : ts("isFree", { username })}
      </p>
    ) : availability === "taken" ? (
      <p className="mt-1.5 text-xs text-accent-rose">{ts("isTaken", { username })}</p>
    ) : null;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="panel-xbox-glow p-8 relative overflow-hidden">
          <div className="text-center mb-8 space-y-2">
            <h1 className="crt-title text-3xl">{t("title")}</h1>
            <p className="text-text-secondary text-sm leading-relaxed">
              {t.rich("intro", {
                handle: () => <span className="text-text-primary">@{generated}</span>,
              })}
            </p>
          </div>

          {error && (
            <div className="mb-6 p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="username"
                className="block text-xs font-bold uppercase tracking-wider text-text-secondary mb-2 font-[family-name:var(--font-heading)]"
              >
                {ts("usernameLabel")}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => onUsernameChange(e.target.value)}
                required
                className="form-input"
                placeholder={ts("usernamePlaceholder")}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                autoFocus
              />
              {usernameError ? (
                <p className="mt-1.5 text-xs text-red-400">{usernameError}</p>
              ) : (
                availabilityLine
              )}
              <p className="mt-1.5 text-xs text-text-muted">{t("freeNote")}</p>
            </div>

            {/* The same active EULA consent /signup requires — a
                social sign-up skipped that screen entirely. */}
            <label className="flex items-start gap-3 p-3 rounded border border-border-medium bg-bg-elevated/40 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[var(--accent-primary,#1e90ff)]"
              />
              <span className="text-xs text-text-secondary leading-relaxed">
                {ts.rich("agree", {
                  terms: (chunks) => (
              <Link href="/terms" className="text-accent-primary hover:underline">
                {chunks}
              </Link>
            ),
            privacy: (chunks) => (
              <Link href="/privacy" className="text-accent-primary hover:underline">
                {chunks}
              </Link>
            ),
                  strong: (chunks) => (
                    <span className="text-text-primary font-medium">{chunks}</span>
                  ),
                })}
              </span>
            </label>

            <button
              type="submit"
              disabled={
                saving ||
                !!usernameError ||
                availability === "taken" ||
                !agreedToTerms
              }
              className="btn-y2k btn-y2k-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? t("saving") : t("enter")}
            </button>
          </form>

          <div className="scan-bar" />
        </div>
      </div>
    </div>
  );
}
