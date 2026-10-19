"use client";

/**
 * "Continue with Google / Apple" — the one-tap doors into the site.
 *
 * TWO FLOWS BEHIND ONE PAIR OF BUTTONS.
 *
 * On the web: Supabase's plain redirect flow. signInWithOAuth sends
 * the whole page to the provider, the provider bounces back to
 * Supabase, and Supabase bounces to our /auth/callback with a code we
 * exchange for a session. No popups anywhere — popups are blocked in
 * webviews and awkward on phones.
 *
 * In the app: the same flow turned inside out, because Google flatly
 * refuses OAuth inside an embedded webview ("disallowed_useragent").
 * The provider page opens in SFSafariViewController (a real Safari,
 * which Google accepts) via @capacitor/browser, and Supabase is told
 * to come back to the custom scheme `com.peakmusicreviews.app://` —
 * iOS hands that to the shell, the App plugin's `appUrlOpen` fires
 * INSIDE the WebView, and we hand the code to our own /auth/callback
 * route — the exact same server finish the web uses.
 *
 * WHY THE SERVER FINISHES IT, NOT THE PAGE (2026-10-18). Until then the
 * app exchanged the code right here with the browser client, which
 * writes the session cookies through document.cookie, then hard-
 * navigated on. Inside WKWebView those document.cookie writes reach the
 * cookie store a beat LATER than the navigation can start, so the next
 * page could load as logged-out. Harmless while that page was public
 * (the home page). But since 2026-10-05 a brand-new account goes to
 * /welcome or /start, and BOTH require a session — so friends signing
 * up in the app were bounced straight back to /login: "the redirection
 * bugs and doesn't work" (Luca, 2026-10-18). Existing accounts, landing
 * on public pages, never saw it.
 *
 * Now the WebView navigates to /auth/callback?code=…, the SERVER
 * exchanges it (the PKCE verifier is a cookie written back when the
 * button was tapped, long since settled), and its redirect response
 * carries the session as Set-Cookie headers — which the WebView applies
 * before it requests the next page. One finish for web and app, so the
 * /welcome → /start → next decisions can never drift apart again.
 *
 * The app buttons only appear on shells that actually carry the
 * Browser plugin — see browserPlugin() in lib/native. The 1.0 build
 * loads this very same deploy and has to keep showing email/password.
 */

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createClient } from "@/lib/supabase/client";
import {
  appPlugin,
  browserPlugin,
  isNativeApp,
  type PluginListener,
} from "@/lib/native";
import { useTranslations } from "next-intl";

type Provider = "google" | "apple";

/**
 * Which surface we're drawing for. "web" on the server so SSR and the
 * first client render agree; the bridge is only readable in the
 * browser.
 *  - "web"        the plain site, redirect flow
 *  - "app"        a 1.1+ shell: system browser + deep link back
 *  - "app-legacy" a 1.0 shell with no Browser plugin: render nothing
 */
type Surface = "web" | "app" | "app-legacy";

/**
 * Read as a store rather than set in an effect — same reasoning as
 * lib/useIsNativeApp: the bridge is in place before our JS runs and
 * never changes, so there's nothing to subscribe to. Returns a plain
 * string, so React's identity check is stable and this can't loop.
 */
const subscribeSurface = () => () => {};

const getSurface = (): Surface =>
  !isNativeApp()
    ? "web"
    : browserPlugin() && appPlugin()
      ? "app"
      : "app-legacy";

/** SSR can't know, and the web is the safe default. */
const getServerSurface = (): Surface => "web";

/**
 * Where the provider sends the app back — a custom scheme, not an
 * https URL, so iOS wakes the shell instead of opening the site in
 * Safari. Registered in ios/App/App/Info.plist (CFBundleURLTypes) and
 * android/app/src/main/AndroidManifest.xml, and it has to be on
 * Supabase's Redirect URLs allow-list too. Google never sees it — it
 * only ever knows Supabase's own callback — so no Google Cloud change.
 */
