"use client";

/**
 * Review view switching — the folder-view idea: Detailed (default),
 * Posters (dense cover wall), Compact (slim rows).
 *
 * The choice persists in localStorage so it follows the user across
 * every surface that lists reviews (reviews index, profile tabs)
 * without any account plumbing. First paint renders the default,
 * then the saved choice applies — the flicker is imperceptible and
 * avoids a server/client hydration mismatch.
 */

import { useEffect, useState } from "react";
import { useIsNativeApp } from "@/lib/useIsNativeApp";

export type ReviewView = "detailed" | "posters" | "compact";

/**
 * How many items a home/section MODULE shows per view before "View
 * All" takes over (Luca 2026-08-31): caps match the grid geometry so
 * the last row is always full — web detailed runs 5 across, and 9
 * items left a hole in row two. Web: detailed 10, posters 18,
 * compact 10. App: detailed 5, posters/compact 9. Full index pages
 * (/reviews, /releases) ARE the view-all — never cap those.
 * The server render uses the web caps and the app trims once the
 * bridge answers — see useIsNativeApp for why that's a store read
 * rather than an effect.
 */
export function useModuleLimit(view: ReviewView): number {
  const app = useIsNativeApp();
  if (app) return view === "detailed" ? 5 : 9;
  return view === "posters" ? 18 : 10;
}

const STORAGE_KEY = "pmr-review-view";
const VALID: ReviewView[] = ["detailed", "posters", "compact"];

export function useReviewView(): [ReviewView, (v: ReviewView) => void] {
  const [view, setView] = useState<ReviewView>("detailed");

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as ReviewView | null;
    if (saved && VALID.includes(saved)) setView(saved);
  }, []);

  function change(v: ReviewView) {
    setView(v);
    try {
      localStorage.setItem(STORAGE_KEY, v);
    } catch {
      /* private mode etc. — the toggle still works for this page */
    }
  }

  return [view, change];
}

const OPTIONS: { id: ReviewView; label: string; icon: React.ReactNode }[] = [
  {
    id: "detailed",
    label: "Detailed view",
    // One wide card
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
        <rect x="1" y="2" width="14" height="5" rx="1" />
        <rect x="1" y="9" width="14" height="5" rx="1" />
      </svg>
    ),
  },
  {
    id: "posters",
    label: "Poster grid view",
    // 2x2 tiles
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
        <rect x="1" y="1" width="6" height="6" rx="1" />
        <rect x="9" y="1" width="6" height="6" rx="1" />
        <rect x="1" y="9" width="6" height="6" rx="1" />
        <rect x="9" y="9" width="6" height="6" rx="1" />
      </svg>
    ),
  },
  {
    id: "compact",
    label: "Compact list view",
    // Slim lines
    icon: (
      <svg viewBox="0 0 16 16" className="w-4 h-4" fill="currentColor">
        <rect x="1" y="2" width="14" height="2.4" rx="1" />
        <rect x="1" y="6.8" width="14" height="2.4" rx="1" />
        <rect x="1" y="11.6" width="14" height="2.4" rx="1" />
      </svg>
    ),
  },
];

export function ViewToggle({
  view,
  onChange,
}: {
  view: ReviewView;
  onChange: (v: ReviewView) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-border-subtle overflow-hidden shrink-0">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          title={opt.label}
          aria-label={opt.label}
          aria-pressed={view === opt.id}
          onClick={() => onChange(opt.id)}
          // Slimmer on phones — the toggle shares a tight header row
          // with the module title and View All link.
          className={`px-1.5 py-1.5 sm:px-2.5 sm:py-2 transition-colors ${
            view === opt.id
              ? "bg-accent-primary/15 text-accent-primary"
              : "text-text-muted hover:text-text-primary hover:bg-bg-elevated"
          }`}
        >
          {opt.icon}
        </button>
      ))}
    </div>
  );
}
