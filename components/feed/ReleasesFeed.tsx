/**
 * ReleasesFeed — server component for the release-first home feed.
 *
 * Renders a grid of recent releases (cover, title, artist, rating, follower
 * count). Empty result returns null so the section auto-hides — keeps the
 * home page rendering before migration 002 is applied / data is seeded.
 *
 * We render a custom card here (rather than reusing ReleaseCard) so we can
 * surface "be the first to review" copy and the linked artist slug — the
 * existing ReleaseCard takes a `Release` row, but our feed item is a denser
 * derived shape.
 */

import Link from "next/link";
import { getReleaseDiscoveryFeed } from "@/lib/db/releases";
import { getRatingHex, getRatingColor } from "@/lib/reviews";
import LiveBadge from "@/components/rooms/LiveBadge";

function yearOf(dateStr: string | null): string | null {
  if (!dateStr || dateStr.length < 4) return null;
  return dateStr.slice(0, 4);
}

export default async function ReleasesFeed() {
  let feed: Awaited<ReturnType<typeof getReleaseDiscoveryFeed>> = [];
  try {
    feed = await getReleaseDiscoveryFeed(9);
  } catch {
    // Table may not exist yet (pre-migration). Degrade silently.
    feed = [];
  }

  if (feed.length === 0) return null;

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="glow-orb" style={{ animationDelay: "2.5s" }} />
        <span className="label-xbox">New Releases</span>
        <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary">
          Latest Drops
        </h2>
        <div className="flex-1 divider-glow" />
        <Link
          href="/releases"
          className="label-xbox hover:text-accent-primary transition-colors"
        >
          View All →
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {feed.map((item) => {
          const year = yearOf(item.release_date);
          const hasRating =
            typeof item.avg_rating === "number" &&
            !Number.isNaN(item.avg_rating);
          const ratingColor = hasRating
            ? getRatingHex(item.avg_rating!)
            : "#1e90ff";
          const ratingClass = hasRating ? getRatingColor(item.avg_rating!) : "";
          const ratingDisplay = hasRating ? item.avg_rating!.toFixed(1) : null;

          return (
            <Link
              key={item.id}
              href={`/releases/${item.slug}`}
              className="panel-xbox p-4 sm:p-5 space-y-3 group cursor-pointer hover-glow relative overflow-hidden"
            >
              {/* Cover art */}
              <div className="aspect-square rounded-lg bg-[rgba(30,144,255,0.05)] border border-[rgba(255,255,255,0.1)] flex items-center justify-center relative overflow-hidden group-hover:border-[rgba(255,255,255,0.3)] transition-all">
                {item.cover_image ? (
                  <img
                    src={item.cover_image}
                    alt={`${item.title} cover`}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <span className="text-5xl text-text-muted group-hover:scale-110 transition-transform">
                    {"//"}
                  </span>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute top-2 right-2 z-10">
                  <LiveBadge lastActivityAt={item.last_activity_at} />
                </div>
              </div>

              {/* Type + Year */}
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

              {/* Title + Artist */}
              <div>
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-[#e8e6e3] group-hover:text-accent-primary transition-colors line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-sm text-text-secondary">
                  {item.primary_artist.name}
                </p>
              </div>

              {/* Stats row */}
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
                {hasRating && ratingDisplay ? (
                  <div
                    className={`rating-badge text-sm w-10 h-10 ${ratingClass}`}
                    style={{ color: ratingColor, borderColor: ratingColor }}
                  >
                    {ratingDisplay}
                  </div>
                ) : (
                  <span className="text-xs text-text-muted italic">
                    be the first to review
                  </span>
                )}

                <div className="flex flex-col items-end gap-0.5 text-right">
                  {item.review_count > 0 && (
                    <span className="text-xs text-text-muted">
                      {item.review_count}{" "}
                      {item.review_count === 1 ? "review" : "reviews"}
                    </span>
                  )}
                  {item.follower_count > 0 && (
                    <span className="text-xs text-text-muted">
                      {item.follower_count}{" "}
                      {item.follower_count === 1 ? "follower" : "followers"}
                    </span>
                  )}
                </div>
              </div>

              <div className="scan-bar" />
            </Link>
          );
        })}
      </div>
    </section>
  );
}
