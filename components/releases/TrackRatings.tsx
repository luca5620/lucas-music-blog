"use client";

/**
 * TrackRatings — the tracklist as a scoreboard (Luca 2026-09-08:
 * "show ratings for individual songs off of an album").
 *
 * Every track gets its own row: community average + count on the
 * right, the viewer's own score beside it once they've rated. Tap a
 * row and it opens the same 0–10 slider the review form uses, saved
 * on release (debounced — dragging doesn't spam the API). "Clear"
 * removes the score. Signed-out visitors see the numbers and a
 * sign-in nudge; tapping a row sends them to /login.
 *
 * Positions key everything (migration 041) — the jsonb tracklist's
 * positions never move once imported.
 */

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { useAuth } from "@/components/auth/AuthProvider";
import { hapticTap } from "@/lib/native";
import { formatRating, getRatingColor, getRatingHex } from "@/lib/rating";
import type { TrackRatingSummary } from "@/lib/db/track-ratings";

export interface TrackRatingTrack {
  position: number;
  title: string;
}

interface Props {
  releaseId: string;
  tracks: TrackRatingTrack[];
  initial: Record<number, TrackRatingSummary>;
}

type Summary = { avg: number | null; count: number; mine: number | null };

export default function TrackRatings({ releaseId, tracks, initial }: Props) {
  const t = useTranslations("releases.trackRatings");
  const { user } = useAuth();
  const router = useRouter();

  const [summaries, setSummaries] = useState<Record<number, Summary>>(() => {
    const out: Record<number, Summary> = {};
    for (const tr of tracks) {
      const s = initial[tr.position];
      out[tr.position] = s
        ? { avg: s.avg, count: s.count, mine: s.mine }
        : { avg: null, count: 0, mine: null };
    }
    return out;
  });
  const [open, setOpen] = useState<number | null>(null);
  /** Slider value while a row is open — separate from the saved
      score so the number beside the thumb moves instantly. */
  const [draft, setDraft] = useState<number>(7);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  async function save(position: number, rating: number | null) {
    try {
      const res = await fetch(`/api/releases/${releaseId}/track-ratings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position, rating }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const s = (await res.json()) as Summary;
      setSummaries((prev) => ({
        ...prev,
        [position]: { avg: s.avg, count: s.count, mine: s.mine },
      }));
      setError(null);
    } catch {
      setError(t("error"));
    }
  }

  function queueSave(position: number, rating: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(position, rating), 350);
  }

  function toggleRow(position: number) {
    if (!user) {
      router.push("/login");
      return;
    }
    hapticTap();
    if (open === position) {
      setOpen(null);
      return;
    }
    const mine = summaries[position]?.mine;
    setDraft(mine ?? 7);
    setOpen(position);
  }

  function onSlide(position: number, value: number) {
    hapticTap();
    setDraft(value);
    // Optimistic YOU chip so the row reflects the drag at once.
    setSummaries((prev) => ({
      ...prev,
      [position]: { ...prev[position], mine: value },
    }));
    queueSave(position, value);
  }

  function clear(position: number) {
    if (timer.current) clearTimeout(timer.current);
    hapticTap();
    setSummaries((prev) => ({
      ...prev,
      [position]: { ...prev[position], mine: null },
    }));
    setOpen(null);
    void save(position, null);
  }

  // Fan favorite = highest community average (ties go to the track
  // with more ratings).
  let favorite: TrackRatingTrack | null = null;
  let favoriteAvg = -1;
  let favoriteCount = 0;
  for (const tr of tracks) {
    const s = summaries[tr.position];
    if (!s || s.avg === null) continue;
    if (s.avg > favoriteAvg || (s.avg === favoriteAvg && s.count > favoriteCount)) {
      favorite = tr;
      favoriteAvg = s.avg;
      favoriteCount = s.count;
    }
  }

  if (tracks.length === 0) return null;

  return (
    <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">{t("title")}</span>
        </div>
        <span className="pixel-text text-[10px] text-text-muted uppercase tracking-widest text-right">
          {user ? t("tapToRate") : t("signIn")}
        </span>
      </div>

      {favorite && (
        <div
          className="flex items-center gap-2 rounded-lg px-3 py-2 border"
          style={{
            borderColor: `${getRatingHex(favoriteAvg)}66`,
            background: `${getRatingHex(favoriteAvg)}14`,
          }}
        >
          <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
            {t("fanFavorite")}
          </span>
          <span className="text-sm font-medium text-text-primary truncate">
            {favorite.title}
          </span>
          <span
            className={`ml-auto shrink-0 pixel-text text-sm tabular-nums ${getRatingColor(favoriteAvg)}`}
          >
            {formatRating(favoriteAvg)}
          </span>
        </div>
      )}

      <ol className="space-y-1">
        {tracks.map((track) => {
          const s = summaries[track.position];
          const isOpen = open === track.position;
          const mine = s?.mine ?? null;
          const avg = s?.avg ?? null;
          return (
            <li
              key={`${track.position}-${track.title}`}
              data-track-position={track.position}
              className="border-b border-border-subtle last:border-0"
            >
              <button
                type="button"
                onClick={() => toggleRow(track.position)}
                aria-expanded={isOpen}
                className={`w-[calc(100%+1rem)] text-left py-2 px-2 -mx-2 rounded-lg transition-colors hover:bg-bg-elevated/50 ${
                  isOpen ? "bg-bg-elevated/50" : ""
                }`}
              >
                <div className="flex items-center justify-between gap-2 w-full">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="pixel-text text-sm text-text-muted shrink-0 w-6 tabular-nums">
                      {track.position}
                    </span>
                    <span className="text-sm font-medium text-text-primary truncate">
                      {track.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {mine !== null && (
                      <span
                        className={`pixel-text text-[10px] uppercase tracking-widest px-1.5 py-0.5 rounded border ${getRatingColor(mine)}`}
                      >
                        {t("you")} {formatRating(mine)}
                      </span>
                    )}
                    {avg !== null ? (
                      <span className="flex items-baseline gap-1">
                        <span
                          className={`pixel-text text-base tabular-nums ${getRatingColor(avg)}`}
                        >
                          {formatRating(avg)}
                        </span>
                        <span className="text-[10px] text-text-muted tabular-nums">
                          {t("ratings", { n: s?.count ?? 0 })}
                        </span>
                      </span>
                    ) : (
                      <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
                        {t("unrated")}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              {isOpen && (
                <div className="pb-3 pt-1 flex items-center gap-3">
                  <span
                    className={`pixel-text text-2xl tabular-nums w-12 text-center shrink-0 ${getRatingColor(draft)}`}
                  >
                    {formatRating(draft)}
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    value={draft}
                    onChange={(e) => onSlide(track.position, parseFloat(e.target.value))}
                    className={`rating-slider flex-1${
                      draft === 10
                        ? " rating-slider-perfect"
                        : draft >= 9.5
                          ? " rating-slider-elite"
                          : ""
                    }`}
                    style={
                      {
                        "--slider-color": getRatingHex(draft),
                        background: `linear-gradient(90deg, ${getRatingHex(draft)}30 0%, ${getRatingHex(draft)}99 ${draft * 10}%, rgba(255,255,255,0.08) ${draft * 10}%)`,
                      } as React.CSSProperties
                    }
                    aria-label={t("sliderAria", { title: track.title })}
                  />
                  {mine !== null && (
                    <button
                      type="button"
                      onClick={() => clear(track.position)}
                      className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-rose transition-colors shrink-0"
                    >
                      {t("clear")}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {error && <p className="text-xs text-accent-rose">{error}</p>}
    </div>
  );
}
