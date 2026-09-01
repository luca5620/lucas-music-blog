/**
 * /social — the community hub (renamed from /friends, Luca
 * 2026-08-31: "Social" describes rooms + charts + activity better
 * than "Friends", which implies you need some first).
 *
 * Server component, sections in order:
 *  1. Find people — username search.
 *  2. TOP ROOMS — the live rooms with the most people in them right
 *     now (presence-ranked client-side; see TopRooms).
 *  3. TOP REVIEWS THIS WEEK — most review-likes RECEIVED since the
 *     Friday-midnight-ET reset, any-age reviews welcome (an old
 *     review that resurfaces this week deservedly tops the chart).
 *  4. Leaderboard — the community charts.
 *  5. "Popular with friends" — poster rail from the people you follow.
 *  6. The activity feed — one sentence per event.
 *  7. "Find people" suggestions when the feed is quiet.
 *
 * Logged-out visitors get the sign-in prompt (the discovery modules
 * are follow-independent, but the page is a signed-in surface).
 */

import Link from "next/link";
import { formatRating } from "@/lib/rating";
import { getUser } from "@/lib/auth";
import UserSearch from "@/components/friends/UserSearch";
import Leaderboard from "@/components/friends/Leaderboard";
import PageHero from "@/components/ui/PageHero";
import TopRooms from "@/components/social/TopRooms";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import { getLeaderboard } from "@/lib/db/leaderboard";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
import { getActiveRooms, getTopReviewsThisWeek } from "@/lib/db/social";
import type { TopWeekReview } from "@/lib/db/social";
import { smallCover } from "@/lib/images";
import {
  getFriendActivity,
  getPopularWithFriends,
  getSuggestedProfiles,
  type ActivityItem,
  type PopularItem,
  type SuggestedProfile,
} from "@/lib/db/activity";

export const metadata = {
  title: "Social",
  robots: { index: false, follow: false },
};

// The feed is per-viewer and time-sensitive — always render fresh.
export const dynamic = "force-dynamic";

/* ============================================
   Small server-side helpers
   ============================================ */

/** "3m ago" / "2h ago" / "5d ago" / "Mar 3" — relative timestamps. */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - then) / 1000));

  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  // Older than a week: just show the date.
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Only https:// or local /path images (stored-XSS defense). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

/** Rating color ramp shared with the review UI. */
function getRatingColor(rating: number): string {
  if (rating >= 9) return "#a855f7";
  if (rating >= 8) return "#22c55e";
  if (rating >= 7) return "#84cc16";
  if (rating >= 6) return "#eab308";
  if (rating >= 5) return "#f97316";
  if (rating >= 4) return "#ef4444";
  return "#dc2626";
}

/* ============================================
   Page
   ============================================ */

