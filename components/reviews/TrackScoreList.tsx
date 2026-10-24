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
 *
 * Round 2 (Luca 2026-10-24: "if your finger deviates a bit it resets
 * back"): once a slide has started it is LOCKED to that row — the
 * finger can wander up and down as much as it likes, the page won't
 * scroll and the score won't snap back. If the phone takes the
 * gesture away anyway, the last score under the finger is kept rather
 * than thrown away. Rows are taller, a 0–10 scale shows while
 * sliding, and the ♥ is a full-size tap target.
 */

import { useEffect, useRef, useState } from "react";
import PreviewButton from "@/components/catalog/PreviewButton";
import { formatRating, getRatingHex } from "@/lib/rating";

/** The same three special bands the site's rating badges have. */
const tierClass = (v: number | null) =>
  v === null ? "" : v === 10 ? " is-perfect" : v >= 9.5 ? " is-elite" : v < 2 ? " is-stinky" : "";
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
  // The value under the finger, readable from the cancel handler.
  const liveRef = useRef<number | null>(null);

  // Once a slide is under way, stop the page from scrolling with it.
  // touch-action: pan-y alone hands the gesture back to the page as
  // soon as the finger drifts vertically, which cancelled the slide.
  // This has to be a native, non-passive listener — React's touch
  // handlers are passive and can't preventDefault.
  useEffect(() => {
    const el = rowRef.current;
    if (!el || !rateable) return;
    const onMove = (e: TouchEvent) => {
      if (gesture.current?.active && e.cancelable) e.preventDefault();
    };
    el.addEventListener("touchmove", onMove, { passive: false });
    return () => el.removeEventListener("touchmove", onMove);
  }, [rateable]);

  function showLive(v: number | null) {
    liveRef.current = v;
    setLive(v);
  }

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
          // Mostly vertical → it's a scroll, let it go. Generous on
          // purpose: a slightly diagonal thumb still counts as a slide.
          if (dy > 12 && dy > dx * 1.3) { gesture.current = null; return; }
          if (dx < 6 || dx * 1.2 < dy) return;
          g.active = true;
          rowRef.current?.setPointerCapture(e.pointerId);
        }
        // Only sideways movement matters from here on.
        const v = valueAt(e.clientX);
        if (v !== liveRef.current) {
          hapticTap();
          showLive(v);
        }
      }}
      onPointerUp={(e) => {
        const g = gesture.current;
        gesture.current = null;
        if (g?.active) onScore(valueAt(e.clientX));
        showLive(null);
      }}
      onPointerCancel={() => {
        // The phone took the gesture (e.g. a system swipe). Keep the
        // score they had reached instead of snapping back.
        const g = gesture.current;
        gesture.current = null;
        if (g?.active && liveRef.current !== null) onScore(liveRef.current);
        showLive(null);
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
      {/* 0 … 10 along the bottom while sliding, so it's clear the row
          is a scale and where 5 is. */}
      {live !== null && (
        <span className="track-score-scale" aria-hidden="true">
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <i key={n} style={{ left: `${n * 10}%` }} className={n % 5 === 0 ? "is-major" : ""} />
          ))}
        </span>
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
            className={`track-score-value${tierClass(shown)}`}
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
