"use client";

import { useEffect } from "react";

/**
 * PressMode — hidden screenshot mode for App Store / marketing assets.
 *
 * Why: App Review (Guideline 5.2.1, Aug 2026 rejection) flags
 * protected album artwork in listing screenshots. Covers INSIDE the
 * app are fine — the listing images are not. This mode blurs every
 * catalog cover site-wide (CSS in globals.css under PRESS MODE) so
 * screenshots can be taken straight from the real app with nothing
 * identifiable.
 *
 * Usage — visit any page with:
 *   ?press=1  → blur on (persists across navigation via localStorage)
 *   ?press=0  → back to normal
 * Invisible to anyone who doesn't know the parameter.
 */
export default function PressMode() {
  useEffect(() => {
    const KEY = "pmr-press-mode";
    try {
      const param = new URLSearchParams(window.location.search).get("press");
      if (param === "1") localStorage.setItem(KEY, "1");
      if (param === "0") localStorage.removeItem(KEY);
      document.documentElement.classList.toggle(
        "press-mode",
        localStorage.getItem(KEY) === "1"
      );
    } catch {
      // Storage blocked (private mode etc.) — honor the param alone.
      const param = new URLSearchParams(window.location.search).get("press");
      document.documentElement.classList.toggle("press-mode", param === "1");
    }
  }, []);

  return null;
}
