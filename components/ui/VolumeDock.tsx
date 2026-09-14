"use client";

/**
 * VolumeDock — the site-wide volume control (Luca 2026-09-13: "have
 * it be site-wide, it'll only show up on pages with a preview
 * player").
 *
 * Mounted once in the root layout and USUALLY INVISIBLE: it renders
 * nothing until a player that can actually be turned down is on
 * screen. Every SoundCloud/YouTube frame registers itself while it is
 * mounted (lib/volume.ts), so the dock appears on a release page with
 * the SoundCloud player, on an aux battle stage once songs are
 * playing, and in the Your Taste pager — and stays out of the way
 * everywhere else.
 *
 * Collapsed it is one speaker button; tapping opens the slider. The
 * note inside is the honest part: Spotify and Apple Music give
 * embedders no volume control at all, so those players keep their own
 * (see lib/volume.ts for the full picture).
 */

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { getPlayerCount, subscribePlayers } from "@/lib/volume";
import { hapticTap } from "@/lib/native";
import VolumeSlider from "@/components/ui/VolumeSlider";

export default function VolumeDock() {
  const t = useTranslations("volume");
  // 0 on the server, so the dock is simply absent from the HTML and
  // appears once a real player registers on the client.
  const players = useSyncExternalStore(subscribePlayers, getPlayerCount, () => 0);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Fold the panel shut when the last player leaves the screen (swiped
  // past, navigated away, room finished) so it doesn't spring open
  // again on the next page that happens to have a player. Adjusted
  // during render, React's documented way — an effect that setStates
  // would just cause a second render pass.
  const [seenPlayers, setSeenPlayers] = useState(players);
  if (players !== seenPlayers) {
    setSeenPlayers(players);
    if (players === 0 && open) setOpen(false);
  }

  // Tap outside / Esc closes the panel.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (players === 0) return null;

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
                setOpen(false);
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
            setOpen(true);
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
