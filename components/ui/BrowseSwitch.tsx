"use client";

import Link from "next/link";
import { hapticTap } from "@/lib/native";
import { useTranslations } from "next-intl";

/**
 * BrowseSwitch — app-only segmented control at the top of /reviews
 * and /releases.
 *
 * In the native shell the browse pages live on NO bottom tab (they
 * moved to the home page's quick-access strip, 2026-08-22) — this
 * switcher flips between the two catalogs without a round trip back
 * to home. Hidden on web (.app-only), where the top nav still links
 * Releases and Reviews separately.
 */

interface BrowseSwitchProps {
  active: "reviews" | "releases";
}

const SEGMENTS = [
  // `label` = key into messages → "nav" (the same words the top nav uses).
  { key: "reviews", label: "reviews", href: "/reviews" },
  { key: "releases", label: "releases", href: "/releases" },
] as const;

export default function BrowseSwitch({ active }: BrowseSwitchProps) {
  const t = useTranslations("nav");
  return (
    <div className="app-only">
      <div className="flex rounded-full border border-border-medium bg-bg-elevated p-1 gap-1">
        {SEGMENTS.map((seg) => {
          const isActive = seg.key === active;
          return (
            <Link
              key={seg.key}
              href={seg.href}
              onClick={() => hapticTap()}
              aria-current={isActive ? "page" : undefined}
              className={`flex-1 text-center px-3 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase transition-all duration-200 font-[family-name:var(--font-heading)] ${
                isActive
                  ? "bg-accent-primary/15 text-accent-primary border border-accent-primary/30"
                  : "text-text-secondary border border-transparent"
              }`}
            >
              {t(seg.label)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
