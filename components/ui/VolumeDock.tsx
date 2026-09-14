"use client";

/**
 * VolumeDock — the volume mixer, PERMANENT on the pages that carry
 * previews (Luca 2026-09-13: "just a volume mixer on the website
 * permanently, like even if there wasn't sound, but just for pages
 * that have previews, which include releases, aux battles, and your
 * taste").
 *
 * So it is the ROUTE that decides, not whether something happens to
 * be playing: open a release page, an aux battle or Your Taste and
 * the mixer is sitting there, ready, before anyone presses play. On
 * every other page it isn't rendered at all.
 *
 * Collapsed it is a speaker button bottom-right; open it holds the
 * slider, and that open/closed choice is remembered, so it stays how
 * you left it as you move between preview pages.
 *
 * What it can and cannot move is in lib/volume.ts: SoundCloud and
 * YouTube take a volume command, Spotify and Apple Music expose none.
 * The note inside the panel says exactly that rather than leaving
 * anyone to wonder why one player ignores the slider.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { getDockOpen, setDockOpen, subscribeDockOpen } from "@/lib/volume";
import { hapticTap } from "@/lib/native";
import VolumeSlider from "@/components/ui/VolumeSlider";

/** The page trees that carry a preview player. */
const PREVIEW_ROUTES = ["/releases", "/aux-battles", "/your-taste"];

function isPreviewPage(pathname: string | null): boolean {
  if (!pathname) return false;
  return PREVIEW_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`)
  );
}

export default function VolumeDock() {
  const t = useTranslations("volume");
  const pathname = usePathname();
  // Closed on the server (localStorage isn't there); the remembered
  // choice lands on hydration.
  const open = useSyncExternalStore(subscribeDockOpen, getDockOpen, () => false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Tap outside / Esc folds it away. Only bound while it is open.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setDockOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDockOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!isPreviewPage(pathname)) return null;

  return (
    <div ref={panelRef} className="volume-dock">
      {open ? (
        <div className="volume-dock-panel">
          <div className="flex items-center justify-between gap-3">
            <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
              {t("label")}
            </span>
            <button
              type="button"
              onClick={() => {
                hapticTap();
                setDockOpen(false);
              }}
              aria-label={t("close")}
              className="pixel-text text-xs text-text-muted hover:text-accent-primary transition-colors"
            >
              ✕
            </button>
          </div>
          <VolumeSlider note={t("note")} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            hapticTap();
            setDockOpen(true);
          }}
          aria-label={t("open")}
          title={t("open")}
          className="volume-dock-button"
        >
          🔊
        </button>
      )}
    </div>
  );
}
