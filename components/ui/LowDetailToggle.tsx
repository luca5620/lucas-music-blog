"use client";

import { setLowDetail, useLowDetail } from "@/lib/lowDetail";
import { useTranslations } from "next-intl";

/**
 * The low-detail switch (see lib/lowDetail.ts for what it does and
 * why it is per device). Two skins of the same control:
 *
 *  - "row"    — the Settings page checkbox row, styled like the other
 *               privacy toggles there (label + explanation).
 *  - "footer" — one VT323 word pair in the site footer, so the switch
 *               is on EVERY page, signed in or not, app or web. Someone
 *               whose laptop is chugging on the home page shouldn't
 *               have to make an account to turn the effects off.
 */
export default function LowDetailToggle({
  variant,
  accent,
}: {
  variant: "row" | "footer";
  /** Row skin only: checkbox + active-label tint (falls back to the theme accent). */
  accent?: string;
}) {
  const on = useLowDetail();
  const t = useTranslations("lowDetail");

  if (variant === "footer") {
    return (
      <button
        type="button"
        onClick={() => setLowDetail(!on)}
        aria-pressed={on}
        className="text-text-secondary hover:text-accent-primary transition-colors"
        title={t("footerTitle")}
      >
        {t("footer", { state: on ? t("on") : t("off") })}
      </button>
    );
  }

  const tint = accent ?? "var(--accent-primary)";
  return (
    <label className="flex items-start gap-2.5 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={on}
        onChange={(e) => setLowDetail(e.target.checked)}
        className="w-4 h-4 mt-0.5 shrink-0 cursor-pointer"
        style={{ accentColor: tint }}
      />
      <span className="min-w-0">
        <span
          className="block text-sm font-bold font-[family-name:var(--font-heading)]"
          style={{ color: on ? tint : "#c8c8cc" }}
        >
          {t("label")}
        </span>
        <span className="block text-xs text-text-muted">
          {t("description")}
        </span>
      </span>
    </label>
  );
}
