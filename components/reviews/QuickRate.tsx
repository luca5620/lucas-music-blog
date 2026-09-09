"use client";

/**
 * QuickRate — the deck. One record at a time: cover, title, the
 * review form's 0–10 slider, then RATE IT or HAVEN'T HEARD IT. Every
 * RATE posts a real published review (wordless) through
 * POST /api/reviews with `quick: true` — same rows, same profile,
 * same community average; only the follower notification is skipped.
 *
 * UNDO deletes the review just made and puts the record back on top,
 * so a slipped thumb costs one tap. The search box under the deck
 * pulls any specific record (or a pasted Spotify link) to the front.
 */

import { useState } from "react";
import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import CatalogSearch, { type CatalogPick } from "@/components/catalog/CatalogSearch";
import { hapticTap } from "@/lib/native";
import { formatRating, getRatingColor, getRatingHex } from "@/lib/rating";

export interface QuickRateItem {
  id: string;
  slug: string;
  title: string;
  artist: string;
  cover_image: string | null;
  release_type: string;
  year: string | null;
}

/** Only https:// or local /path images (stored-XSS defense). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

const DEFAULT_RATING = 7;

export default function QuickRate({
  initial,
  profileHref,
}: {
  initial: QuickRateItem[];
  profileHref: string;
}) {
  const t = useTranslations("quickRate");
  const [deck, setDeck] = useState<QuickRateItem[]>(initial);
  const [idx, setIdx] = useState(0);
  const [rating, setRating] = useState(DEFAULT_RATING);
  const [rated, setRated] = useState(0);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The review just posted — one UNDO away. */
  const [last, setLast] = useState<{ reviewId: string; item: QuickRateItem } | null>(null);

  const current = deck[idx] ?? null;
  const left = Math.max(deck.length - idx, 0);
  const ratingColor = getRatingHex(rating);

  function advance() {
    setIdx((i) => i + 1);
    setRating(DEFAULT_RATING);
    setError(null);
  }

  async function rate() {
    if (!current || saving) return;
    hapticTap();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          release_id: current.id,
          rating,
          is_published: true,
          quick: true,
        }),
      });
      if (res.status === 201) {
        const data = (await res.json()) as { id: string };
        setLast({ reviewId: data.id, item: current });
        setRated((n) => n + 1);
        advance();
      } else if (res.status === 409) {
        // Already reviewed (a stale deck) — just move on.
        setNotice(t("already"));
        setLast(null);
        advance();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { error?: string }).error || t("error"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setSaving(false);
    }
  }

  function skip() {
    if (!current || saving) return;
    hapticTap();
    setLast(null);
    setNotice(null);
    advance();
  }

  async function undo() {
    if (!last || saving) return;
    hapticTap();
    setSaving(true);
    try {
      const res = await fetch(`/api/reviews/${last.reviewId}`, { method: "DELETE" });
      if (!res.ok) throw new Error(String(res.status));
      // Put it back on top and rewind.
      setDeck((d) => [...d.slice(0, idx), last.item, ...d.slice(idx)]);
      setRated((n) => Math.max(n - 1, 0));
      setLast(null);
      setRating(DEFAULT_RATING);
      setNotice(null);
      setError(null);
    } catch {
      setError(t("error"));
    } finally {
      setSaving(false);
    }
  }

  function onPick(pick: CatalogPick) {
    hapticTap();
    const item: QuickRateItem = {
      id: pick.release.id,
      slug: pick.release.slug,
      title: pick.release.title,
      artist: pick.artist_name,
      cover_image: pick.release.cover_image,
      release_type: pick.release.release_type,
      year: pick.release.release_date ? pick.release.release_date.slice(0, 4) : null,
    };
    // Straight to the front of the deck (dedupe if it's already queued).
    setDeck((d) => [...d.slice(0, idx), item, ...d.slice(idx).filter((x) => x.id !== item.id)]);
    setRating(DEFAULT_RATING);
    setNotice(null);
    setError(null);
  }

  const cover = current ? safeImage(current.cover_image) : null;

  return (
    <div className="space-y-5">
      {/* Session strip */}
      <div className="flex items-center gap-3">
        <span className="vhs-label text-sm">{t("rated", { n: rated })}</span>
        <span className="text-text-secondary text-xs">{t("left", { n: left })}</span>
        <div className="flex-1 divider-glow" />
        {last && (
          <button
            type="button"
            onClick={undo}
            disabled={saving}
            className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-rose transition-colors disabled:opacity-50"
          >
            {t("undo")}
          </button>
        )}
      </div>

      {current ? (
        <div className="card-y2k p-4 sm:p-6 space-y-5 overflow-hidden">
          <div className="flex flex-col sm:flex-row gap-5 sm:items-center">
            <div className="w-40 h-40 sm:w-48 sm:h-48 mx-auto sm:mx-0 shrink-0 rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle">
              {cover ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cover}
                  alt=""
                  width={192}
                  height={192}
                  className="w-full h-full object-cover"
                  draggable={false}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-4xl text-text-muted">
                  ♪
                </div>
              )}
            </div>
            <div className="min-w-0 text-center sm:text-left space-y-1">
              <Link
                href={`/releases/${current.slug}`}
                className="block text-lg sm:text-xl font-bold text-text-primary font-[family-name:var(--font-heading)] leading-tight hover:text-accent-primary transition-colors"
              >
                {current.title}
              </Link>
              <p className="text-sm text-text-secondary truncate">{current.artist}</p>
              <p className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
                {current.release_type}
                {current.year ? ` · ${current.year}` : ""}
              </p>
            </div>
          </div>

          {/* The slider — same control as the review form. */}
          <div className="flex items-center gap-4">
            <div
              className={`pixel-text text-4xl tabular-nums w-16 text-center shrink-0 ${getRatingColor(rating)}`}
            >
              {formatRating(rating)}
            </div>
            <div className="flex-1 space-y-2">
              <input
                type="range"
                min="0"
                max="10"
                step="0.5"
                value={rating}
                onChange={(e) => {
                  hapticTap();
                  setRating(parseFloat(e.target.value));
                }}
                className={`rating-slider${
                  rating === 10
                    ? " rating-slider-perfect"
                    : rating >= 9.5
                      ? " rating-slider-elite"
                      : ""
                }`}
                style={
                  {
                    "--slider-color": ratingColor,
                    background: `linear-gradient(90deg, ${ratingColor}30 0%, ${ratingColor}99 ${rating * 10}%, rgba(255,255,255,0.08) ${rating * 10}%)`,
                  } as React.CSSProperties
                }
                aria-label={t("ratingAria", { title: current.title })}
              />
              <div className="flex justify-between text-xs text-text-muted font-[family-name:var(--font-vt323)]">
                <span>0</span>
                <span>5</span>
                <span>10</span>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={skip}
              disabled={saving}
              className="btn-y2k btn-y2k-outline flex-1 disabled:opacity-50"
            >
              {t("skip")}
            </button>
            <button
              type="button"
              onClick={rate}
              disabled={saving}
              className="btn-y2k btn-y2k-primary flex-1 disabled:opacity-50"
            >
              {saving ? "…" : t("rate")}
            </button>
          </div>

          {error && <p className="text-xs text-accent-rose">{error}</p>}
          {notice && !error && <p className="text-xs text-text-muted">{notice}</p>}
        </div>
      ) : (
        <div className="panel-xbox p-6 sm:p-8 text-center space-y-4">
          <p className="osd-text text-sm">{t("doneTitle")}</p>
          <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
            {t("doneSub", { n: rated })}
          </p>
          <Link href={profileHref} className="btn-y2k btn-y2k-primary inline-block">
            {t("profile")}
          </Link>
        </div>
      )}

      {/* Pull any specific record to the front. */}
      <div className="card-y2k p-4 sm:p-5 space-y-3">
        <CatalogSearch
          onPick={onPick}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
        />
      </div>
    </div>
  );
}