export default async function SocialPage() {
  const user = await getUser();

  // --- Logged out: a friendly sign-in prompt ---
  if (!user) {
    return (
      <div className="max-w-2xl mx-auto py-16">
        <div className="panel-xbox panel-xbox-glow p-8 text-center space-y-4">
          <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl font-extrabold text-[#e8e6e3]">
            SOCIAL
          </h1>
          <p className="font-[family-name:var(--font-vt323)] text-lg text-[#9a9a9e]">
            Live rooms, the week&apos;s biggest reviews, and what the
            people you follow are listening to — all in one place.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link href="/login" className="btn-y2k btn-y2k-primary">
              Sign In
            </Link>
            <Link href="/signup" className="btn-y2k btn-y2k-outline">
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // --- Logged in: fetch everything in parallel ---
  const [
    activity,
    popular,
    suggestions,
    allLeaderboard,
    blocked,
    activeRooms,
    allTopWeek,
  ] = await Promise.all([
    getFriendActivity(user.id, { limit: 40 }),
    getPopularWithFriends(user.id, { limit: 6 }),
    getSuggestedProfiles(user.id, { limit: 6 }),
    getLeaderboard(50),
    getViewerBlockedIdSet(),
    getActiveRooms(12),
    getTopReviewsThisWeek(10),
  ]);
  // Blocked users stay off the viewer's charts (App Store 1.2).
  const leaderboard = allLeaderboard.filter((r) => !blocked.has(r.user_id));
  const topWeek = allTopWeek.filter((r) => !blocked.has(r.user_id));

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Page header — boxed hero, same as HOME */}
      <PageHero
        title="SOCIAL"
        sub="Live rooms, weekly charts, and what your people are spinning."
      />

      {/* Find people — type a username, click through, hit Follow */}
      <UserSearch />

      {/* ===== Top Rooms — presence-ranked live rooms ===== */}
      <TopRooms rooms={activeRooms} />

      {/* ===== Top Reviews This Week — likes received since the
             Friday-midnight-ET reset, any-age reviews ===== */}
      {topWeek.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <h2 className="label-xbox">Top Reviews This Week</h2>
            <span className="text-xs text-text-muted">resets Friday</span>
          </div>
          <div className="space-y-2">
            {topWeek.map((review, i) => (
              <TopWeekRow key={review.id} review={review} rank={i + 1} />
            ))}
          </div>
        </section>
      )}

      {/* ===== Leaderboard — the community charts (Luca 2026-08-26).
             Empty until migration 023 runs; the section hides itself
             rather than showing a bare header. ===== */}
      {leaderboard.length > 0 && <Leaderboard rows={leaderboard} />}

      {/* ===== Popular with friends ===== */}
      {popular.length > 0 && (
        <section className="space-y-3">
          <h2 className="label-xbox">Popular With Friends</h2>
          <div className="poster-grid">
            {popular.map((item) => (
              <PopularPoster key={`${item.title}|${item.artist}`} item={item} />
            ))}
          </div>
        </section>
      )}

      {/* ===== Activity feed ===== */}
      <section className="space-y-3">
        <h2 className="label-xbox">Recent Activity</h2>

        {activity.length === 0 ? (
          <div className="panel-xbox p-8 text-center space-y-2">
            <p className="font-[family-name:var(--font-vt323)] text-xl text-[#5a5a60]">
              Nothing here yet.
            </p>
            <p className="text-sm text-[#9a9a9e]">
              Follow some people and their listens, reviews, and lists
              will show up in this feed.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activity.map((item, i) => (
              <ActivityRow key={`${item.type}-${item.created_at}-${i}`} item={item} />
            ))}
          </div>
        )}
      </section>

      {/* ===== Find people (shown while the feed is quiet) ===== */}
      {activity.length === 0 && suggestions.length > 0 && (
        <section className="space-y-3">
          <h2 className="label-xbox">Find People</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {suggestions.map((profile) => (
              <SuggestionCard key={profile.id} profile={profile} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================
   Top-week chart row — rank + cover + review + weekly hearts
   ============================================ */

/** Medal colors for 1/2/3, muted for the rest (same as Leaderboard). */
function rankColor(rank: number): string {
  if (rank === 1) return "#fbbf24";
  if (rank === 2) return "#d1d5db";
  if (rank === 3) return "#b45309";
  return "#5a5a60";
}

function TopWeekRow({
  review,
  rank,
}: {
  review: TopWeekReview;
  rank: number;
}) {
  const cover = safeImage(review.cover_image);
  const author = review.profiles;
  const authorName = author?.display_name || author?.username || "unknown";

  return (
    <Link
      href={`/reviews/${review.slug}`}
      className="card-y2k p-3 flex items-center gap-3 hover-glow"
    >
      {/* Rank */}
      <span
        className="w-7 shrink-0 text-center font-[family-name:var(--font-heading)] font-extrabold text-lg tabular-nums"
        style={{ color: rankColor(rank) }}
      >
        {rank}
      </span>

      {/* Cover */}
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={smallCover(cover)}
          alt={`${review.title} by ${review.artist}`}
          loading="lazy"
          decoding="async"
          className="w-11 h-11 rounded object-cover border border-white/10 shrink-0"
        />
      ) : (
        <span className="w-11 h-11 rounded bg-bg-elevated border border-white/10 flex items-center justify-center text-lg shrink-0">
          💿
        </span>
      )}

      {/* Title / artist / author */}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)]">
          {review.title}
        </span>
        <span className="block text-xs text-text-muted truncate">
          {review.artist} · review by {authorName}
          {author && author.role !== "user" && (
            <span className="inline-flex align-middle ml-1">
              <VerifiedBadge role={author.role} />
            </span>
          )}
        </span>
      </span>

      {/* Rating chip */}
      <span
        className="shrink-0 inline-flex items-center px-1.5 rounded font-[family-name:var(--font-heading)] font-bold text-xs"
        style={{
          color: getRatingColor(review.rating),
          border: `1px solid ${getRatingColor(review.rating)}55`,
          background: `${getRatingColor(review.rating)}12`,
        }}
      >
        {formatRating(review.rating)}
      </span>

      {/* Weekly hearts */}
      <span className="shrink-0 inline-flex items-center gap-1 text-[#ff4d6d] text-xs font-bold tabular-nums">
        <svg
          width={12}
          height={12}
          viewBox="0 0 24 24"
          fill="#ff4d6d"
          stroke="#ff4d6d"
          strokeWidth={2}
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>
        {review.week_likes}
      </span>
    </Link>
  );
}

/* ============================================
   Popular poster tile — cover + avg-rating chip
   ============================================ */

function PopularPoster({ item }: { item: PopularItem }) {
  const cover = safeImage(item.cover_image);
  const label = `${item.title} — ${item.artist} · ${item.count} ${
    item.count === 1 ? "listen" : "listens"
  } from friends`;

  const inner = (
    <>
      {cover ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={cover} alt={`${item.title} by ${item.artist}`} />
      ) : (
        <span className="absolute inset-0 flex items-center justify-center p-2 text-center text-xs leading-tight text-[#9a9a9e] font-[family-name:var(--font-heading)] font-bold">
          {item.title}
        </span>
      )}
      {/* Average rating chip in the corner (1 decimal, e.g. 8.7) */}
      {item.avg_rating !== null && (
        <span
          className="poster-rating"
          style={{ color: getRatingColor(item.avg_rating) }}
        >
          {formatRating(item.avg_rating)}
        </span>
      )}
    </>
  );

  // Old reviews can predate release_id, so a tile may have no page
  // to point at — those stay a plain poster instead of a dead link.
  if (item.release_slug) {
    return (
      <Link href={`/releases/${item.release_slug}`} className="poster" title={label}>
        {inner}
      </Link>
    );
  }

  return (
    <div className="poster" title={label}>
      {inner}
    </div>
  );
}

/* ============================================
   One feed row: avatar + sentence + timestamp
   ============================================ */

function ActivityRow({ item }: { item: ActivityItem }) {
  const { actor } = item;
  const name = actor.display_name || actor.username;
  const avatar = safeImage(actor.avatar_url);

  return (
    <article className="card-y2k p-3 sm:p-4 flex items-start gap-3">
      {/* Actor avatar, linked to their profile */}
      <Link
        href={`/profile/${actor.username}`}
        className="w-9 h-9 rounded-full overflow-hidden bg-bg-elevated border border-[rgba(255,255,255,0.15)] flex items-center justify-center shrink-0"
      >
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-[#9a9a9e] font-bold">
            {name[0]?.toUpperCase()}
          </span>
        )}
      </Link>

      {/* The sentence + timestamp */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-[#9a9a9e] leading-relaxed">
          <Link
            href={`/profile/${actor.username}`}
            className="font-bold text-[#e8e6e3] hover:text-accent-primary transition-colors"
          >
            {name}
          </Link>{" "}
          <ActivitySentence item={item} />
        </p>
        <p className="font-[family-name:var(--font-vt323)] text-xs text-[#5a5a60] mt-0.5">
          {timeAgo(item.created_at)}
        </p>
      </div>
    </article>
  );
}

/** The verb + object part of the sentence, per activity type. */
function ActivitySentence({ item }: { item: ActivityItem }) {
  switch (item.type) {
    case "debate": {
      const p = item.payload;
      return (
        <>
          started a debate:{" "}
          <Link
            href={`/debates/${p.slug}`}
            className="text-[#e8e6e3] font-medium hover:text-accent-primary transition-colors"
          >
            {p.title}
          </Link>{" "}
          <span className="text-[#5a5a60]">
            ({p.side_a_label} vs {p.side_b_label})
          </span>
        </>
      );
    }
    case "review": {
      const p = item.payload;
      return (
        <>
          reviewed{" "}
          <Link
            href={`/reviews/${p.slug}`}
            className="text-[#e8e6e3] font-medium hover:text-accent-primary transition-colors"
          >
            {p.title}
          </Link>{" "}
          by {p.artist}
          <RatingChip rating={p.rating} />
        </>
      );
    }
    case "list": {
      const p = item.payload;
      return (
        <>
          made a list:{" "}
          <Link
            href={`/lists/${item.actor.username}/${p.slug}`}
            className="text-[#e8e6e3] font-medium hover:text-accent-primary transition-colors"
          >
            {p.title}
          </Link>{" "}
          <span className="text-[#5a5a60]">
            ({p.item_count} {p.item_count === 1 ? "album" : "albums"}
            {p.is_ranked ? ", ranked" : ""})
          </span>
        </>
      );
    }
    case "like": {
      const p = item.payload;
      return (
        <>
          liked a review of{" "}
          <Link
            href={`/reviews/${p.review_slug}`}
            className="text-[#e8e6e3] font-medium hover:text-accent-primary transition-colors"
          >
            {p.review_title}
          </Link>{" "}
          by {p.review_artist}
        </>
      );
    }
  }
}

/** Inline colored rating badge, e.g. " — 10.0". */
function RatingChip({ rating }: { rating: number }) {
  return (
    <span
      className="ml-1.5 inline-flex items-center px-1.5 rounded font-[family-name:var(--font-heading)] font-bold text-xs align-middle"
      style={{
        color: getRatingColor(rating),
        border: `1px solid ${getRatingColor(rating)}55`,
        background: `${getRatingColor(rating)}12`,
      }}
    >
      {formatRating(rating)}
    </span>
  );
}

/* ============================================
   "Find people" suggestion card (empty-feed helper)
   ============================================ */

function SuggestionCard({ profile }: { profile: SuggestedProfile }) {
  const name = profile.display_name || profile.username;
  const avatar = safeImage(profile.avatar_url);

  return (
    <Link
      href={`/profile/${profile.username}`}
      className="card-y2k p-3 flex items-center gap-3"
    >
      <span className="w-10 h-10 rounded-full overflow-hidden bg-bg-elevated border border-[rgba(255,255,255,0.15)] flex items-center justify-center shrink-0">
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span className="text-sm text-[#9a9a9e] font-bold">
            {name[0]?.toUpperCase()}
          </span>
        )}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-bold text-[#e8e6e3] truncate">
          {name}
        </span>
        <span className="block font-[family-name:var(--font-vt323)] text-xs text-[#5a5a60] truncate">
          @{profile.username}
        </span>
      </span>
    </Link>
  );
}
