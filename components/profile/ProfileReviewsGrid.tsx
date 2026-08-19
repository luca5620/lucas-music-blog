"use client";

/**
 * ProfileReviewsGrid — the Reviews tab on a profile, with the same
 * folder-style view switching as the reviews index (Detailed cards /
 * Posters / Compact rows). Shares the persisted choice via
 * useReviewView, so a user's preferred density follows them
 * everywhere reviews are listed.
 */

import Link from "next/link";
import type { Review } from "@/lib/types/database";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import { useReviewView, ViewToggle } from "@/components/reviews/ViewToggle";

export default function ProfileReviewsGrid({ reviews }: { reviews: Review[] }) {
  const [view, setView] = useReviewView();

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* ===== Detailed cards (default) ===== */}
      {view === "detailed" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <DetailedCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* ===== Poster wall ===== */}
      {view === "posters" && (
        <div className="poster-grid">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/reviews/${review.slug}`}
              className="group space-y-1.5"
              title={`${review.title} — ${review.artist} (${formatRating(review.rating)}/10)`}
              style={{ "--rating-color": getRatingHex(review.rating) } as React.CSSProperties}
            >
              <span className="poster">
                {review.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={review.cover_image} alt={`${review.title} cover`} />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-4xl">
                    💿
                  </span>
                )}
                <span className="poster-rating">{formatRating(review.rating)}</span>
              </span>
              <span className="block">
                <span className={`block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] rating-title-hover${review.rating >= 9.5 ? " rating-title-glow-elite" : ""}`}>
                  {review.title}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  {review.artist}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* ===== Compact rows ===== */}
      {view === "compact" && (
        <div className="panel-xbox divide-y divide-border-subtle">
          {reviews.map((review) => (
            <Link
              key={review.id}
              href={`/reviews/${review.slug}`}
              className="flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated transition-colors"
            >
              <span className="w-9 h-9 rounded overflow-hidden bg-bg-elevated border border-border-subtle shrink-0">
                {review.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={review.cover_image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-base">
                    💿
                  </span>
                )}
              </span>
              <span className="min-w-0 flex-1 truncate text-sm">
                <span className="font-bold text-text-primary font-[family-name:var(--font-heading)]">
                  {review.title}
                </span>
                <span className="text-text-secondary"> — {review.artist}</span>
              </span>
              <span className="hidden sm:inline pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                {(review.release_type ?? "").toUpperCase()}
              </span>
              <span
                className="pixel-text text-sm font-bold tabular-nums shrink-0 w-9 text-right"
                style={{ color: getRatingHex(review.rating) }}
              >
                {formatRating(review.rating)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** The full card — identical anatomy to the release/feed cards. */
function DetailedCard({ review }: { review: Review }) {
  const ratingColor = getRatingHex(review.rating);
  const year =
    review.release_date && review.release_date.length >= 4
      ? review.release_date.slice(0, 4)
      : null;

  return (
    <Link
      href={`/reviews/${review.slug}`}
      className="panel-xbox p-4 sm:p-5 space-y-4 group cursor-pointer hover-glow relative overflow-hidden block"
    >
      <div className="aspect-square rounded-lg bg-bg-elevated border border-white/10 flex items-center justify-center relative overflow-hidden group-hover:border-white/30 transition-all">
        {review.cover_image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={review.cover_image}
            alt={`${review.title} cover`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <span className="text-5xl group-hover:scale-110 transition-transform">
            💿
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="flex items-center justify-between">
        <span className="label-xbox text-[0.6rem]">
          {(review.release_type ?? "MUSIC").toUpperCase()}
        </span>
        {year && (
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            {year}
          </span>
        )}
      </div>

      <div>
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text-primary group-hover:text-accent-primary transition-colors">
          {review.title}
        </h3>
        <p className="text-sm text-text-secondary">{review.artist}</p>
      </div>

      <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
        <div
          className={`rating-badge text-sm w-10 h-10 ${getRatingColor(review.rating)}`}
          style={{ color: ratingColor, borderColor: ratingColor }}
        >
          {formatRating(review.rating)}
        </div>
      </div>

      <div className="scan-bar" />
    </Link>
  );
}
