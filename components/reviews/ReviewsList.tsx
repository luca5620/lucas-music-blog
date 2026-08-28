"use client";

/**
 * ReviewsList — client-side filterable list of DB review rows.
 *
 * Overhaul v2: rows come from the database with the author profile
 * joined in (see ReviewWithAuthor in lib/db/reviews.ts), so every
 * card carries reviewer attribution + verified badge. Genre filter
 * options are derived from the data instead of a hardcoded list.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import type { ReviewWithAuthor } from "@/lib/db/reviews";
import { getGenreColor, getRatingColor, getRatingHex, formatRating } from "@/lib/rating";
import { smallCover } from "@/lib/images";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import { useReviewView, ViewToggle } from "@/components/reviews/ViewToggle";

const RATING_OPTIONS: (number | "All")[] = ["All", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export default function ReviewsList({
  reviews,
}: {
  reviews: ReviewWithAuthor[];
}) {
  const [activeGenre, setActiveGenre] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRating, setActiveRating] = useState<number | "All">("All");
  // Folder-style view choice (detailed/posters/compact), persisted.
  const [view, setView] = useReviewView();

  // Build the genre chips from what's actually in the data.
  const genres = useMemo(() => {
    const set = new Set<string>();
    reviews.forEach((r) => r.genre && set.add(r.genre));
    return ["All", ...Array.from(set).sort()];
  }, [reviews]);

  const filtered = reviews
    .filter((r) => activeGenre === "All" || r.genre === activeGenre)
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        r.title.toLowerCase().includes(q) ||
        r.artist.toLowerCase().includes(q) ||
        r.profiles.username.toLowerCase().includes(q)
      );
    })
    .filter((r) => {
      if (activeRating === "All") return true;
      return r.rating >= activeRating;
    });

  return (
    <>
      {/* Search Input + view switcher */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by title, artist, or reviewer…"
            className="form-input"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary transition-colors text-sm"
            >
              ✕
            </button>
          )}
        </div>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {/* Genre Filter — only shows if there are genres to filter by */}
      {genres.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {genres.map((genre) => (
            <button
              key={genre}
              onClick={() => setActiveGenre(genre)}
              className={`
                pixel-text text-xs uppercase tracking-widest px-4 py-2 rounded-full
                border transition-all duration-200
                ${
                  genre === activeGenre
                    ? "bg-accent-primary/15 text-accent-primary border-accent-primary/30"
                    : "text-text-muted border-border-subtle hover:text-text-primary hover:border-border-medium"
                }
              `}
            >
              {genre}
            </button>
          ))}
        </div>
      )}

      {/* Rating Filter */}
      <div className="flex flex-wrap gap-2">
        {RATING_OPTIONS.map((rating) => {
          const isActive = rating === activeRating;
          const hex = typeof rating === "number" ? getRatingHex(rating) : undefined;
          return (
            <button
              key={String(rating)}
              onClick={() => setActiveRating(rating)}
              className={`
                pixel-text text-xs uppercase tracking-widest px-4 py-2 rounded-full
                border transition-all duration-200
                ${
                  isActive
                    ? typeof rating === "number"
                      ? "bg-[var(--btn-color)]/15 border-[var(--btn-color)]/30"
                      : "bg-accent-primary/15 text-accent-primary border-accent-primary/30"
                    : "text-text-muted border-border-subtle hover:text-text-primary hover:border-border-medium"
                }
              `}
              style={hex ? { "--btn-color": hex, color: isActive ? hex : undefined } as React.CSSProperties : undefined}
            >
              {typeof rating === "number" ? `${rating}+` : rating}
            </button>
          );
        })}
      </div>

      {/* ===== POSTERS view — dense cover wall ===== */}
      {view === "posters" && filtered.length > 0 && (
        <div className="poster-grid">
          {filtered.map((review) => (
            <Link
              key={review.id}
              href={`/reviews/${review.slug}`}
              className="group space-y-1.5"
              title={`${review.title} — ${review.artist} (${formatRating(review.rating)}/10 by ${review.profiles.username})`}
              style={{ "--rating-color": getRatingHex(review.rating) } as React.CSSProperties}
            >
              <span className="poster">
                {review.cover_image ? (
                  <img src={smallCover(review.cover_image)} alt={`${review.title} cover`} loading="lazy" decoding="async" />
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

      {/* ===== COMPACT view — slim rows, minimum vertical space ===== */}
      {view === "compact" && filtered.length > 0 && (
        <div className="panel-xbox divide-y divide-border-subtle">
          {filtered.map((review) => {
            const author = review.profiles;
            return (
              <Link
                key={review.id}
                href={`/reviews/${review.slug}`}
                className="flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated transition-colors"
              >
                <span className="w-9 h-9 rounded overflow-hidden bg-bg-elevated border border-border-subtle shrink-0">
                  {review.cover_image ? (
                    <img
                      src={smallCover(review.cover_image)}
                      alt=""
                      loading="lazy"
                      decoding="async"
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
                {/* Reviewer identity, matching the home Community
                    Feed's compact rows: the little avatar ALWAYS
                    shows, the name joins it from sm up. */}
                <span className="flex items-center gap-1.5 text-xs text-text-muted shrink-0">
                  {author.avatar_url ? (
                    <img
                      src={author.avatar_url}
                      alt={author.display_name || author.username}
                      loading="lazy"
                      decoding="async"
                      className="w-5 h-5 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-[9px] font-bold text-accent-primary uppercase">
                      {(author.username || "U")[0]}
                    </span>
                  )}
                  <span className="hidden sm:flex items-center gap-1">
                    {author.display_name || author.username}
                    {author.role !== "user" && <VerifiedBadge role={author.role} />}
                  </span>
                </span>
                <span
                  className="pixel-text text-sm font-bold tabular-nums shrink-0 w-9 text-right"
                  style={{ color: getRatingHex(review.rating) }}
                >
                  {formatRating(review.rating)}
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* ===== DETAILED view (default) + shared empty state =====
          Same card + grid as the home Community Feed's detailed view
          (Luca 2026-08-28: "make it like the big icon one") — the old
          horizontal rows read gapless on phones; these cards carry
          real gap-6 air between them at every size. */}
      <div
        className={
          view === "detailed" && filtered.length > 0
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 items-start"
            : filtered.length === 0
              ? "space-y-6"
              : "hidden"
        }
      >
        {filtered.length === 0 ? (
          /* Same NO SIGNAL voice as every other empty surface. */
          <div className="panel-xbox p-8 sm:p-10 text-center space-y-3">
            <p className="osd-text text-sm">NO SIGNAL</p>
            <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
              {reviews.length === 0
                ? "No reviews on the wall yet. Be the first — pick a record and drop your take."
                : "Nothing matches those filters. Loosen the rating or clear the search."}
            </p>
          </div>
        ) : view !== "detailed" ? null : (
          filtered.map((review) => {
            const author = review.profiles;
            const isVerified = author.role !== "user";
            const ratingColor = getRatingHex(review.rating);
            // Same words-priority as the home feed card: the fuller
            // summary when there is one, the snippet otherwise.
            const body = review.summary ?? review.snippet;
            const isLongRead = !!body && body.length > 320;
            return (
              <article
                key={review.id}
                className="panel-xbox p-4 space-y-3 hover-glow relative overflow-hidden"
                style={{ "--rating-color": ratingColor } as React.CSSProperties}
              >
                {/* The verdict line — who, then THE number in its own
                    box, exactly like the home Community Feed card. */}
                <Link
                  href={`/profile/${author.username}`}
                  className="flex items-center justify-center gap-2.5 group/author text-center"
                >
                  {author.avatar_url ? (
                    <img
                      src={author.avatar_url}
                      alt={author.display_name || author.username}
                      loading="lazy"
                      decoding="async"
                      className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-accent-primary uppercase">
                        {(author.username || "U")[0]}
                      </span>
                    </div>
                  )}
                  <span className="min-w-0 text-base text-text-secondary leading-snug break-words">
                    <span className="font-bold text-text-primary group-hover/author:text-accent-primary transition-colors">
                      {author.display_name || author.username}
                    </span>
                    {isVerified && (
                      <>
                        {" "}
                        <VerifiedBadge role={author.role} />
                      </>
                    )}{" "}
                    rated this release
                  </span>
                  <span
                    className={`rating-badge text-xs w-8 h-8 shrink-0 ${getRatingColor(review.rating)}`}
                    style={{ color: ratingColor, borderColor: ratingColor }}
                  >
                    {formatRating(review.rating)}
                  </span>
                </Link>

                {/* Big cover + title → the review itself */}
                <Link href={`/reviews/${review.slug}`} className="block group space-y-2">
                  <div className="aspect-square rounded-lg bg-[rgba(30,144,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center relative overflow-hidden group-hover:border-[rgba(255,255,255,0.3)] transition-all">
                    {review.cover_image ? (
                      <img
                        src={review.cover_image}
                        srcSet={`${smallCover(review.cover_image)} 300w, ${review.cover_image} 640w`}
                        sizes="(min-width: 1536px) 18vw, (min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                        alt={`${review.title} cover`}
                        loading="lazy"
                        decoding="async"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <span className="text-5xl group-hover:scale-110 transition-transform">
                        💿
                      </span>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  <div className="min-w-0">
                    <h2 className={`font-[family-name:var(--font-heading)] text-base font-bold text-text-primary group-hover:text-accent-primary transition-colors truncate rating-title-hover${review.rating >= 9.5 ? " rating-title-glow-elite" : ""}`}>
                      {review.title}
                    </h2>
                    <p className="text-xs text-text-secondary truncate">
                      {review.artist}
                    </p>
                  </div>
                </Link>

                {/* Their words, right under the record */}
                {body && (
                  <p className="text-xs text-text-secondary leading-relaxed whitespace-pre-line line-clamp-6 pt-2 border-t border-white/5">
                    {body}
                  </p>
                )}
                {isLongRead && (
                  <Link
                    href={`/reviews/${review.slug}`}
                    className="block pixel-text text-[0.65rem] uppercase tracking-widest text-accent-primary hover:text-accent-glow transition-colors"
                  >
                    Read the full review →
                  </Link>
                )}

                {/* Genre + date footer (this page's rows don't carry
                    like counts — the home feed keeps its LikeButton) */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                  <span className="flex items-center gap-3 min-w-0">
                    {review.genre && (
                      <span
                        className={`pixel-text text-xs uppercase tracking-widest truncate ${getGenreColor(review.genre)}`}
                      >
                        {review.genre}
                      </span>
                    )}
                    <span className="text-text-muted text-xs shrink-0">
                      {review.review_date
                        ? new Date(review.review_date + "T12:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : ""}
                    </span>
                  </span>
                </div>

                <div className="scan-bar" />
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
