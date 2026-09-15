"use client";

/**
 * FavoritePlayers — the Personal Favorites list on a review page,
 * with the viewer's own preview player folded into every pick (Luca
 * 2026-09-15). Tap a song, it plays right there; the card stays a
 * short list until you do.
 *
 * "The designated preview player" means exactly what it means on the
 * release page: the service the viewer chose in Settings. The page
 * builds each `src` server-side — Apple's song player for members on
 * Apple Music, Spotify's track player for everyone else (SoundCloud
 * is on hold behind lib/flags.ts and falls back to Spotify), so this
 * shell never decides anything about services or ids.
 *
 * ONE open at a time, and closing UNMOUNTS the iframe. That is
 * deliberate and the opposite of PlayerTabs (which keeps its single
 * player mounted so the music survives a tab flip): here a hidden
 * player would be audio you can see no way to stop, and ten mounted
 * iframes on a ten-pick card would be ten players loading at once.
 * Open = there is a player; closed = there isn't.
 */

import { useState } from "react";
// LANGUAGES: every word comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { hapticTap } from "@/lib/native";

export interface FavoriteTrack {
  title: string;
  /** The embed src for this song, or null when the catalog has no
      playable id for it — that row stays a plain line. */
  src: string | null;
  source: "spotify" | "apple";
  /** The song on the service itself; "" when we don't have it. */
  openUrl: string;
}

export default function FavoritePlayers({ tracks }: { tracks: FavoriteTrack[] }) {
  const t = useTranslations("reviews.page");
  const tEmbed = useTranslations("releases.embed");
  const [open, setOpen] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {tracks.map((track, i) => {
        const isOpen = open === i;
        // Apple's song player is 175px, Spotify's compact track
        // player 152px — their own minimums, same as the release page.
        const height = track.source === "apple" ? 175 : 152;

        const row = (
          <div
            className={`flex items-center justify-between gap-2 py-2 px-2 -mx-2 rounded-lg border-b border-border-subtle last:border-0 transition-colors ${
              isOpen ? "bg-bg-elevated/60" : "hover:bg-bg-elevated/50"
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="pixel-text text-sm text-text-muted shrink-0">{i + 1}</span>
              <span className="text-sm font-medium text-text-primary truncate">
                {track.title}
              </span>
            </div>
            {track.src ? (
              /* A play/close glyph, no words: this row already carries
                 a song title in six languages. */
              <span
                aria-hidden="true"
                className={`shrink-0 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] transition-colors ${
                  isOpen
                    ? "border-accent-primary/50 text-accent-primary"
                    : "border-border-medium text-text-muted"
                }`}
              >
                {isOpen ? "■" : "▶"}
              </span>
            ) : track.openUrl ? (
              <span className="text-xs text-accent-primary shrink-0 whitespace-nowrap">
                {t("spotify")}
              </span>
            ) : null}
          </div>
        );

        // Playable: the row is a toggle for its own player.
        if (track.src) {
          return (
            <div key={`${track.title}-${i}`}>
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setOpen(isOpen ? null : i);
                }}
                aria-expanded={isOpen}
                className="block w-full text-left"
              >
                {row}
              </button>
              {isOpen && (
                <div className="pt-2 pb-1">
                  <iframe
                    src={track.src}
                    width="100%"
                    height={height}
                    frameBorder="0"
                    allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                    loading="lazy"
                    title={
                      track.source === "apple"
                        ? tEmbed("appleTitle", { title: track.title })
                        : tEmbed("spotifyTitle", { title: track.title })
                    }
                    className="rounded-lg block w-full"
                  />
                </div>
              )}
            </div>
          );
        }

        // No playable id: the old behaviour — a link when we have one,
        // otherwise just the line.
        return track.openUrl ? (
          <a
            key={`${track.title}-${i}`}
            href={track.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
          >
            {row}
          </a>
        ) : (
          <div key={`${track.title}-${i}`}>{row}</div>
        );
      })}
    </div>
  );
}
