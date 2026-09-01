"use client";

/**
 * "Continue with Google / Apple" — the one-tap doors into the site.
 *
 * Both run Supabase's OAuth flow: signInWithOAuth redirects the whole
 * page to the provider, the provider bounces back to Supabase, and
 * Supabase bounces to our /auth/callback with a code we exchange for
 * a session. No popups anywhere — popups are blocked in webviews and
 * awkward on phones.
 *
 * WEB ONLY, on purpose (Luca 2026-08-31): inside the iOS/Android
 * shell the site runs in a WKWebView, and Google flatly refuses OAuth
 * in embedded webviews ("disallowed_useragent"). Doing it properly in
 * the app means the system browser + a deep link back, which is its
 * own piece of work — until then the app shows email/password only,
 * which is exactly what it shows today.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isNativeApp } from "@/lib/native";

type Provider = "google" | "apple";

/**
 * Which buttons to show — NEXT_PUBLIC_SOCIAL_LOGIN, a comma list
 * ("google", "apple", or both). Unset = neither, which is the point:
 * the site is live, so a button that leads to "provider is not
 * enabled" must never reach a real visitor. Flip it in Vercel the
 * moment the provider is configured in the Supabase dashboard —
 * Google first is fine, Apple's setup is the fiddlier half.
 */
const ENABLED = new Set(
  (process.env.NEXT_PUBLIC_SOCIAL_LOGIN ?? "")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean)
);

interface OAuthButtonsProps {
  /** Where to land after a successful sign-in. Same-site path only. */
  next?: string;
}

export default function OAuthButtons({ next = "/" }: OAuthButtonsProps) {
  // App detection lands in an effect so the server render (web) and
  // the first client render agree — the app then hides them on mount,
  // the same pattern useModuleLimit uses.
  const [app, setApp] = useState(false);
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setApp(isNativeApp()), []);

  if (app || ENABLED.size === 0) return null;

  const start = async (provider: Provider) => {
    setError(null);
    setBusy(provider);

    const supabase = createClient();
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    // On success the browser is already navigating away, so anything
    // below only runs when the handoff failed.
    if (oauthError) {
      setError(
        /not enabled|unsupported/i.test(oauthError.message)
          ? `${provider === "google" ? "Google" : "Apple"} sign-in isn't switched on yet — use your email and password for now.`
          : oauthError.message
      );
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 rounded bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {ENABLED.has("google") && (
        <button
          type="button"
          onClick={() => start("google")}
          disabled={busy !== null}
          className="btn-y2k btn-y2k-outline w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <GoogleMark />
          {busy === "google" ? "Handing over…" : "Continue with Google"}
        </button>
      )}

      {ENABLED.has("apple") && (
        <button
          type="button"
          onClick={() => start("apple")}
          disabled={busy !== null}
          className="btn-y2k btn-y2k-outline w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <AppleMark />
          {busy === "apple" ? "Handing over…" : "Continue with Apple"}
        </button>
      )}

      {/* The divider lives in here so the app — where none of this
          renders — doesn't get left with a stray "OR" line. */}
      <div className="flex items-center gap-3 pt-2">
        <span className="h-px flex-1 bg-white/10" />
        <span className="osd-text text-[0.65rem] text-text-muted">OR</span>
        <span className="h-px flex-1 bg-white/10" />
      </div>
    </div>
  );
}

/** Google's four-colour G, drawn inline so nothing loads over the wire. */
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.86c2.26-2.09 3.56-5.17 3.56-8.87z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29a7.2 7.2 0 0 1 0-4.58V6.62H1.29a12 12 0 0 0 0 10.76l3.98-3.09z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75z"
      />
    </svg>
  );
}

/** Apple's mark — currentColor so it follows the profile theme. */
function AppleMark() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className="shrink-0"
    >
      <path d="M17.05 12.53c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.61-1.71-3.18-1.73-1.35-.14-2.64.79-3.33.79-.69 0-1.75-.77-2.87-.75-1.48.02-2.84.86-3.6 2.18-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.25 2.75 2.2 1.1-.04 1.52-.71 2.85-.71 1.33 0 1.71.71 2.87.69 1.19-.02 1.94-1.08 2.67-2.14.84-1.23 1.19-2.42 1.2-2.48-.03-.01-2.3-.88-2.33-3.5zM14.9 5.98c.6-.74 1.01-1.76.9-2.78-.87.04-1.93.58-2.56 1.31-.56.65-1.05 1.7-.92 2.7.97.08 1.96-.49 2.58-1.23z" />
    </svg>
  );
}
