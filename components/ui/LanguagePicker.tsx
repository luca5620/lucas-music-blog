"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { writeLanguageCookie } from "@/i18n/client";

/**
 * The language switch (design in i18n/config.ts). Two skins:
 *
 *  - "footer" — the six language codes as one VT323 line, so the
 *               switch is on EVERY page, signed in or not. Someone
 *               whose phone opened the site in the wrong language
 *               shouldn't need an account to fix it.
 *  - "row"    — the Settings page list, full language names.
 *
 * Choosing writes the cookie (a year, whole site) and asks Next to
 * re-render the current page on the server with the new dictionary
 * — no navigation, no reload, scroll position kept. The cookie is
 * plain document.cookie on purpose: it needs no API route, and the
 * WebView in the mobile apps stores it exactly like Safari would.
 */
export default function LanguagePicker({
  variant,
  accent,
}: {
  variant: "footer" | "row";
  /** Row skin only: highlight for the active language (falls back to the theme accent). */
  accent?: string;
}) {
  const locale = useLocale();
  const t = useTranslations("language");
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function choose(next: Locale) {
    if (next === locale) return;
    writeLanguageCookie(next);
    startTransition(() => router.refresh());
  }

  if (variant === "footer") {
    // Proper pills, not inline text (Luca 2026-09-03: "make the
    // language change buttons bigger", then "too big, meet in the middle"):
    // text-xs pills, a notch under the nav pills, still a real thumb target.
    return (
      <span
        role="group"
        aria-label={t("label")}
        className={`inline-flex flex-wrap justify-center gap-2 transition-opacity ${
          pending ? "opacity-60" : ""
        }`}
      >
        {LOCALES.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              onClick={() => choose(code)}
              aria-pressed={active}
              lang={code}
              title={LOCALE_NAMES[code]}
              className={`px-3 py-1 rounded-full text-xs font-bold tracking-wide uppercase border transition-colors font-[family-name:var(--font-heading)] ${
                active
                  ? "bg-accent-primary/15 text-accent-primary border-accent-primary/40"
                  : "text-text-secondary border-white/15 hover:text-accent-primary hover:border-accent-primary/50"
              }`}
            >
              {code}
            </button>
          );
        })}
      </span>
    );
  }

  const tint = accent ?? "var(--accent-primary)";
  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted">{t("description")}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t("label")}>
        {LOCALES.map((code) => {
          const active = code === locale;
          return (
            <button
              key={code}
              type="button"
              role="radio"
              aria-checked={active}
              lang={code}
              onClick={() => choose(code)}
              disabled={pending}
              className="px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase border transition-colors font-[family-name:var(--font-heading)] disabled:opacity-60"
              style={
                active
                  ? { color: tint, borderColor: tint, background: "rgba(255,255,255,0.04)" }
                  : { color: "#c8c8cc", borderColor: "rgba(255,255,255,0.12)" }
              }
            >
              {LOCALE_NAMES[code]}
            </button>
          );
        })}
      </div>
    </div>
  );
}
