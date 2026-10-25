"use client";

/**
 * TrackScoreList — the tracklist inside the review form (Luca
 * 2026-10-24: "an option to do it track by track or not").
 *
 * Every row carries the same three things in both modes:
 *   - ▶ this song's 30-second preview (Luca: previews must stay, in
 *     favourites AND song by song),
 *   - ♥ mark it a favourite (these become the review's "personal
 *     favorites" — the old checkbox step folded into the list),
 *   - the song itself.
 *
 * In SONG BY SONG mode (`rateable`) each row also gets a ScoreSlider
 * under the title: [ − ] ●━━━━○── [ + ]. Grab the dot to get close,
 * − / + for the exact 0.1, or tap the number to type it. Each change
 * goes to the parent, which saves it to track_ratings (debounced).
 *
 * Round 3 (Luca 2026-10-24, "not very precise and feels off"): the
 * whole row USED to be the slider — the score jumped to wherever the
 * finger landed and 0.1 was ~3px of travel. It's now the same slider
 * as the album score, which only moves when you grab the dot.
 */

import { useState } from "react";
import PreviewButton from "@/components/catalog/PreviewButton";
import ScoreSlider from "@/components/reviews/ScoreSlider";
import { formatRating, getRatingHex } from "@/lib/rating";
import type { ReleaseTrack } from "@/lib/types/database";

/** The same three special bands the site's rating badges have. */
const tierClass = (v: number | null) =>
  v === null ? "" : v === 10 ? " is-perfect" : v >= 9.5 ? " is-elite" : v < 2 ? " is-stinky" : "";

const clamp = (v: number) => Math.min(10, Math.max(0, Math.round(v * 10) / 10));

interface TrackScoreListProps {
  releaseId: string;
  tracks: ReleaseTrack[];
  /** Song by song mode — every row gets a slider. */
  rateable: boolean;
  scores: Record<number, number>;
  onScore: (position: number, value: number | null) => void;
  favorites: Set<string>;
  onToggleFavorite: (title: string) => void;
  labels: {
    favorite: string;
    typeScore: string;
    clear: string;
    nudgeDown: string;
    nudgeUp: string;
  };
}

export default function TrackScoreList({
  releaseId,
  tracks,
  rateable,
  scores,
  onScore,
  favorites,
  onToggleFavorite,
  labels,
}: TrackScoreListProps) {
  return (
    <div className={`track-score-list${rateable ? " is-rateable" : ""}`}>
      {tracks.map((track) => (
        <TrackRow
          key={`${track.position}-${track.title}`}
          releaseId={releaseId}
          track={track}
          single={tracks.length === 1}
          rateable={rateable}
          score={scores[track.position]}
          onScore={(v) => onScore(track.position, v)}
          favorite={favorites.has(track.title)}
          onToggleFavorite={() => onToggleFavorite(track.title)}
          labels={labels}
        />
      ))}
    </div>
  );
}

function TrackRow({
  releaseId,
  track,
  single,
  rateable,
  score,
  onScore,
  favorite,
  onToggleFavorite,
  labels,
}: {
  releaseId: string;
  track: ReleaseTrack;
  single: boolean;
  rateable: boolean;
  score: number | undefined;
  onScore: (v: number | null) => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  labels: TrackScoreListProps["labels"];
}) {
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");

  const shown = score ?? null;
  const color = shown === null ? undefined : getRatingHex(shown);

  function commitTyped() {
    setTyping(false);
    const raw = draft.trim();
    if (raw === "") { if (score !== undefined) onScore(null); return; }
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isFinite(n)) onScore(clamp(n));
  }

  return (
    <div className={`track-score-row${favorite ? " is-fav" : ""}`}>
      <div className="track-score-top">
        <span className="track-score-n">{track.position}</span>
        <span className="track-score-title">{track.title}</span>
        <button
          type="button"
          className={`track-score-heart${favorite ? " is-on" : ""}`}
          aria-pressed={favorite}
          aria-label={`${labels.favorite}: ${track.title}`}
          onClick={onToggleFavorite}
        >
          {favorite ? "♥" : "♡"}
        </button>
        {/* Matched by Spotify id, else by title (Genius rows have no id). */}
        <PreviewButton
          variant="inline"
          previewKey={`local:${releaseId}#${track.position}`}
          src={{ source: "local", id: releaseId }}
          pick={(list) =>
            list.find((p) => track.spotify_id && p.spotify_id === track.spotify_id) ??
            list.find((p) => p.title === track.title) ??
            (single ? list[0] : undefined)
          }
          label={track.title}
        />
        {rateable && (
          typing ? (
            <input
              autoFocus
              inputMode="decimal"
              aria-label={`${labels.typeScore}: ${track.title}`}
              className="track-score-input"
              value={draft}
              placeholder="–"
              onChange={(e) => setDraft(e.target.value.replace(/[^0-9.,]/g, "").slice(0, 4))}
              onBlur={commitTyped}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTyped();
                if (e.key === "Escape") setTyping(false);
              }}
            />
          ) : (
            <button
              type="button"
              className={`track-score-value${tierClass(shown)}`}
              style={{ color }}
              aria-label={`${labels.typeScore}: ${track.title}`}
              title={score !== undefined ? labels.clear : undefined}
              onClick={() => {
                setDraft(score === undefined ? "" : formatRating(score));
                setTyping(true);
              }}
            >
              {shown !== null ? formatRating(shown) : "–"}
            </button>
          )
        )}
      </div>
      {rateable && (
        <ScoreSlider
          value={shown}
          onChange={onScore}
          ariaLabel={track.title}
          downLabel={`${labels.nudgeDown}: ${track.title}`}
          upLabel={`${labels.nudgeUp}: ${track.title}`}
        />
      )}
    </div>
  );
}
