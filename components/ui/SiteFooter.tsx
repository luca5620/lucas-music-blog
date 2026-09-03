/**
 * SiteFooter — one quiet line at the bottom of every page.
 *
 * Now that contact@peakmusicreviews.com actually forwards somewhere
 * (ImprovMX, 2026-08-19), every page invites bug reports. Small on
 * purpose: it's a service hatch, not a section.
 */
import Link from "next/link";
import PressTapTarget from "@/components/ui/PressTapTarget";
import LowDetailToggle from "@/components/ui/LowDetailToggle";
import LanguagePicker from "@/components/ui/LanguagePicker";
import { getTranslations } from "next-intl/server";

export default async function SiteFooter() {
  // Server component: the async getTranslations, not the hook.
  const t = await getTranslations("footer");
  return (
    <footer className="mt-12 pt-4 border-t border-border-subtle">
      <p className="font-[family-name:var(--font-vt323)] text-sm text-text-muted text-center">
        {/* 5 quick taps on this text = press mode (screenshot blur) —
            the app shell has no URL bar for ?press=1 */}
        <PressTapTarget>{t("foundAProblem")}</PressTapTarget>{" "}
        <a
          href="mailto:contact@peakmusicreviews.com"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          contact@peakmusicreviews.com
        </a>
      </p>
      <p className="font-[family-name:var(--font-vt323)] text-sm text-text-muted text-center mt-1">
        {/* About lives here so it's reachable from EVERY page — the
            dashboard's About button only exists when signed in, which
            read as "the button disappeared" to logged-out visitors. */}
        <Link
          href="/about"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          {t("about")}
        </Link>
        {" · "}
        <Link
          href="/privacy"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          {t("privacy")}
        </Link>
        {" · "}
        <Link
          href="/terms"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          {t("terms")}
        </Link>
        {" · "}
        {/* Switcher landing page — footer link on every page gives it
            crawlable internal linking (it's in no nav menu). */}
        <Link
          href="/musicboard-alternative"
          className="text-text-secondary hover:text-accent-primary transition-colors"
        >
          {t("switching")}
        </Link>
        {" · "}
        {/* Per-device performance switch, reachable from every page
            without an account (lib/lowDetail.ts). */}
        <LowDetailToggle variant="footer" />
      </p>
      {/* LANGUAGES: six pill buttons, reachable without an account
          (i18n/config.ts). Settings has the full-name version. */}
      <div className="flex justify-center mt-3">
        <LanguagePicker variant="footer" />
      </div>
    </footer>
  );
}
