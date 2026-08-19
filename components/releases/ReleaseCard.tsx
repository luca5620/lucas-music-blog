/**
 * ReleaseCard — Server component card for a release in grid contexts
 * (artist pages, /releases list, search results).
 *
 * Visual: panel-xbox card with square cover, title, optional artist link,
 * release_type + year row, rating + review count row.
 */

import Link from "next/link";
import type { Release } from "@/lib/types/database";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import LiveBadge from "@/components/rooms/LiveBadge";

interface ReleaseCardProps {
  release: Release;
  artistName?: string;
  artistSlug?: string;
  reviewCount?: number;
  avgRating?: number | null;
  followerCount?: number;
  /** ISO timestamp of last room activity — drives the LIVE badge. */
  lastActivityAt?: string | null;
}

export default function ReleaseCard({
  release,
  artistName,
  artistSlug,
  reviewCount,
  avgRating,
  followerCount,
  lastActivityAt = null,
}: ReleaseCardProps) {
  const year =
    release.release_date && release.release_date.length >= 4
      ? release.release_date.slice(0, 4)
      : null;

  const hasRating = typeof avgRating === "number" && !Number.isNaN(avgRating);
  const ratingDisplay = hasRating ? formatRating(avgRating!) : null;
  const ratingColor = hasRating ? getRatingHex(avgRating!) : "#1e90ff";
  const ratingClass = hasRating ? getRatingColor(avgRating!) : "";

  return (
    <Link
      href={`/releases/${release.slug}`}
      className="panel-xbox p-4 sm:p-5 space-y-4 group cursor-pointer hover-glow relative overflow-hidden block"
    >
      {/* Cover art */}
      <div className="aspect-square rounded-lg bg-[rgba(30,144,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center relative overflow-hidden group-hover:border-[rgba(255,255,255,0.3)] transition-all">
        {release.cover_image ? (
          <img
            src={release.cover_image}
            alt={`${release.title} cover`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <span className="text-5xl text-text-muted group-hover:scale-110 transition-transform">
            {"//"}
          </span>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute top-2 right-2 z-10">
          <LiveBadge lastActivityAt={lastActivityAt} />
        </div>
      </div>

      {/* Type + Year */}
      <div className="flex items-center justify-between">
        <span className="label-xbox text-[0.6rem]">
          {release.release_type.toUpperCase()}
        </span>
        {year && (
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            {year}
          </span>
        )}
      </div>

      {/* Title + Artist */}
      <div>
        <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#e8e6e3] group-hover:text-accent-primary transition-colors line-clamp-2">
          {release.title}
        </h3>
        {artistName && (
          artistSlug ? (
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/artists/${artistSlug}`;
              }}
              className="text-sm text-text-secondary hover:text-accent-primary transition-colors cursor-pointer inline-block"
            >
              {artistName}
            </span>
          ) : (
            <p className="text-sm text-text-secondary">{artistName}</p>
          )
        )}
      </div>

      {/* Stats row: rating + review count + followers */}
      {(hasRating || (reviewCount !== undefined && reviewCount > 0) || (followerCount !== undefined && followerCount > 0)) && (
        <div className="flex items-center justify-between gap-2 pt-1">
          {hasRating && ratingDisplay ? (
            <div
              className={`rating-badge text-sm w-10 h-10 ${ratingClass}`}
              style={{ color: ratingColor, borderColor: ratingColor }}
            >
              {ratingDisplay}
            </div>
          ) : (
            <span className="text-xs text-text-muted italic">No reviews</span>
          )}

          <div className="flex flex-col items-end gap-0.5 text-right">
            {reviewCount !== undefined && reviewCount > 0 && (
              <span className="text-xs text-text-muted">
                {reviewCount} {reviewCount === 1 ? "review" : "reviews"}
              </span>
            )}
            {followerCount !== undefined && followerCount > 0 && (
              <span className="text-xs text-text-muted">
                {followerCount} {followerCount === 1 ? "follower" : "followers"}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="scan-bar" />
    </Link>
  );
}
