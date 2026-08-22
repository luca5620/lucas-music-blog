"use client";

import Link from "next/link";
import { hapticTap } from "@/lib/native";

/**
 * BrowseSwitch — app-only segmented control at the top of /reviews
 * and /releases.
 *
 * In the native shell the two browse pages share ONE bottom tab
 * (REVIEWS — the app is Peak Music Reviews, the reviews name leads),
 * freeing a tab slot for Friends. This switcher is how you move
 * between the two views inside that tab. Hidden on web (.app-only),
 * where the top nav still links Releases and Reviews separately.
 */

interface BrowseSwitchProps {
  active: "reviews" | "releases";
}

const SEGMENTS = [
  { key: "reviews", label: "Reviews", href: "/reviews" },
  { key: "releases", label: "Releases", href: "/releases" },
] as const;

export default function BrowseSwitch({ active }: BrowseSwitchProps) {
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
              {seg.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
