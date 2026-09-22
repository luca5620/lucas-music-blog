"use client";

/**
 * SplashCurtain — the app's opening, continued in the web layer.
 *
 * ON from build 3 (2026-09-21), gated on the shell's build number —
 * see APP_SPLASH_CURTAIN_ENABLED / SPLASH_HANDOFF_MIN_BUILD in
 * lib/flags.ts for the double-splash history and why the gate exists.
 * Preview it any time with `?splash=1`.
 *
 * WHAT THIS IS: a live copy of the native launch image, not a second
 * screen. The native splash (Capacitor SplashScreen) is a static PNG
 * baked into the binary; from build 3 it WAITS for this component to
 * dismiss it. The bird and the wordmark here are pinned to that
 * image's own geometry (app/globals.css, numbers printed by
 * scripts/build-splash.py), so when the still is dropped, the pixels
 * underneath are in the same places and the handoff is invisible.
 * The only thing that then moves is the frost closing in, and the
 * lift.
 *
 * It got here the hard way. The first version animated: the bird
 * dropped in from above, the wordmark resolved out of wide tracking,
 * both at sizes that were near the launch image's but not equal to
 * them. Luca, 2026-09-21: "the original splash still plays, and then
 * the second one you just made plays after... I want the splash to
 * look exactly the same as the old one." Two pictures in a row read
 * as two splashes no matter how cleanly they hand off, so there is
 * now only one picture.
 *
 * The rules it obeys, all of them deliberate:
 *  - App only (or an explicit `?splash=1` preview). On the website you
 *    clicked a link; a curtain there is just a page that takes longer.
 *  - COLD BOOT only. A fresh WebView has an empty sessionStorage, so
 *    route changes and back-navigations never replay it.
 *  - It never blocks. The app renders underneath at full speed, the
 *    curtain is purely on top, and any tap dismisses it.
 *  - It hides Capacitor's static splash the moment it is on screen —
 *    and hides it IMMEDIATELY on every path where it decides not to
 *    play, because from build 3 nothing else will.
 *  - Reduced motion skips it entirely.
 */

import { useEffect, useState } from "react";
import { isNativeApp, hideNativeSplash, appBuildNumber } from "@/lib/native";
import { APP_SPLASH_CURTAIN_ENABLED, SPLASH_HANDOFF_MIN_BUILD } from "@/lib/flags";

/** Long enough to read as a performance, short enough not to be a wait.
 *  Shorter than it was: the native still now shows this same picture
 *  for a second or so before the curtain takes over, so the clock the
 *  person actually feels started well before this does. */
const HOLD_MS = 1150;
const FADE_MS = 340;
/** sessionStorage flag: "the curtain has been ON SCREEN this session". */
const PLAYED_KEY = "pmr-splash-played";

/** The mascot, at a size that survives a 3x phone: the curtain draws
 *  him ~208pt tall, which is ~626 device pixels. Same cut-out the
 *  launch image is built from, so neither is the softer of the two. */
const MASCOT = "/penguin/mark-768.webp";

/**
 * How long to wait for that image and the PlayStation face before
 * giving up on the curtain.
 *
 * Nothing is shown until BOTH have arrived, because a curtain raised
 * early is the failure this whole component exists to avoid: the
 * still has a bird and a wordmark, and dropping it to reveal a black
 * screen that is still fetching them would be the two-splash problem
 * with an extra flash in the middle. Waiting costs nothing on screen —
 * the native still is up, showing exactly what we are about to draw.
 * Past this point we assume a bad network, drop the still and let the
 * app through with no curtain at all. One launch without an opening
 * beats a launch that stutters.
 */
