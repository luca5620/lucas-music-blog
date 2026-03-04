"use client";

import { useState } from "react";
import Link from "next/link";
import type { Review, Genre } from "@/lib/reviews";
import { getGenreColor, getRatingColor, getRatingHex } from "@/lib/reviews";

const GENRE_OPTIONS: (Genre | "All")[] = [
  "All",
  "Hip-Hop",
  "Pop",
  "Alternative",
  "R&B",
];

const RATING_OPTIONS: (number | "All")[] = ["All", 10, 9, 8, 7, 6, 5, 4, 3, 2, 1];

export default function ReviewsList({ reviews }: { reviews: Review[] }) {
  const [activeGenre, setActiveGenre] = useState<Genre | "All">("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeRating, setActiveRating] = useState<number | "All">("All");

  const filtered = reviews
    .filter((r) => activeGenre === "All" || r.genre === activeGenre)
    .filter((r) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.artist.toLowerCase().includes(q);
    })
    .filter((r) => {
      if (activeRating === "All") return true;
      return Math.floor(r.rating) === activeRating || (activeRating === 10 && r.rating === 10);
    });

  return (
    <>
      {/* Search Input */}
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by title or artist..."
          className="w-full px-4 py-3 rounded-lg bg-bg-elevated border border-border-subtle text-text-primary placeholder:text-text-muted text-sm focus:outline-none focus:border-accent-primary/50 focus:ring-1 focus:ring-accent-primary/25 transition-all"
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

      {/* Genre Filter */}
      <div className="flex flex-wrap gap-2">
        {GENRE_OPTIONS.map((genre) => (
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
              No reviews match your filters.
            </p>
          </div>
        ) : (
          filtered.map((review) => (
            <Link href={`/reviews/${review.slug}`} key={review.slug}>
              <article
                className="card-y2k p-3 sm:p-5 flex gap-3 sm:gap-5 group cursor-pointer overflow-hidden"
                style={{ "--rating-color": getRatingHex(review.rating) } as React.CSSProperties}
              >
                {/* Cover Image or Placeholder */}
                <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 overflow-hidden">
                  {review.coverImage ? (
                    <img
                      src={review.coverImage}
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
                    <div>
                      <h2 className={`font-[family-name:var(--font-heading)] text-base sm:text-xl font-bold text-text-primary transition-colors break-words rating-title-hover${review.rating >= 9.5 ? " rating-title-glow-elite" : ""}`}>
                        {review.title}
                      </h2>
                      <p className="text-sm text-text-secondary">
                        {review.artist}
                      </p>
                    </div>
                    <div
                      className={`rating-badge shrink-0 ${getRatingColor(review.rating)}`}
                    >
                      {review.rating}
                    </div>
                  </div>

                  <p className="text-sm text-text-secondary leading-relaxed line-clamp-2">
                    {review.snippet}
                  </p>

                  <div className="flex items-center gap-3">
                    <span
                      className={`pixel-text text-xs uppercase tracking-widest ${getGenreColor(review.genre)}`}
                    >
                      {review.genre}
                    </span>
                    <span className="text-text-muted text-xs">
                      {review.reviewDate
                        ? new Date(review.reviewDate + "T12:00:00").toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "Review pending"}
                    </span>
                  </div>
                </div>
              </article>
            </Link>
          ))
        )}
      </div>
    </>
  );
}
