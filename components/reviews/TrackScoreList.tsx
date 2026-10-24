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
 * In SONG BY SONG mode (`rateable`) the row is also the slider: put a
 * finger on it and slide sideways — the row fills from the left in the
 * score's colour and the number counts with it. Let go and it saves
 * (the parent writes it to track_ratings straight away). Vertical
 * swipes still scroll the page: a drag only becomes a rating once it's
 * clearly sideways. Tap the number to type a score instead; arrow keys
 * work when a row has focus (desktop).
 */

import { useRef, useState } from "react";
import PreviewButton from "@/components/catalog/PreviewButton";
import { formatRating, getRatingHex } from "@/lib/rating";
import { hapticTap } from "@/lib/native";
import type { ReleaseTrack } from "@/lib/types/database";

const clamp = (v: number) => Math.min(10, Math.max(0, Math.round(v * 10) / 10));

interface TrackScoreListProps {
  releaseId: string;
  tracks: ReleaseTrack[];
  /** Song by song mode — rows become sliders. */
  rateable: boolean;
  scores: Record<number, number>;
  onScore: (position: number, value: number | null) => void;
  favorites: Set<string>;
  onToggleFavorite: (title: string) => void;
  labels: {
    slide: string;
    favorite: string;
    typeScore: string;
    clear: string;
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
  // The first unrated song gets the "slide →" hint so it's obvious
  // where to start.
  const firstOpen = rateable ? tracks.find((t) => scores[t.position] === undefined)?.position : undefined;

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
          showHint={track.position === firstOpen}
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
  showHint,
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
  showHint: boolean;
  labels: TrackScoreListProps["labels"];
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  // `live` = the value under the finger while sliding (null = not sliding)
  const [live, setLive] = useState<number | null>(null);
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState("");
  const gesture = useRef<{ id: number; x: number; y: number; active: boolean } | null>(null);

  const shown = live ?? score ?? null;
  const color = shown === null ? undefined : getRatingHex(shown);

  function valueAt(clientX: number) {
    const r = rowRef.current!.getBoundingClientRect();
    return clamp(((clientX - r.left) / r.width) * 10);
  }

  function commitTyped() {
    setTyping(false);
    const raw = draft.trim();
    if (raw === "") { if (score !== undefined) onScore(null); return; }
    const n = parseFloat(raw.replace(",", "."));
    if (Number.isFinite(n)) onScore(clamp(n));
  }

  const interactive = (el: EventTarget | null) =>
    el instanceof Element && !!el.closest("button, input, a");

  return (
    <div
      ref={rowRef}
      className={`track-score-row${live !== null ? " is-live" : ""}${favorite ? " is-fav" : ""}`}
      role={rateable ? "slider" : undefined}
      tabIndex={rateable ? 0 : undefined}
      aria-label={rateable ? track.title : undefined}
      aria-valuemin={rateable ? 0 : undefined}
      aria-valuemax={rateable ? 10 : undefined}
      aria-valuenow={rateable && shown !== null ? shown : undefined}
      onKeyDown={(e) => {
        if (!rateable || typing) return;
        const step = e.key === "ArrowRight" || e.key === "ArrowUp" ? 0.1
          : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -0.1 : null;
        if (step !== null) {
          e.preventDefault();
          onScore(clamp((score ?? 5) + step));
        } else if (e.key === "Backspace" || e.key === "Delete") {
          if (score !== undefined) onScore(null);
        }
      }}
      onPointerDown={(e) => {
        if (!rateable || typing || interactive(e.target)) return;
        gesture.current = { id: e.pointerId, x: e.clientX, y: e.clientY, active: false };
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (!g || g.id !== e.pointerId) return;
        if (!g.active) {
          const dx = Math.abs(e.clientX - g.x);
          const dy = Math.abs(e.clientY - g.y);
          // Clearly vertical → it's a scroll, let it go.
          if (dy > 10 && dy > dx) { gesture.current = null; return; }
          if (dx < 6 || dx < dy) return;
          g.active = true;
          rowRef.current?.setPointerCapture(e.pointerId);
        }
        const v = valueAt(e.clientX);
        if (v !== live) {
          hapticTap();
          setLive(v);
        }
      }}
      onPointerUp={(e) => {
        const g = gesture.current;
        gesture.current = null;
        if (g?.active) onScore(valueAt(e.clientX));
        setLive(null);
      }}
      onPointerCancel={() => {
        gesture.current = null;
        setLive(null);
      }}
    >
      {rateable && shown !== null && (
        <>
          <span
            className="track-score-fill"
            style={{ width: `${shown * 10}%`, background: `${color}${live !== null ? "40" : "1f"}` }}
          />
          {live !== null && (
            <span
              className="track-score-edge"
              style={{ left: `calc(${shown * 10}% - 2px)`, background: color, boxShadow: `0 0 10px ${color}` }}
            />
          )}
        </>
      )}
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
            className="track-score-value"
            style={{ color }}
            aria-label={`${labels.typeScore}: ${track.title}`}
            title={score !== undefined ? labels.clear : undefined}
            onClick={() => {
              setDraft(score === undefined ? "" : formatRating(score));
              setTyping(true);
            }}
          >
            {shown !== null ? formatRating(shown) : showHint ? <em>{labels.slide}</em> : "–"}
          </button>
        )
      )}
    </div>
  );
}
