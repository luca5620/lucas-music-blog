"use client";

/**
 * VolumeSlider — the one control for how loud previews play (Luca
 * 2026-09-13). Speaker button mutes and un-mutes (remembering where
 * the level was), the slider sets it, and the level is shared by
 * every player on the site through lib/volume.ts.
 *
 * It is only rendered where a player can actually answer it —
 * SoundCloud and YouTube. When a Spotify or Apple Music player is
 * sharing the screen, `note` carries the one line that says those two
 * keep their own volume, so nobody drags this expecting them to move.
 */

import { useEffect, useRef, useSyncExternalStore } from "react";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { getVolume, setVolume, subscribeVolume } from "@/lib/volume";

/** The level the server renders with — localStorage isn't there yet. */
const SERVER_LEVEL = 80;

export default function VolumeSlider({
  /** Shown under the slider — e.g. "Spotify sets its own volume". */
  note,
  className = "",
}: {
  note?: string;
  className?: string;
}) {
  const t = useTranslations("volume");
  // The shared store IS the state: the server paints the default, the
  // client swaps in the stored level on hydration, and every other
  // slider on the site moves this one through the same subscription.
  const level = useSyncExternalStore(subscribeVolume, getVolume, () => SERVER_LEVEL);

  // Where to come back to when the speaker is un-muted.
  const lastAudible = useRef(SERVER_LEVEL);
  useEffect(() => {
    if (level > 0) lastAudible.current = level;
  }, [level]);

  function change(next: number) {
    if (next > 0) lastAudible.current = next;
    setVolume(next);
  }

  const muted = level === 0;
  const icon = muted ? "🔇" : level < 34 ? "🔈" : level < 67 ? "🔉" : "🔊";

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => change(muted ? lastAudible.current || SERVER_LEVEL : 0)}
          aria-label={muted ? t("unmute") : t("mute")}
          title={muted ? t("unmute") : t("mute")}
          className="text-base leading-none shrink-0 transition-transform active:scale-90"
        >
          {icon}
        </button>
        <input
          type="range"
          min={0}
          max={100}
          step={1}
          value={level}
          onChange={(e) => change(Number(e.target.value))}
          aria-label={t("label")}
          className="volume-range flex-1 min-w-[6rem]"
        />
        <span className="pixel-text text-[10px] tabular-nums text-text-muted w-8 text-right shrink-0">
          {level}
        </span>
      </div>
      {note && <p className="text-[10px] text-text-muted leading-snug">{note}</p>}
    </div>
  );
}
