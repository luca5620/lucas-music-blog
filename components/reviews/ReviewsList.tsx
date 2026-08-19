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
import { VerifiedBadge } from "@/components/ui/RoleBadge";

const RATING_OPTIONS: (number | "All")[] = ["All", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export default function ReviewsList({
  reviews,
}: {
  reviews: ReviewWithAuthor[];
}) {
  const [activeGenre, setActiveGenre] = useState<string>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRating, setActiveRating] = useState<number | "All">("All");

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
      {/* Search Input */}
      <div className="relative">
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

      {/* Review List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="card-y2k p-8 text-center">
            <p className="text-text-muted pixel-text text-sm">
              {reviews.length === 0
                ? "No reviews yet. Be the first — hit Review in the nav."
                : "No reviews match your filters."}
            </p>
          </div>
        ) : (
          filtered.map((review) => {
            const author = review.profiles;
            const isVerified = author.role !== "user";
            return (
              <Link href={`/reviews/${review.slug}`} key={review.id}>
                <article
                  className="card-y2k p-3 sm:p-5 flex gap-3 sm:gap-5 group cursor-pointer overflow-hidden"
                  style={{ "--rating-color": getRatingHex(review.rating) } as React.CSSProperties}
                >
                  {/* Cover from the catalog */}
                  <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 overflow-hidden">
                    {review.cover_image ? (
                      <img
                        src={review.cover_image}
                        alt={`${review.title} cover`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <span className="text-3xl group-hover:scale-110 transition-transform">
                        💿
                      </span>
                    )}
                  </div>

                  {/* Review Content */}
                  <div className="flex-1 space-y-2 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h2 className={`font-[family-name:var(--font-heading)] text-base sm:text-xl font-bold text-text-primary transition-colors break-words rating-title-hover${review.rating >= 9.5 ? " rating-title-glow-elite" : ""}`}>
                          {review.title}
                        </h2>
                        <p className="text-sm text-text-secondary truncate">
                          {review.artist}
                        </p>
                      </div>
                      <div
                        className={`rating-badge shrink-0 ${getRatingColor(review.rating)}`}
                      >
                        {formatRating(review.rating)}
                      </div>
                    </div>

                    {review.snippet && (
                      <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                        {review.snippet}
                      </p>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Reviewer attribution */}
                      <span className="flex items-center gap-1.5 text-xs text-text-muted min-w-0">
                        {author.avatar_url ? (
                          <img
                            src={author.avatar_url}
                            alt=""
                            className="w-4 h-4 rounded-full object-cover border border-white/10"
                          />
                        ) : (
                          <span className="w-4 h-4 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-[8px] font-bold text-accent-primary uppercase">
                            {(author.username || "U")[0]}
                          </span>
                        )}
                        <span className="truncate">
                          {author.display_name || author.username}
                        </span>
                        {isVerified && <VerifiedBadge role={author.role} />}
                      </span>

                      {review.genre && (
                        <span
                          className={`pixel-text text-xs uppercase tracking-widest ${getGenreColor(review.genre)}`}
                        >
                          {review.genre}
                        </span>
                      )}
                      <span className="text-text-muted text-xs">
                        {review.review_date
                          ? new Date(review.review_date + "T12:00:00").toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })
                          : ""}
                      </span>
                    </div>
                  </div>
                </article>
              </Link>
            );
          })
        )}
      </div>
    </>
  );
}
