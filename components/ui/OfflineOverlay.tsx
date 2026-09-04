"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useIsNativeApp } from "@/lib/useIsNativeApp";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";

/**
 * Ask the actual network, not navigator.onLine — WKWebView is
 * unreliable about flipping onLine back to true (and about firing
 * the `online` event at all) after service returns, which left the
 * Retune button dead and the overlay stuck (Luca, 2026-08-31).
 * A tiny no-store fetch against our own origin is the truth.
 */
async function probeConnection(): Promise<boolean> {
  // Manual abort timer — AbortSignal.timeout needs Safari 16+.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("/manifest.webmanifest", {
      method: "HEAD",
      cache: "no-store",
      signal: controller.signal,
    });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * OfflineOverlay — the in-session NO SIGNAL screen (app shell only).
 *
 * Two different offline moments need two different fixes:
 *   1. The app LAUNCHES with no connection → the WebView can't load
 *      the site at all. Capacitor's server.errorPath shows the local
 *      mobile/www/index.html fallback (baked into the app binary).
 *   2. The connection DIES while browsing → the loaded page is still
 *      on screen but every tap fails silently. That's this overlay:
 *      it drops over the app the moment the device reports offline
 *      and lifts the moment the connection returns.
 *
 * Native-only: browsers already communicate offline fine on the web,
 * and Safari users have their own UI for it.
 */
/**
 * navigator.onLine as a store rather than an effect: subscribe to the
 * two events, snapshot the flag. The server snapshot is `true` —
 * "assume connected" — so SSR and the first client render agree and
 * nobody gets a flash of NO SIGNAL. Note this is only the FAST signal;
 * WKWebView lies about it often enough that the probe below is what
 * actually lifts the overlay.
 */
const subscribeOnline = (onChange: () => void) => {
  window.addEventListener("offline", onChange);
  window.addEventListener("online", onChange);
  return () => {
    window.removeEventListener("offline", onChange);
    window.removeEventListener("online", onChange);
  };
};

export default function OfflineOverlay() {
  const t = useTranslations("offline");
  const native = useIsNativeApp();
  const offline = !useSyncExternalStore(
    subscribeOnline,
    () => navigator.onLine,
    () => true
  );
  // "checking" while the Retune probe runs, "dead" right after a
  // failed one (drives the button label + the STILL NO SIGNAL note).
  const [retuning, setRetuning] = useState<"idle" | "checking" | "dead">(
    "idle",
  );
  const probing = useRef(false);

  // Safety net for WKWebView's missing `online` event: while the
  // overlay is up, quietly re-probe every few seconds and reload the
  // moment the network answers (reload rather than just lifting —
  // whatever the user was doing mid-drop is stale by now anyway).
  useEffect(() => {
    if (!native || !offline) return;
    const interval = setInterval(async () => {
      if (probing.current) return;
      probing.current = true;
      const alive = await probeConnection();
      probing.current = false;
      if (alive) window.location.reload();
    }, 4000);
    return () => clearInterval(interval);
  }, [native, offline]);

  const handleRetune = useCallback(async () => {
    if (probing.current) return;
    probing.current = true;
    setRetuning("checking");
    const alive = await probeConnection();
    probing.current = false;
    if (alive) {
      window.location.reload();
    } else {
      setRetuning("dead");
    }
  }, []);

  if (!native || !offline) return null;

  return (
    <div
      className="fixed inset-0 z-[120] bg-black flex flex-col items-center justify-center gap-4 p-6 text-center"
      role="alert"
    >
      <p
        className="pixel-text text-3xl"
        style={{
          // Classic accent blue (was OSD green — recolored 2026-08-25)
          color: "#1e90ff",
          textShadow:
            "0 0 8px rgba(30,144,255,0.8), 0 0 24px rgba(30,144,255,0.35)",
        }}
      >
        {t("noSignal")}
      </p>
      <p className="text-sm text-text-secondary max-w-xs">
        {t("body")}
      </p>
      <button
        type="button"
        onClick={handleRetune}
        disabled={retuning === "checking"}
        className="btn-y2k btn-y2k-primary mt-2 disabled:opacity-60"
      >
        {retuning === "checking" ? t("tuning") : t("retune")}
      </button>
      {retuning === "dead" && (
        <p className="osd-text text-xs opacity-80" role="status">
          {t("still")}
        </p>
      )}
    </div>
  );
}
