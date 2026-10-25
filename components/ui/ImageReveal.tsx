"use client";

/**
 * ImageReveal — site-wide cover-art blur-up (Luca 2026-08-27).
 *
 * One capture-phase 'load' listener on the document (img load events
 * don't bubble, but they DO capture): any image that finishes
 * loading after mount gets a one-shot fade-in + deblur animation
 * class, then sheds it on animationend so later re-renders never
 * replay the reveal. Images already complete when we attach (browser
 * cache, back-navigation) never animate — no pop on cached pages.
 *
 * Zero per-component wiring: every cover, avatar, and banner on the
 * site inherits the treatment through this single component.
 */

import { useEffect } from "react";

export default function ImageReveal() {
  useEffect(() => {
    const onLoad = (e: Event) => {
      const t = e.target as HTMLElement;
      if (!t || t.tagName !== "IMG") return;
      // Skip images React hasn't hydrated yet (2026-10-25). A streamed
      // section (e.g. the profile's On rotation widget behind Suspense)
      // can finish loading its cover BEFORE React adopts that HTML; adding
      // a class then makes the server/client markup differ and React logs
      // a hydration mismatch. React tags every element it owns with a
      // "__reactFiber$…" key, so no key = not hydrated = just show it
      // without the fade, like a cached image.
      if (!Object.keys(t).some((k) => k.startsWith("__reactFiber"))) return;
      t.classList.add("img-reveal");
      t.addEventListener(
        "animationend",
        () => t.classList.remove("img-reveal"),
        { once: true }
      );
    };
    document.addEventListener("load", onLoad, true);
    return () => document.removeEventListener("load", onLoad, true);
  }, []);

  return null;
}
