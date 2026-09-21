"use client";

/**
 * SplashCurtain — the app's own opening, in the web layer.
 *
 * ON from build 3 (2026-09-21), gated on the shell's build number —
 * see APP_SPLASH_CURTAIN_ENABLED / SPLASH_HANDOFF_MIN_BUILD in
 * lib/flags.ts for the double-splash history and why the gate exists.
 * Preview it any time with `?splash=1`.
 *
 * The native splash (Capacitor SplashScreen, capacitor.config.ts) is a
 * static black image baked into the binary: it can only ever be a
 * still, and changing it needs Xcode. From build 3 that still WAITS
 * for this component to dismiss it (launchAutoHide off), which is what
 * makes the hand-off seamless — and what makes the effect below
 * responsible for ALWAYS dismissing it, one way or the other. This is
 * the animated half: the penguin drops in, lands with a little weight,
 * settles; the wordmark resolves under it; a frost line runs to 100%.
 *
 * The rules it obeys, all of them deliberate:
 *  - App only (or an explicit `?splash=1` preview). On the website you
 *    clicked a link; a curtain there is just a page that takes longer.
 *  - COLD BOOT only. A fresh WebView has an empty sessionStorage, so
 *    route changes and back-navigations never replay it.
 *  - It never blocks. The app renders underneath at full speed, the
 *    curtain is purely on top, any tap dismisses it, and a failed
 *    image drops it instantly rather than leaving a black screen —
 *    the one failure mode worse than no splash at all.
 *  - It hides Capacitor's static splash the moment it is on screen —
 *    and hides it IMMEDIATELY on every path where it decides not to
 *    play, because from build 3 nothing else will.
 *  - Reduced motion skips it entirely.
 */

import { useEffect, useState } from "react";
import { isNativeApp, hideNativeSplash, appBuildNumber } from "@/lib/native";
import { APP_SPLASH_CURTAIN_ENABLED, SPLASH_HANDOFF_MIN_BUILD } from "@/lib/flags";

/** Long enough to read as a performance, short enough not to be a wait. */
const HOLD_MS = 1450;
const FADE_MS = 340;

/**
 * Which loading effect runs under the wordmark (Luca 2026-09-16 gave
 * two ideas and this is the switch between them — change the word,
 * nothing else):
 *
 *   "perimeter" — a frost line traces the edge of the phone, one full
 *                 loop, and the app opens as it closes the rectangle.
 *                 Reads as progress at a glance and is the more
 *                 distinctive of the two.
 *   "text"      — frost creeps across "Peak Music Reviews" left to
 *                 right; at 100% the curtain lifts. Quieter, and it
 *                 keeps every pixel of attention on the wordmark.
 *
 * HONEST NOTE: neither is tied to real loading progress. By the time
 * React is running, the app underneath has already rendered — the
 * curtain is a performance over a ready app, not a wait. Wiring it to
 * something real would mean holding the app back to watch a bar fill,
 * which is strictly worse for the person holding the phone.
 */
const FROST_STYLE: "perimeter" | "text" = "perimeter";

export default function SplashCurtain() {
  const [phase, setPhase] = useState<"off" | "playing" | "leaving">("off");

  useEffect(() => {
    // `?splash=1` previews it anywhere, flag or no flag, app or web.
    const preview =
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("splash") === "1";
    const native = isNativeApp();

    // On the plain web only the explicit preview ever plays.
    if (!native && !preview) return;

    let cancelled = false;
    let raise: number | undefined;
    let leave: ReturnType<typeof setTimeout> | undefined;
    let done: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      /* THE ONE RULE (build 3+, launchAutoHide off): inside the shell,
         every branch below ends in exactly one of two things — play
         the curtain, which hides the native still the frame it
         appears, or hide the still RIGHT NOW. A branch that does
         neither is a phone stuck on the launch image. That is why
         this is one decision with one exit, not a stack of early
         returns; the old shape (return on flag-off, return on
         session-played) would have been exactly that bug. */
      let play = preview;

      if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
        play = false; // accessibility wins, preview or not
      } else if (!play && native) {
        if (!APP_SPLASH_CURTAIN_ENABLED) {
          play = false;
        } else {
          // Older binaries auto-hide their still on a timer; playing
          // the curtain on top of that is the double splash Luca saw.
          // null = no PMRBuild token in the user agent = old binary.
          // (Synchronous on purpose: the first version awaited a plugin
          // call that never resolved to a number — see lib/native.ts.)
          const build = appBuildNumber();
          if (build === null || build < SPLASH_HANDOFF_MIN_BUILD) {
            play = false;
          } else {
            // COLD BOOT only: a fresh WebView has empty sessionStorage,
            // so route changes and back-navigations never replay it.
            try {
              if (sessionStorage.getItem("pmr-splash-played")) play = false;
              else sessionStorage.setItem("pmr-splash-played", "1");
            } catch {
              /* private mode / storage blocked: play it, it's once per launch anyway */
            }
          }
        }
      }

      if (cancelled) return;
      if (!play) {
        if (native) void hideNativeSplash();
        return;
      }

      // Raised on the next frame, not synchronously: the app's own
      // first paint goes up first, which is the order we want anyway —
      // the curtain is a layer over a running app, never something it
      // waits behind. The still is dropped in that same frame, so the
      // hand-off is one continuous opening.
      raise = requestAnimationFrame(() => {
        setPhase("playing");
        void hideNativeSplash();
      });
      leave = setTimeout(() => setPhase("leaving"), HOLD_MS);
      done = setTimeout(() => setPhase("off"), HOLD_MS + FADE_MS);
    })();

    return () => {
      cancelled = true;
      if (raise !== undefined) cancelAnimationFrame(raise);
      if (leave) clearTimeout(leave);
      if (done) clearTimeout(done);
    };
  }, []);

  if (phase === "off") return null;

  return (
    <div
      className={`splash-curtain splash-frost-${FROST_STYLE}${
        phase === "leaving" ? " splash-leaving" : ""
      }`}
      aria-hidden="true"
      // Any touch takes it away — nobody should ever have to wait for
      // an animation to finish before their app answers.
      onPointerDown={() => setPhase("leaving")}
    >
      {/* The perimeter frost: an SVG rectangle whose stroke draws
          itself around the screen. pathLength="100" means the dash
          maths is just percentages, whatever the phone's size. It sits
          BEHIND the mascot (z-index) and is inert to pointers. */}
      {FROST_STYLE === "perimeter" && (
        <svg className="splash-rim" viewBox="0 0 100 100" preserveAspectRatio="none">
          <rect
            className="splash-rim-track"
            x="1.2" y="1.2" width="97.6" height="97.6"
            rx="3" ry="3" pathLength="100"
          />
          <rect
            className="splash-rim-line"
            x="1.2" y="1.2" width="97.6" height="97.6"
            rx="3" ry="3" pathLength="100"
          />
        </svg>
      )}

      <div className="splash-stack">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/penguin/mark-192.webp"
          srcSet="/penguin/mark-192.webp 1x, /penguin/mark-512.webp 2x"
          alt=""
          width={173}
          height={192}
          className="splash-penguin"
          onError={() => setPhase("off")}
        />
        {/* data-text feeds the frost overlay in CSS (::after clones the
            string), so the word is never written twice in the markup. */}
        <span className="splash-wordmark" data-text="Peak Music Reviews">
          Peak Music Reviews
        </span>
      </div>
    </div>
  );
}
