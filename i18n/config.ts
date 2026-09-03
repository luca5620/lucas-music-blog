/**
 * LANGUAGES (Luca 2026-09-03: "support for very common languages like
 * spanish, french, portuguese" + Dutch + German, China a far-off idea).
 *
 * What gets translated: the words WE wrote — menus, buttons, labels,
 * hints, empty states, error copy. What never does: reviews, lists,
 * posts and chat (they read the way their authors meant them), the
 * catalog (artist/album/track names from Spotify + Genius), anything
 * from an API, and page metadata (titles/descriptions/OpenGraph stay
 * English — the site's SEO is English, by decision).
 *
 * HOW IT WORKS — no URL prefixes, one cookie. `/reviews` is the same
 * page in every language; the `pmr-lang` cookie picks which dictionary
 * (messages/<locale>.json) the server renders with. That means no
 * link anywhere changes, nothing is duplicated, and the mobile apps
 * (a WebView loading this very site) get every language on the next
 * deploy with no rebuild — WKWebView keeps cookies like Safari does.
 *
 * Resolution order (i18n/request.ts): the cookie if set → the
 * browser's Accept-Language header (a Dutch phone opens in Dutch on
 * its first visit) → English.
 *
 * Portuguese here is Brazilian Portuguese — the larger market, and
 * perfectly readable in Portugal.
 */

export const LOCALES = ["en", "es", "fr", "pt", "nl", "de"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Cookie the picker writes and the server reads. One year, whole site. */
export const LANG_COOKIE = "pmr-lang";

/** Each language in its OWN name — a picker should never make you
 *  read a language you don't know to find yours. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: "English",
  es: "Español",
  fr: "Français",
  pt: "Português",
  nl: "Nederlands",
  de: "Deutsch",
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/**
 * Best supported language from an Accept-Language header, e.g.
 * "nl-NL,nl;q=0.9,en;q=0.8" → "nl". Walks the list in the browser's
 * own preference order and takes the first one we speak; falls back
 * to English. Region tags are dropped (pt-BR and pt-PT both → pt).
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params
        .map((p) => p.trim())
        .find((p) => p.startsWith("q="));
      const weight = q ? Number(q.slice(2)) : 1;
      return { lang: tag.toLowerCase().split("-")[0], weight: Number.isNaN(weight) ? 0 : weight, index };
    })
    .sort((a, b) => b.weight - a.weight || a.index - b.index);
  for (const { lang } of ranked) {
    if (isLocale(lang)) return lang;
  }
  return DEFAULT_LOCALE;
}
