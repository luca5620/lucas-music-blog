"use client";

import { useEffect, useState } from "react";
import { isNativeApp } from "@/lib/native";

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
export default function OfflineOverlay() {
  const [native, setNative] = useState(false);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
    setOffline(!navigator.onLine);
    const goOffline = () => setOffline(true);
    const goOnline = () => setOffline(false);
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
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
          color: "#2fff5e",
          textShadow:
            "0 0 8px rgba(47,255,94,0.8), 0 0 24px rgba(47,255,94,0.35)",
        }}
      >
        NO SIGNAL
      </p>
      <p className="text-sm text-text-secondary max-w-xs">
        Peak Music Reviews lost the connection. Check your service — the
        picture comes back on its own the moment you do.
      </p>
      <button
        type="button"
        onClick={() => {
          // Manual retune: if the radio's actually back, reload fresh.
          if (navigator.onLine) window.location.reload();
        }}
        className="btn-y2k btn-y2k-primary mt-2"
      >
        Retune
      </button>
    </div>
  );
}
