"use client";

/**
 * ReviewSongList — "Song by song" on a finished review (Luca
 * 2026-10-24, sleeve option 1): the reviewer's score for every song
 * they rated, in the rating colour, with a ♥ on their personal
 * favourites and a ▶ preview on every row (Luca: previews must stay
 * wherever songs are listed).
 *
 * The first 7 rows show; "Show all N songs" opens the rest in place.
 * A client component only because the ▶ button needs a `pick`
 * function, and functions can't cross from the server page.
 */

import { useState } from "react";
import PreviewButton from "@/components/catalog/PreviewButton";
import { formatRating, getRatingHex } from "@/lib/rating";

const FIRST_ROWS = 7;

export interface ReviewSong {
  position: number;
  title: string;
  spotify_id?: string | null;
  score: number;
  favorite: boolean;
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
  const shown = open ? songs : songs.slice(0, FIRST_ROWS);

  return (
    <div>
      <ol className="review-songs">
        {shown.map((song) => (
          <li key={`${song.position}-${song.title}`} className="review-song">
            <span className="review-song-n">{song.position}</span>
            <span className="review-song-title">{song.title}</span>
            {song.favorite && (
              <span className="review-song-fav" title={labels.favorite} aria-label={labels.favorite}>
                ♥
              </span>
            )}
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
            />
            <span className="review-song-score" style={{ color: getRatingHex(song.score) }}>
              {formatRating(song.score)}
            </span>
          </li>
        ))}
      </ol>
      {songs.length > FIRST_ROWS && (
        <button type="button" className="review-songs-more" onClick={() => setOpen((o) => !o)}>
          {open ? labels.showFewer : labels.showAll}
        </button>
      )}
    </div>
  );
}
