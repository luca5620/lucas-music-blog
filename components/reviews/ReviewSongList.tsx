"use client";

/**
 * ReviewSongList — "Song by song" on a finished review (Luca
 * 2026-10-24, sleeve option 1): the reviewer's score for every song
 * they rated, in the rating colour, with a ♥ on their personal
 * favourites and a ▶ preview on every row (Luca: previews must stay
 * wherever songs are listed).
 *
 * Round 4 (Luca 2026-10-24): the score sits in the classic square
 * rating badge ("our classic square bubbles", same tier classes as
 * everywhere), and the ♥ is the same drawn heart as the rating screen
 * (one SVG, filled pink). When a review is song by song, these hearts
 * ARE the personal favourites — the page drops the separate section.
 *
 * Round 5 (Luca 2026-10-25: "it needs to open the dropdown to play the
 * preview for convenience to get directed to spotify"): tapping a row
 * opens the SAME drop-down player the Personal Favorites list uses
 * (FavoritePlayerEmbed — the viewer's Spotify or Apple player, which
 * has the service's own "open in Spotify" button). Same rules as
 * there: one open at a time, closing unmounts it (= the music stops).
 * Hearts and badges are untouched.
 *
 * Round 6 (same day): playable rows now look and open EXACTLY like
 * Personal Favorites rows (round ▶ / ■ glyph, soft highlight when
 * open) and lost the separate 30-second ▶. Only rows with no playable
 * id (Genius) keep the little ▶, since there's nothing to drop down.
 *
 * The first 7 rows show; "Show all N songs" opens the rest in place.
 * A client component because the ▶ button needs a `pick` function
 * (functions can't cross from the server page) and the drop-down
 * needs open/closed state.
 */

import { useState } from "react";
import PreviewButton from "@/components/catalog/PreviewButton";
import { FavoritePlayerEmbed, type FavoriteTrack } from "@/components/reviews/FavoritePlayers";
import { formatRating, getRatingColor } from "@/lib/rating";
import { hapticTap } from "@/lib/native";
import { stopPreview } from "@/lib/preview-player";

const FIRST_ROWS = 7;

export interface ReviewSong {
  position: number;
  title: string;
  spotify_id?: string | null;
  score: number;
  favorite: boolean;
  /** The drop-down player for this song (built server-side by the
      review page, same service rule as Personal Favorites), or null
      when there's no playable id — the row then doesn't open. */
  player: FavoriteTrack | null;
}

export default function ReviewSongList({
  releaseId,
  songs,
  single,
  labels,
}: {
  releaseId: string;
  songs: ReviewSong[];
  /** A one-song release: any preview on it is the song. */
  single: boolean;
  labels: { showAll: string; showFewer: string; favorite: string };
}) {
  const [open, setOpen] = useState(false);
  // Which row's player is open (by track position), null = none.
  const [playing, setPlaying] = useState<number | null>(null);
  const shown = open ? songs : songs.slice(0, FIRST_ROWS);

  return (
    <div>
      <ol className="review-songs">
        {shown.map((song) => {
          const player = song.player?.src ? song.player : null;
          const isOpen = !!player && playing === song.position;
          const toggle = () => {
            if (!player) return;
            hapticTap();
            // Opening a player hushes the little ▶ preview first.
            if (!isOpen) stopPreview();
            setPlaying(isOpen ? null : song.position);
          };

          const heart = song.favorite && (
            <span className="review-song-fav" title={labels.favorite} aria-label={labels.favorite}>
              {/* same heart shape as TrackScoreList's */}
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 20.5s-7.5-4.6-9.3-9.3C1.4 7.8 3.6 4.5 7 4.5c2.1 0 3.8 1.2 5 3 1.2-1.8 2.9-3 5-3 3.4 0 5.6 3.3 4.3 6.7-1.8 4.7-9.3 9.3-9.3 9.3z" />
              </svg>
            </span>
          );
          const badge = (
            <span className={`rating-badge review-song-score ${getRatingColor(song.score)}`}>
              {formatRating(song.score)}
            </span>
          );

          // Round 6 (Luca 2026-10-25): "open down like the original way
          // personal favorites are done" + the same play button. So a
          // playable row IS a Personal Favorites row: the whole row is
          // one button, its round ▶ / ■ glyph (FavoritePlayers' exact
          // classes) toggles the drop-down player under it, and the open
          // row gets the same soft highlight. No separate 30-second ▶ on
          // these rows any more: the drop-down is the player.
          if (player) {
            return (
              <li key={`${song.position}-${song.title}`}>
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={isOpen}
                  className={`review-song w-full text-left px-2 -mx-2 rounded-lg transition-colors ${
                    isOpen ? "bg-bg-elevated/60" : "hover:bg-bg-elevated/50"
                  }`}
                >
                  <span className="review-song-n">{song.position}</span>
                  <span className="review-song-title">{song.title}</span>
                  {heart}
                  {/* A play/close glyph, no words — same as Personal
                      Favorites (the row already carries the title). */}
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
                  {badge}
                </button>
                {/* The drop-down — the Personal Favorites player, verbatim. */}
                {isOpen && <FavoritePlayerEmbed track={player} />}
              </li>
            );
          }

          // No playable id (Genius rows): nothing to drop down, so the
          // little ▶ stays — previews wherever songs are listed.
          return (
            <li key={`${song.position}-${song.title}`}>
              <div className="review-song">
                <span className="review-song-n">{song.position}</span>
                <span className="review-song-title">{song.title}</span>
                {heart}
                {/* Matched by Spotify id, else by title (Genius rows have no id). */}
                <PreviewButton
                  variant="inline"
                  previewKey={`local:${releaseId}#${song.position}`}
                  src={{ source: "local", id: releaseId }}
                  pick={(list) =>
                    list.find((p) => song.spotify_id && p.spotify_id === song.spotify_id) ??
                    list.find((p) => p.title === song.title) ??
                    (single ? list[0] : undefined)
                  }
                  label={song.title}
                  // The ▶ wins over an open player elsewhere in the list.
                  onPress={() => setPlaying(null)}
                />
                {badge}
              </div>
            </li>
          );
        })}
      </ol>
      {songs.length > FIRST_ROWS && (
        <button
          type="button"
          className="review-songs-more"
          onClick={() => {
            // Folding the list away also folds away any open player.
            if (open) setPlaying(null);
            setOpen((o) => !o);
          }}
        >
          {open ? labels.showFewer : labels.showAll}
        </button>
      )}
    </div>
  );
}
