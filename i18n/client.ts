"use client";

import { LANG_COOKIE, type Locale } from "./config";

/**
 * Writes the language cookie the server reads (i18n/request.ts).
 * Plain document.cookie on purpose: no API route needed, and the
 * WebView in the mobile apps stores it exactly like Safari would.
 * One year, whole site, SameSite=Lax (first-party only).
 *
 * Lives outside any component so React's immutability lint doesn't
 * see a global being mutated from render scope — the picker calls
 * this from its click handler, then asks Next to re-render.
 */
export function writeLanguageCookie(locale: Locale): void {
  document.cookie = `${LANG_COOKIE}=${locale}; path=/; max-age=31536000; SameSite=Lax`;
}
