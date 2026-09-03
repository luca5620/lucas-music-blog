"use client";

/**
 * Collapsible settings section (Luca 2026-09-03: "add dropdowns for
 * settings since the page is starting to get a bit lengthy").
 *
 * One panel-xbox per section, with the section's label-xbox tag as
 * the press target. Collapsed by default so the page reads as a
 * short table of contents: tap a heading, the section unfolds under
 * it. The hint line under the title says what's inside so nobody has
 * to open a section to find out.
 *
 * The open/closed state of every section is remembered in
 * localStorage (per section id) so the page comes back the way you
 * left it — handy in the app, where Settings is a tab you keep
 * returning to. Read/write are wrapped in try/catch: private
 * browsing and the WebView can both refuse storage, and a refusal
 * must never break the page.
 *
 * It's a press target, not a swipe affordance (Luca's rule for sheets
 * applies here too): a whole-width button with a chevron, nothing to
 * drag. The chevron rotates with a plain `transform` — Tailwind v4's
 * rotate-* utilities are standalone properties that `transition:
 * transform` doesn't animate, so the style is written by hand.
 */

import { useState } from "react";

interface Props {
  /** Stable key — also the localStorage slot. */
  id: string;
  title: string;
  /** What's inside, shown under the title while collapsed. */
  hint?: string;
  /** Start open the first time (before any stored preference). */
  defaultOpen?: boolean;
  /** Extra classes for the panel (e.g. a red border for danger zones). */
  className?: string;
  /** Tint for the title tag — falls back to the theme accent. */
  accent?: string;
  /**
   * The panel clips its contents by default (panel-xbox is
   * overflow:hidden). Sections that pop a dropdown (the catalog
   * search) need it visible so the results aren't cut off.
   */
  overflowVisible?: boolean;
  children: React.ReactNode;
}

const STORAGE_PREFIX = "settings-section:";

function readStored(id: string): boolean | null {
  try {
    const v = window.localStorage.getItem(STORAGE_PREFIX + id);
    if (v === "open") return true;
    if (v === "closed") return false;
  } catch {
    /* storage refused — fall through */
  }
  return null;
}

function writeStored(id: string, open: boolean) {
  try {
    window.localStorage.setItem(STORAGE_PREFIX + id, open ? "open" : "closed");
  } catch {
    /* storage refused — the section still toggles, it just won't be remembered */
  }
}

export default function SettingsSection({
  id,
  title,
  hint,
  defaultOpen = false,
  className = "",
  accent,
  overflowVisible = false,
  children,
}: Props) {
  // The remembered state is read once, in the lazy initializer. That's
  // safe here because the Settings page only mounts its sections
  // AFTER the profile has loaded on the client (it shows "TUNING…"
  // until then), so there is no server-rendered copy to disagree
  // with. The typeof guard keeps it honest if that ever changes.
  const [open, setOpen] = useState<boolean>(() =>
    typeof window === "undefined" ? defaultOpen : (readStored(id) ?? defaultOpen)
  );

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      writeStored(id, next);
      return next;
    });
  }

  const bodyId = `settings-section-${id}`;

  return (
    <section
      className={`panel-xbox ${overflowVisible ? "!overflow-visible" : ""} ${className}`}
    >
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={bodyId}
        className="w-full flex items-center justify-between gap-3 p-5 text-left"
      >
        <span className="min-w-0 space-y-1">
          <span className="label-xbox" style={accent ? { color: accent } : undefined}>
            {title}
          </span>
          {hint && !open && (
            <span className="block text-xs text-text-muted leading-snug">
              {hint}
            </span>
          )}
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5 shrink-0 text-text-secondary"
          style={{
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.18s ease-out",
          }}
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div id={bodyId} className="px-5 pb-5 space-y-4">
          {children}
        </div>
      )}
    </section>
  );
}
