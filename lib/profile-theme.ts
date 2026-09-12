/**
 * Profile theme lookups shared by the profile page, the hover card,
 * the settings picker and the liquid bridge — ONE table so the accent
 * hex, the display name and the liquid trio of a theme can never
 * drift apart between surfaces.
 *
 * Labels are proper names and never translate (the one-line theme
 * descriptions live in messages → settings.appearance.themeDesc).
 * Colours must match the theme-* classes in globals.css.
 */

import type { ProfileTheme } from "@/lib/types/database";

export interface ThemeSpec {
  label: string;
  /** Accent hex — what the theme-* class sets as --accent-primary. */
  accent: string;
  /** The liquid trio as "r, g, b" strings — mirrors --liquid-1/2/3. */
  trio: [string, string, string];
}

export const THEME_SPECS: Record<ProfileTheme, ThemeSpec> = {
  "crt-blue": {
    label: "Broadcast",
    accent: "#1e90ff",
    trio: ["72, 142, 232", "140, 196, 244", "34, 58, 128"], // site default
  },
  ps2: {
    label: "PS2 · Nebula",
    accent: "#8ba7e8",
    trio: ["100, 140, 220", "158, 130, 226", "36, 48, 112"],
  },
  ps3: {
    label: "PS3 · XMB",
    accent: "#7ec9e8",
    trio: ["126, 201, 232", "184, 228, 245", "74, 147, 179"],
  },
  ps4: {
    label: "PS4",
    accent: "#4a90d9",
    trio: ["74, 144, 217", "127, 179, 232", "32, 80, 150"],
  },
  "xbox-og": {
    label: "Xbox OG",
    accent: "#5dc21e",
    trio: ["93, 194, 30", "143, 232, 79", "45, 110, 15"],
  },
  "xbox-360": {
    label: "Xbox 360",
    accent: "#92c83e",
    trio: ["146, 200, 62", "184, 226, 110", "90, 130, 35"],
  },
  wii: {
    label: "Wii",
    accent: "#35b7d8",
    trio: ["53, 183, 216", "111, 210, 234", "160, 205, 235"],
  },
  limewire: {
    label: "LimeWire",
    accent: "#32cd32",
    trio: ["50, 205, 50", "102, 231, 102", "32, 140, 32"],
  },
  bleach: {
    label: "Soul Reaper",
    accent: "#e3342f",
    trio: ["227, 52, 47", "232, 230, 227", "122, 22, 18"],
  },
  "daft-punk": {
    label: "Robot Rock",
    accent: "#f0b93c",
    trio: ["240, 185, 60", "255, 215, 110", "150, 100, 22"],
  },
};

export const VALID_THEMES = Object.keys(THEME_SPECS) as ProfileTheme[];

/** Unknown / pre-migration values fall back to the site default. */
export function resolveTheme(value: unknown): ProfileTheme {
  return VALID_THEMES.includes(value as ProfileTheme)
    ? (value as ProfileTheme)
    : "crt-blue";
}

/** Accent hex for a theme (defaults for unknown values). */
export function themeAccent(theme: unknown): string {
  return THEME_SPECS[resolveTheme(theme)].accent;
}

/** The theme's liquid trio as a CSS gradient — the "mini" of a theme
    on the hover card: the same three colours its page glows in. */
export function themeGradient(theme: unknown): string {
  const [a, b, c] = THEME_SPECS[resolveTheme(theme)].trio;
  return `linear-gradient(100deg, rgb(${c}) 0%, rgb(${a}) 45%, rgb(${b}) 100%)`;
}
