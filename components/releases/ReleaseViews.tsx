"use client";

/**
 * ReleaseViews — the three folder-style renderings for RELEASE
 * listings (Latest Drops on home, the /releases index): detailed
 * cards / poster wall / compact rows. Parents own the ViewToggle
 * placement and pass the current view down; the preference itself
 * is the same one shared with review listings.
 */

import Link from "next/link";
import { getRatingHex, getRatingColor, formatRating } from "@/lib/rating";
import { smallCover } from "@/lib/images";
import LiveBadge from "@/components/rooms/LiveBadge";
import type { ReviewView } from "@/components/reviews/ViewToggle";

export interface ReleaseListItem {
  id: string;
  slug: string;
  title: string;
  cover_image: string | null;
  release_type: string;
  release_date: string | null;
  artistName?: string | null;
  avgRating?: number | null;
  reviewCount?: number;
  followerCount?: number;
  lastActivityAt?: string | null;
}

function yearOf(dateStr: string | null): string | null {
  if (!dateStr || dateStr.length < 4) return null;
  return dateStr.slice(0, 4);
}

export default function ReleaseViews({
  items,
  view,
}: {
  items: ReleaseListItem[];
  view: ReviewView;
}) {
  /* ===== Posters ===== */
  if (view === "posters") {
    return (
      <div className="poster-grid">
        {items.map((item) => {
          const hasRating =
            typeof item.avgRating === "number" && !Number.isNaN(item.avgRating);
          return (
            <Link
              key={item.id}
              href={`/releases/${item.slug}`}
              className="group space-y-1.5"
              title={`${item.title}${item.artistName ? ` — ${item.artistName}` : ""}`}
            >
              <span className="poster">
                {item.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={smallCover(item.cover_image)} alt={`${item.title} cover`} loading="lazy" decoding="async" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-4xl">
                    💿
                  </span>
                )}
                {/* The stamp is the COMMUNITY average, not one person's
                    score — say so (Luca 2026-08-22: nothing indicated
                    what the number was, or which drops nobody had rated
                    yet). Unrated gets an explicit muted stamp. */}
                {hasRating ? (
                  <span
                    className="poster-rating"
                    style={{ color: getRatingHex(item.avgRating!) }}
                  >
                    <span className="text-[0.55rem] font-normal text-text-muted mr-1">AVG</span>
                    {formatRating(item.avgRating!)}
                  </span>
                ) : (
                  <span className="poster-rating !text-[0.55rem] !font-normal text-text-muted tracking-wider">
                    UNRATED
                  </span>
                )}
              </span>
              <span className="block">
                <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)]">
                  {item.title}
                </span>
                {item.artistName && (
                  <span className="block text-xs text-text-secondary truncate">
                    {item.artistName}
                  </span>
                )}
              </span>
            </Link>
          );
        })}
      </div>
    );
  }

  /* ===== Compact rows ===== */
  if (view === "compact") {
    return (
      <div className="panel-xbox divide-y divide-border-subtle">
        {items.map((item) => {
          const hasRating =
            typeof item.avgRating === "number" && !Number.isNaN(item.avgRating);
          return (
            <Link
              key={item.id}
              href={`/releases/${item.slug}`}
              className="flex items-center gap-3 px-3 py-2 hover:bg-bg-elevated transition-colors"
            >
              <span className="w-9 h-9 rounded overflow-hidden bg-bg-elevated border border-border-subtle shrink-0">
                {item.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={smallCover(item.cover_image)}
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
                  {item.title}
                </span>
                {item.artistName && (
                  <span className="text-text-secondary"> — {item.artistName}</span>
                )}
              </span>
              <span className="hidden sm:inline pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                {item.release_type.toUpperCase()}
              </span>
              {/* Same honesty as the detailed card's "Community Avg"
                  block, folded into a right-aligned micro-stack. */}
              {hasRating ? (
                <span className="shrink-0 w-11 text-right leading-none">
                  <span
                    className="block pixel-text text-sm font-bold tabular-nums"
                    style={{ color: getRatingHex(item.avgRating!) }}
                  >
                    {formatRating(item.avgRating!)}
                  </span>
                  <span className="block pixel-text text-[8px] uppercase tracking-widest text-text-muted mt-0.5">
                    AVG
                  </span>
                </span>
              ) : (
                <span className="pixel-text text-[9px] uppercase tracking-widest text-text-muted shrink-0 w-11 text-right leading-tight">
                  UNRATED
                </span>
              )}
            </Link>
          );
        })}
      </div>
    );
  }

  /* ===== Detailed cards (default) ===== */
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6 items-start">
      {items.map((item) => {
        const year = yearOf(item.release_date);
        const hasRating =
          typeof item.avgRating === "number" && !Number.isNaN(item.avgRating);
        const ratingColor = hasRating ? getRatingHex(item.avgRating!) : "#1e90ff";
        const ratingClass = hasRating ? getRatingColor(item.avgRating!) : "";

        return (
          <Link
            key={item.id}
            href={`/releases/${item.slug}`}
            className="panel-xbox p-4 sm:p-5 space-y-3 group cursor-pointer hover-glow relative overflow-hidden"
          >
            <div className="aspect-square rounded-lg bg-[rgba(30,144,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center relative overflow-hidden group-hover:border-[rgba(255,255,255,0.3)] transition-all">
              {item.cover_image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.cover_image}
                  // Browser picks: 300px file at grid sizes, 640 when the
                  // card spans a phone screen.
                  srcSet={`${smallCover(item.cover_image)} 300w, ${item.cover_image} 640w`}
                  sizes="(min-width: 1536px) 18vw, (min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                  alt={`${item.title} cover`}
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                />
              ) : (
                <span className="text-5xl text-text-muted group-hover:scale-110 transition-transform">
                  {"//"}
                </span>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="absolute top-2 right-2 z-10">
                <LiveBadge lastActivityAt={item.lastActivityAt ?? null} />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="label-xbox text-[0.6rem]">
                {item.release_type.toUpperCase()}
              </span>
              {year && (
                <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
                  {year}
                </span>
              )}
            </div>

            <div>
              <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#e8e6e3] group-hover:text-accent-primary transition-colors line-clamp-2">
                {item.title}
              </h3>
              {item.artistName && (
                <p className="text-sm text-text-secondary">{item.artistName}</p>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
              {/* Reviewed → the community's average (a plain mean over
                  every published rating, so ten 10s and one 5 land near
                  10 — each VOTE weighs the same, not each value).
                  Untouched → the standing invitation. */}
              {hasRating ? (
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`rating-badge text-sm w-10 h-10 shrink-0 ${ratingClass}`}
                    style={{ color: ratingColor, borderColor: ratingColor }}
                  >
                    {formatRating(item.avgRating!)}
                  </div>
                  <span className="min-w-0">
                    <span className="block pixel-text text-[10px] uppercase tracking-widest text-text-muted">
                      Community Avg
                    </span>
                    <span className="block text-xs text-text-muted">
                      {item.reviewCount ?? 0}{" "}
                      {(item.reviewCount ?? 0) === 1 ? "review" : "reviews"}
                    </span>
                  </span>
                </div>
              ) : (
                <span className="text-xs text-text-muted italic">
                  be the first to review
                </span>
              )}

              {(item.followerCount ?? 0) > 0 && (
                <span className="text-xs text-text-muted text-right shrink-0">
                  {item.followerCount}{" "}
                  {item.followerCount === 1 ? "follower" : "followers"}
                </span>
              )}
            </div>

            <div className="scan-bar" />
          </Link>
        );
      })}
    </div>
  );
}