const READY_MS = 900;

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
    let gate: ReturnType<typeof setTimeout> | undefined;

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
          // Synchronous on purpose: nothing to await means nothing for
          // a hydration remount to interrupt — see lib/native.ts.
          const build = appBuildNumber();
          if (build === null || build < SPLASH_HANDOFF_MIN_BUILD) {
            play = false;
          } else {
            // COLD BOOT only: a fresh WebView has empty sessionStorage,
            // so route changes and back-navigations never replay it.
            // READ here; the WRITE happens once the curtain is actually
            // on screen, in the frame callback below.
            let seen = false;
            try {
              seen = !!sessionStorage.getItem(PLAYED_KEY);
            } catch {
              /* private mode / storage blocked: play it, it's once per launch anyway */
            }
            // THE LINE THAT WAS MISSING (2026-09-21). `play` starts as
            // `preview`, and the first version of this decision only
            // ever assigned `false` — every gate could pass and the
            // value simply never became true, so a real cold launch
            // always took the hide-now exit while ?splash=1 (preview
            // = true from the start) always played. Found with an
            // in-page tracer: all inputs said play, hide() fired at
            // 419ms synchronously from this chunk, before any frame.
            play = !seen;
          }
        }
      }

      if (cancelled) return;
      if (!play) {
        if (native) void hideNativeSplash();
        return;
      }

      // Both halves of the picture, or nothing — see READY_MS.
      const ready = Promise.all([
        new Promise<void>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve();
          img.onerror = () => reject(new Error("mascot"));
          img.src = MASCOT;
        }),
        // The launch image's wordmark IS this face. Rendering the
        // fallback for a moment would be a visible substitution, and
        // with no font-display set a slow font shows nothing at all.
        document.fonts?.load("1em PlayStation") ?? Promise.resolve(),
      ]);
      try {
        await Promise.race([
          ready,
          new Promise((_, reject) => {
            gate = setTimeout(() => reject(new Error("slow")), READY_MS);
          }),
        ]);
      } catch {
        if (!cancelled && native) void hideNativeSplash();
        return; // no curtain this launch; the app is already behind it
      }
      if (gate) clearTimeout(gate);
      if (cancelled) return;

      // Raised on the next frame, and the still dropped in that same
      // frame, so the two swap inside one paint.
      raise = requestAnimationFrame(() => {
        /* THE SESSION KEY IS WRITTEN HERE, AT PAINT TIME, and nowhere
           else. It means "the curtain has actually been on screen this
           session", which is the only thing the key is for: no replay
           on route changes or back-navigation. Writing it at decision
           time instead would let a mount that is torn down before this
           frame (React does remount subtrees when hydration fails, and
           this site has had hydration errors on the home page) leave a
           key behind for the mount that survives — so the survivor
           would wrongly skip. Cheap insurance. For the record: this was
           first suspected as the reason the curtain never played, and
           it was NOT — the launch that finally got traced showed no
           remount at all. The real cause was the missing `play = !seen`
           above. */
        try {
          if (!preview) sessionStorage.setItem(PLAYED_KEY, "1");
        } catch {
          /* storage blocked: fine, see above */
        }
        setPhase("playing");
        /* AND ONLY THEN DROP THE STILL — two frames later, not in this
           one. React has been told to render; it has not rendered yet,
           and WebKit has not composited. Dropping the still here is
           what put a second of black at the front of every launch
           (measured 2026-09-21: the native view's alpha went to 0 at
           ~500ms while the WebView's first paint did not arrive until
           ~1.4s, so the phone showed nothing in between). A rAF
           callback runs before a paint, so one is not enough; the
           second fires after the frame carrying the curtain has been
           committed. If WebKit never gets there, the <head> failsafe
           in lib/native.ts still drops the still at 5s. */
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            void hideNativeSplash();
          });
        });
      });
      leave = setTimeout(() => setPhase("leaving"), HOLD_MS);
      done = setTimeout(() => setPhase("off"), HOLD_MS + FADE_MS);
    })();

    return () => {
      cancelled = true;
      if (raise !== undefined) cancelAnimationFrame(raise);
      if (gate) clearTimeout(gate);
      if (leave) clearTimeout(leave);
      if (done) clearTimeout(done);
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
        src={MASCOT}
        alt=""
        width={692}
        height={768}
        className="splash-penguin"
        // Preloaded above, so this is the belt to that braces: if the
        // file vanishes between the two, drop the whole curtain rather
        // than leave a wordmark floating on black.
        onError={() => setPhase("off")}
      />
      <span className="splash-wordmark">Peak Music Reviews</span>

      {/* Frost creeps in from all four edges. One tile per axis,
          repeated along the edge and flipped for the far side, so
          every edge is the same ice at the same scale on any phone —
          see the FROST block in app/globals.css. */}
      <div className="splash-frost">
        <i className="splash-frost-t" />
        <i className="splash-frost-b" />
        <i className="splash-frost-l" />
        <i className="splash-frost-r" />
      </div>
    </div>
  );
}
