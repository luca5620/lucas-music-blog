"use client";

/**
 * SplashCurtain — the app's own opening, in the web layer.
 *
 * The native splash (Capacitor SplashScreen, capacitor.config.ts) is a
 * static black image baked into the binary: it can only ever be a
 * still, and changing it needs Xcode. This is the animated one — the
 * penguin drops in, lands with a little weight, settles, and the
 * wordmark resolves under it — and because it lives on the web side it
 * reaches every installed app on the next deploy.
 *
 * The rules it obeys, all of them deliberate:
 *  - App only. On the website you clicked a link; a curtain there is
 *    just a page that takes longer.
 *  - COLD BOOT only. A fresh WebView has an empty sessionStorage, so
 *    route changes and back-navigations never replay it.
 *  - It never blocks. The app renders underneath at full speed, the
 *    curtain is purely on top, any tap dismisses it, and a failed
 *    image drops it instantly rather than leaving a black screen —
 *    the one failure mode worse than no splash at all.
 *  - It hides Capacitor's static splash the moment it is on screen,
 *    so the two curtains never stack into a three-second wait.
 *  - Reduced motion skips it entirely.
 */

import { useEffect, useState } from "react";
import { isNativeApp, hideNativeSplash } from "@/lib/native";

/** Long enough to read as a performance, short enough not to be a wait. */
const HOLD_MS = 1250;
const FADE_MS = 340;

export default function SplashCurtain() {
  const [phase, setPhase] = useState<"off" | "playing" | "leaving">("off");

  useEffect(() => {
    if (!isNativeApp()) return;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      void hideNativeSplash();
      return;
    }
    try {
      if (sessionStorage.getItem("pmr-splash-played")) return;
      sessionStorage.setItem("pmr-splash-played", "1");
    } catch {
      /* private mode / storage blocked: play it, it's once per launch anyway */
    }

    // Raised on the next frame, not synchronously inside the effect:
    // the app's own first paint goes up first, which is the order we
    // want anyway — the curtain is a layer over a running app, never
    // something it waits behind.
    const raise = requestAnimationFrame(() => {
      setPhase("playing");
      void hideNativeSplash();
    });
    const leave = setTimeout(() => setPhase("leaving"), HOLD_MS);
    const done = setTimeout(() => setPhase("off"), HOLD_MS + FADE_MS);
    return () => {
      cancelAnimationFrame(raise);
      clearTimeout(leave);
      clearTimeout(done);
    };
  }, []);

  if (phase === "off") return null;

  return (
    <div
      className={`splash-curtain${phase === "leaving" ? " splash-leaving" : ""}`}
      aria-hidden="true"
      // Any touch takes it away — nobody should ever have to wait for
      // an animation to finish before their app answers.
      onPointerDown={() => setPhase("leaving")}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/penguin/mark-192.webp"
        alt=""
        width={173}
        height={192}
        className="splash-penguin"
        onError={() => setPhase("off")}
      />
      <span className="splash-wordmark">Peak Music Reviews</span>
    </div>
  );
}
