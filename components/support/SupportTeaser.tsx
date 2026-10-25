"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useWebOnly } from "@/lib/useWebOnly";
import RoleBadge from "@/components/ui/RoleBadge";

/**
 * SupportTeaser — the "Support Peak Music" plug, WEBSITE ONLY
 * (2026-10-25, Luca: "replace the channel for you module… to direct
 * to support", plus About + Settings).
 *
 * Renders nothing on the server and nothing inside the app shell
 * (useWebOnly): the app must never point anyone at paying outside
 * Apple (3.1.1 / 3.1.3). Three looks, same words:
 *   "home"     — the end-of-feed panel that used to plug Your Taste
 *   "about"    — a labelled section at the bottom of /about
 *   "settings" — just the line + button; the page wraps it in a
 *                SettingsSection (which needs the hook too, so the
 *                page also checks useWebOnly itself)
 */
export default function SupportTeaser({ variant }: { variant: "home" | "about" | "settings" }) {
  const t = useTranslations("support");
  if (!useWebOnly()) return null;

  const button = (
    <Link href="/support" className="btn-y2k btn-y2k-outline shrink-0">
      {t("teaserCta")}
    </Link>
  );

  if (variant === "settings") {
    return (
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <p className="text-sm text-text-secondary flex items-center gap-2">
          <RoleBadge role="supporter" size="sm" />
          <span>{t("teaserBody")}</span>
        </p>
        {button}
      </div>
    );
  }

  if (variant === "about") {
    return (
      <section className="space-y-3">
        <div className="vhs-label inline-block text-sm">{t("aboutLabel")}</div>
        <div className="panel-xbox p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
          <p className="text-sm sm:text-base text-text-secondary leading-relaxed flex items-center gap-2">
            <RoleBadge role="supporter" size="sm" />
            <span>{t("teaserBody")}</span>
          </p>
          {button}
        </div>
      </section>
    );
  }

  // "home": same shape as the old Your Taste teaser it replaces.
  return (
    <section className="panel-xbox p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
      <div>
        <p className="pixel-text text-lg text-accent-glow">{t("teaserTitle")}</p>
        <p className="text-xs text-text-secondary mt-1">{t("teaserBody")}</p>
      </div>
      {button}
    </section>
  );
}
