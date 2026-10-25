"use client";

/**
 * PreviewButton — the ▶ on a cover (or a tracklist row) that plays a
 * 30-second preview. All state lives in lib/preview-player.ts, so one
 * preview plays at a time site-wide.
 *
 * Looks: a round tape-deck button. ▶ idle → pulsing ring while it
 * loads → three bouncing equalizer bars + a progress ring while it
 * plays (tap to stop) → a brief "—" when Spotify has no preview.
 */

import { useTranslations } from "next-intl";
import {
  usePreview,
  togglePreview,
  type PreviewSource,
  type PreviewTrack,
} from "@/lib/preview-player";

interface PreviewButtonProps {
  /** Unique per button — e.g. `spotify:<id>` or `local:<id>#<track>`. */
  previewKey: string;
  src: PreviewSource;
  /** Which track of the record to play; default = first with audio. */
  pick?: (tracks: PreviewTrack[]) => PreviewTrack | undefined;
  /** "cover" sits on a thumbnail's corner; "inline" is a plain row button. */
  variant?: "cover" | "inline";
  /** What's being previewed, for the screen-reader label. */
  label: string;
  /** Optional: told about every press, AFTER the tap has been kept
      from reaching the row. ReviewSongList uses it to close an open
      Spotify/Apple player so two songs never play at once. */
  onPress?: () => void;
}

export default function PreviewButton({
  previewKey,
  src,
  pick,
  variant = "cover",
  label,
  onPress,
}: PreviewButtonProps) {
  const t = useTranslations("catalog");
  const p = usePreview();
  const mine = p.key === previewKey;
  const status = mine ? p.status : "idle";

  const size = variant === "cover" ? "w-7 h-7" : "w-8 h-8";
  // Progress ring: a conic gradient filling with the 30 seconds.
  const ring =
    status === "playing"
      ? {
          background: `conic-gradient(var(--accent-primary) ${p.progress * 360}deg, rgba(255,255,255,0.15) 0deg)`,
        }
      : undefined;

  return (
    <button
      type="button"
      onClick={(e) => {
        // Never let the tap reach the row (which would PICK the record).
        e.preventDefault();
        e.stopPropagation();
        onPress?.();
        void togglePreview(previewKey, src, pick);
      }}
      aria-label={
        status === "playing"
          ? t("stopPreview", { title: label })
          : t("playPreview", { title: label })
      }
      title={
        status === "none"
          ? t("noPreview")
          : status === "playing" && p.trackTitle
            ? t("nowPlaying", { title: p.trackTitle })
            : t("preview")
      }
      className={`preview-btn ${size} ${variant === "cover" ? "preview-btn-cover" : ""} ${
        status === "loading" ? "preview-btn-loading" : ""
      } shrink-0 rounded-full p-[2px] transition-transform active:scale-90`}
      style={ring}
    >
      <span className="w-full h-full rounded-full bg-black/85 flex items-center justify-center text-white">
        {status === "playing" ? (
          <span className="preview-eq" aria-hidden>
            <i />
            <i />
            <i />
          </span>
        ) : status === "none" ? (
          <span className="text-[10px] font-bold text-text-muted" aria-hidden>
            —
          </span>
        ) : (
          <svg viewBox="0 0 24 24" className="w-3 h-3 ml-[1px]" fill="currentColor" aria-hidden>
            <path d="M7 4.5v15a1 1 0 0 0 1.5.87l12.5-7.5a1 1 0 0 0 0-1.74L8.5 3.63A1 1 0 0 0 7 4.5Z" />
          </svg>
        )}
      </span>
    </button>
  );
}
