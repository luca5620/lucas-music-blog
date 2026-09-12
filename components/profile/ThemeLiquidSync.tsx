"use client";

/**
 * ThemeLiquidSync — pushes the profile theme's liquid trio up onto
 * <html>, so the SITE-WIDE liquid (the room glow beside the bezel +
 * the canvas wash behind everything) recolors to match the profile
 * you're viewing. The theme-* class only wraps the profile content,
 * so CSS inheritance can't reach those global layers — this bridges
 * the gap. Colors reset when you leave the profile.
 *
 * Trios live in lib/profile-theme.ts (one table with the accents and
 * labels) and must mirror the --liquid-* values in globals.css.
 */

import { useEffect } from "react";
import type { ProfileTheme } from "@/lib/types/database";
import { LIQUID_CHANGE_EVENT } from "@/lib/liquidMaterial";
import { THEME_SPECS, resolveTheme } from "@/lib/profile-theme";

export default function ThemeLiquidSync({ theme }: { theme: ProfileTheme }) {
  useEffect(() => {
    const root = document.documentElement;
    const trio = THEME_SPECS[resolveTheme(theme)].trio;
    root.style.setProperty("--liquid-1", trio[0]);
    root.style.setProperty("--liquid-2", trio[1]);
    root.style.setProperty("--liquid-3", trio[2]);
    // Wakes every LiquidField so the glide starts now, not on poll.
    window.dispatchEvent(new Event(LIQUID_CHANGE_EVENT));
    return () => {
      root.style.removeProperty("--liquid-1");
      root.style.removeProperty("--liquid-2");
      root.style.removeProperty("--liquid-3");
      window.dispatchEvent(new Event(LIQUID_CHANGE_EVENT));
    };
  }, [theme]);

  return null;
}
