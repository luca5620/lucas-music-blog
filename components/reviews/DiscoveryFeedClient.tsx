"use client";

/**
 * DiscoveryFeedClient — the home page Community Feed, view-switchable.
 *
 * The server half (DiscoveryFeed.tsx) fetches; this half renders with
 * the same folder-style views as everywhere else (detailed / posters /
 * compact) via the shared persisted preference. The toggle sits in the
 * section header next to "View All".
 */

import Link from "next/link";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import LikeButton from "@/components/reviews/LikeButton";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import { useReviewView, ViewToggle } from "@/components/reviews/ViewToggle";

export interface FeedReview {
  id: string;
  slug: string;
  title: string;
  artist: string;
  rating: number;
  genre: string | null;
  release_type: string | null;
  release_date: string | null;
  cover_image: string | null;
  created_at: string;
  like_count: number;
  viewer_has_liked: boolean;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: "user" | "reviewer" | "admin" | "owner" | "tester";
  };
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function DiscoveryFeedClient({ feed }: { feed: FeedReview[] }) {
  const [view, setView] = useReviewView();

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="glow-orb" style={{ animationDelay: "3s" }} />
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary">
          Community Feed
        </h2>
        <div className="flex-1 divider-glow" />
        <ViewToggle view={view} onChange={setView} />
        <Link
          href="/reviews"
          className="label-xbox hover:text-accent-primary transition-colors"
        >
          View All →
        </Link>
      </div>

      {/* ===== Posters ===== */}
      {view === "posters" && (
        <div className="poster-grid">
          {feed.map((review) => (
            <Link
              key={review.id}
              href={`/reviews/${review.slug}`}
              className="group space-y-1.5"
              title={`${review.title} — ${review.artist} (${formatRating(review.rating)}/10 by ${review.profiles.username})`}
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

      {/* ===== Compact ===== */}
      {view === "compact" && (
        <div className="panel-xbox divide-y divide-border-subtle">
          {feed.map((review) => {
            const author = review.profiles;
            return (
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
                <span className="hidden sm:flex items-center gap-1 text-xs text-text-muted shrink-0">
                  {author.display_name || author.username}
                  {author.role !== "user" && <VerifiedBadge role={author.role} />}
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

      {/* ===== Detailed cards (default) ===== */}
      {view === "detailed" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {feed.map((review) => {
            const profile = review.profiles;
            const ratingColor = getRatingHex(review.rating);
            const isVerified = profile.role !== "user";

            return (
              <Link
                key={review.id}
                href={`/reviews/${review.slug}`}
                className="panel-xbox p-4 sm:p-5 space-y-3 group cursor-pointer hover-glow relative overflow-hidden"
              >
                {isVerified && (
                  <div className="absolute top-1 right-1 z-10">
                    <VerifiedBadge role={profile.role} />
                  </div>
                )}

                <div className="aspect-square rounded-lg bg-[rgba(30,144,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center relative overflow-hidden group-hover:border-[rgba(255,255,255,0.3)] transition-all">
                  {review.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={review.cover_image}
                      alt={`${review.title} cover`}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <span className="text-5xl group-hover:scale-110 transition-transform">
                      {"//"}
                    </span>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>

                {/* Type + Year — same treatment as the release cards */}
                <div className="flex items-center justify-between">
                  <span className="label-xbox text-[0.6rem]">
                    {(review.release_type ?? "MUSIC").toUpperCase()}
                  </span>
                  {review.release_date && review.release_date.length >= 4 && (
                    <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
                      {review.release_date.slice(0, 4)}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#e8e6e3] group-hover:text-accent-primary transition-colors">
                    {review.title}
                  </h3>
                  <p className="text-sm text-[#9a9a9e]">{review.artist}</p>
                </div>

                {/* Glowing rating badge — identical classes to Latest Drops */}
                <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                  <div
                    className={`rating-badge text-sm w-10 h-10 ${getRatingColor(review.rating)}`}
                    style={{ color: ratingColor, borderColor: ratingColor }}
                  >
                    {formatRating(review.rating)}
                  </div>
                </div>

                {/* Author + Like + Time */}
                <div className="flex items-center gap-2 pt-1 border-t border-white/5">
                  {profile.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={profile.avatar_url}
                      alt={profile.display_name || profile.username}
                      className="w-5 h-5 rounded-full object-cover border border-white/10"
                    />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-accent-primary/20 border border-accent-primary/30 flex items-center justify-center">
                      <span className="text-[9px] font-bold text-accent-primary uppercase">
                        {(profile.username || "U")[0]}
                      </span>
                    </div>
                  )}
                  <span className="text-xs text-text-muted flex items-center gap-1 truncate">
                    {profile.display_name || profile.username}
                    {isVerified && <VerifiedBadge role={profile.role} />}
                  </span>
                  <span className="ml-auto flex items-center gap-2">
                    <LikeButton
                      reviewId={review.id}
                      initialCount={review.like_count}
                      initialLiked={review.viewer_has_liked}
                      size="sm"
                    />
                    <span className="text-xs text-text-muted">
                      {timeAgo(review.created_at)}
                    </span>
                  </span>
                </div>

                <div className="scan-bar" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
