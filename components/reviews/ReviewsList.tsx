"use client";

import { useState } from "react";
import Link from "next/link";
import type { Review, Genre } from "@/lib/reviews";
import { getGenreColor, getRatingColor } from "@/lib/reviews";

const GENRE_OPTIONS: (Genre | "All")[] = [
  "All",
  "Hip-Hop",
  "Pop",
  "Alternative",
  "R&B",
];

export default function ReviewsList({ reviews }: { reviews: Review[] }) {
  const [activeGenre, setActiveGenre] = useState<Genre | "All">("All");

  const filtered =
    activeGenre === "All"
      ? reviews
      : reviews.filter((r) => r.genre === activeGenre);

  return (
    <>
      {/* Filter Bar */}
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

      {/* Review List */}
      <div className="space-y-4">
        {filtered.length === 0 ? (
          <div className="card-y2k p-8 text-center">
            <p className="text-text-muted pixel-text text-sm">
              No reviews in this genre yet.
            </p>
          </div>
        ) : (
          filtered.map((review) => (
            <Link href={`/reviews/${review.slug}`} key={review.slug}>
              <article className="card-y2k p-3 sm:p-5 flex gap-3 sm:gap-5 group cursor-pointer overflow-hidden">
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
                      <h2 className="font-[family-name:var(--font-heading)] text-base sm:text-xl font-bold text-text-primary group-hover:text-accent-primary transition-colors break-words">
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