const APP_REDIRECT = "com.peakmusicreviews.app://auth/callback";

/** Everything before the "?" — how we spot our own deep links. */
const APP_SCHEME = "com.peakmusicreviews.app://";

/**
 * Where to land afterwards, parked while we're out in Safari. It rides
 * sessionStorage rather than the redirect URL so the allow-list only
 * ever has to match one exact string.
 */
const NEXT_KEY = "pmr:oauth-next";

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

/** Same-site paths only — never an open redirect. */
function safePath(path: string | null | undefined): string {
  return path && path.startsWith("/") && !path.startsWith("//") ? path : "/";
}

interface OAuthButtonsProps {
  /** Where to land after a successful sign-in. Same-site path only. */
  next?: string;
}

export default function OAuthButtons({ next = "/" }: OAuthButtonsProps) {
  const surface = useSyncExternalStore(
    subscribeSurface,
    getSurface,
    getServerSurface
  );
  const [busy, setBusy] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);
  // LANGUAGES: button labels + every failure line (messages → "auth.oauth").
  const t = useTranslations("auth.oauth");

  // True from the moment a deep link lands until we've navigated. Our
  // own Browser.close() also fires "browserFinished", and without this
  // that handler would clear `busy` mid-exchange and re-arm the
  // buttons under the user's thumb.
  const finishing = useRef(false);

  /**
   * The deep link coming back from Safari — the app's stand-in for
   * /auth/callback. Keep the two in step: they make the same
   * cancel / error / flagged-handle / first-rating decisions.
   */
  const finish = useCallback(
    async (url: string) => {
      // Other deep links (a push tap, a universal link) aren't ours.
      if (!url.startsWith(APP_SCHEME)) return;

      finishing.current = true;
      try {
        await browserPlugin()?.close();
      } catch {
        /* the sheet may already be gone — nothing to close */
      }

      const params = new URLSearchParams(
        url.includes("?") ? url.slice(url.indexOf("?") + 1) : ""
      );
      const code = params.get("code");
      const providerError =
        params.get("error_description") ?? params.get("error");

      let parked: string | null = null;
      try {
        parked = sessionStorage.getItem(NEXT_KEY);
        sessionStorage.removeItem(NEXT_KEY);
      } catch {
        /* storage disabled — they land on the home page */
      }

      const giveUp = (message: string | null) => {
        finishing.current = false;
        setBusy(null);
        setError(message);
      };

      if (!code) {
        // A plain cancel stays silent, exactly as on the web.
        giveUp(
          providerError && !/access_denied/i.test(providerError)
            ? t("didntGoThrough")
            : null
        );
        return;
      }

      // Hand the code to the SERVER — /auth/callback, the web's own
      // finish (see the header for why the page no longer exchanges it
      // itself). It exchanges the code using the PKCE verifier cookie
      // written when the button was tapped, sets the session cookies
      // on its redirect response, and applies the same decisions as on
      // the web: a fresh social handle → /welcome, a brand-new account
      // → /start, then the parked destination. A bad or expired code
      // comes back as /login?error=oauth, which this page explains.
      //
      // A HARD navigation (Luca 2026-09-02: a client-side router.push
      // inside the WebView rendered the next page without the session),
      // and `replace` so Back doesn't return to a spent code.
      const callback = new URL("/auth/callback", window.location.origin);
      callback.searchParams.set("code", code);
      callback.searchParams.set("next", safePath(parked));
      window.location.replace(callback.toString());
    },
    [t]
  );

  // App only: listen for the trip back. It lives here rather than
  // app-wide because this component is the only thing that starts the
  // journey, and SFSafariViewController never unloads the WebView
  // underneath it — /login stays mounted the whole time.
  useEffect(() => {
    if (surface !== "app") return;
    const app = appPlugin();
    const browser = browserPlugin();
    if (!app || !browser) return;

    let cancelled = false;
    const handles: PluginListener[] = [];
    const keep = async (pending: Promise<PluginListener>) => {
      try {
        const handle = await pending;
        if (cancelled) void handle.remove();
        else handles.push(handle);
      } catch {
        /* the plugin refused the listener — the buttons just won't
           complete, and email/password is still right there */
      }
    };

    void keep(
      app.addListener("appUrlOpen", (event: { url: string }) => {
        void finish(event.url);
      })
    );
    // Sheet dismissed without finishing (Done, or a swipe down) —
    // let them have another go.
    void keep(
      browser.addListener("browserFinished", () => {
        if (!finishing.current) setBusy(null);
      })
    );

    return () => {
      cancelled = true;
      handles.forEach((handle) => void handle.remove());
    };
  }, [surface, finish]);

  if (surface === "app-legacy" || ENABLED.size === 0) return null;

  const handoffError = (provider: Provider, message: string) =>
    /not enabled|unsupported/i.test(message)
      ? t("notEnabled", { provider: provider === "google" ? "Google" : "Apple" })
      : message;

  const start = async (provider: Provider) => {
    setError(null);
    setBusy(provider);

    const supabase = createClient();

    if (surface === "app") {
      try {
        sessionStorage.setItem(NEXT_KEY, safePath(next));
      } catch {
        /* storage disabled — they land on the home page */
      }

      // skipBrowserRedirect: hand us the URL instead of navigating
      // this WebView to it, which is the thing Google rejects.
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: APP_REDIRECT, skipBrowserRedirect: true },
      });

      if (oauthError || !data?.url) {
        setError(
          oauthError
            ? handoffError(provider, oauthError.message)
            : t("couldntStart")
        );
        setBusy(null);
        return;
      }

      try {
        await browserPlugin()?.open({
          url: data.url,
          // "popover", NOT "fullscreen" (2026-10-18) — this one word is
          // the whole fix for the button hanging on "HANDING OVER…".
          //
          // For "fullscreen", Capacitor's bridge (CapacitorBridge.
          // presentVC) builds a brand-new temporary UIWindow with
          // UIWindow(frame:) and presents Safari inside it. Since 1.2
          // the shell runs the UIScene life cycle (required by the
          // iOS 27 SDK — ios/App/App/SceneDelegate.swift), and under
          // scenes a window that isn't attached to a UIWindowScene is
          // never put on screen. So Safari was created, loaded Google
          // off-screen, and open() never resolved: every 1.2 user
          // tapping Google/Apple saw "HANDING OVER…" forever (Luca +
          // friends, 2026-10-18; confirmed in the iOS 27 simulator —
          // the Safari view service ran "NotVisible" in a second,
          // hidden window).
          //
          // For "popover" the bridge skips the temporary window and
          // presents from its own view controller, which lives in the
          // real, visible scene window. On iPhone a popover adapts to
          // full screen automatically (the plugin sets no adaptive
          // override), so it looks exactly like before; on iPad it's a
          // centred sheet. close() handles both paths. A native fix
          // (attach the temp window to the scene) would need a new App
          // Store build; this works on the 1.2 binary already out.
          presentationStyle: "popover",
        });
      } catch {
        setError(t("couldntOpen"));
        setBusy(null);
      }
      return;
    }

    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo },
    });

    // On success the browser is already navigating away, so anything
    // below only runs when the handoff failed.
    if (oauthError) {
      setError(handoffError(provider, oauthError.message));
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
          {busy === "google" ? t("handingOver") : t("google")}
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
          {busy === "apple" ? t("handingOver") : t("apple")}
        </button>
      )}

      {/* The divider lives in here so a surface that renders none of
          this — the 1.0 app — isn't left with a stray "OR" line. */}
      <div className="flex items-center gap-3 pt-2">
        <span className="h-px flex-1 bg-white/10" />
        <span className="osd-text text-[0.65rem] text-text-muted">{t("or")}</span>
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
