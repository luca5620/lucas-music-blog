"use client";

/**
 * ThemeLiquidSync — pushes the profile theme's liquid trio up onto
 * <html>, so the SITE-WIDE liquid (the room glow beside the bezel +
 * the canvas wash behind everything) recolors to match the profile
 * you're viewing. The theme-* class only wraps the profile content,
 * so CSS inheritance can't reach those global layers — this bridges
 * the gap. Colors reset when you leave the profile.
 *
 * Trios must mirror the --liquid-* values in globals.css.
 */

import { useEffect } from "react";
import type { ProfileTheme } from "@/lib/types/database";

const TRIOS: Record<ProfileTheme, [string, string, string]> = {
  "crt-blue": ["160, 224, 171", "255, 172, 46", "165, 45, 37"], // site default
  ps3: ["126, 201, 232", "184, 228, 245", "74, 147, 179"],
  ps4: ["74, 144, 217", "127, 179, 232", "32, 80, 150"],
  "xbox-og": ["93, 194, 30", "143, 232, 79", "45, 110, 15"],
  "xbox-360": ["146, 200, 62", "184, 226, 110", "90, 130, 35"],
  wii: ["53, 183, 216", "111, 210, 234", "160, 205, 235"],
  limewire: ["50, 205, 50", "102, 231, 102", "32, 140, 32"],
  bleach: ["227, 52, 47", "232, 230, 227", "122, 22, 18"],
  "daft-punk": ["240, 185, 60", "255, 215, 110", "150, 100, 22"],
};

export default function ThemeLiquidSync({ theme }: { theme: ProfileTheme }) {
  useEffect(() => {
    const root = document.documentElement;
    const trio = TRIOS[theme] ?? TRIOS["crt-blue"];
    root.style.setProperty("--liquid-1", trio[0]);
    root.style.setProperty("--liquid-2", trio[1]);
    root.style.setProperty("--liquid-3", trio[2]);
    return () => {
      root.style.removeProperty("--liquid-1");
      root.style.removeProperty("--liquid-2");
      root.style.removeProperty("--liquid-3");
    };
  }, [theme]);

  return null;
}
