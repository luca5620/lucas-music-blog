/**
 * ProfileStats — the four numbers a profile leads with, Instagram
 * style, right under the name (Luca's idea, 2026-09-12):
 *
 *   FOLLOWERS · FOLLOWING · REVIEWS · LIKES
 *
 * REVIEWS and LIKES wear the trophy colours (lib/badges.ts: tier 9 =
 * the purple ELITE, tier 10 = the glowing PERFECT blue — the same
 * ladder the rating badges climb). How close you are to the next
 * colour shows on hover only (Luca 2026-09-12: no progress lines
 * under the numbers). Followers / following sit in the theme accent.
 *
 * Replaces the old three-number row under the bio AND the three
 * headline numbers of the RATING OVERVIEW block (that block keeps the
 * average + histogram). The hover card (components/ui/UserLink.tsx)
 * shows the same four numbers, same colours, on any username.
 *
 * Privacy by design: follower/following are clickable ONLY on your
 * own profile (they link to the private /connections page) —
 * visitors just see numbers, never lists. A member who hid the
 * "reviews"/"likes" trophies in Settings still shows the count (it
 * was always public) but in plain accent, without the trophy colour
 * or the progress line.
 *
 * Server component: no state, just markup — the numbers arrive from
 * the page's one stats query.
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { hiddenBadgeSet, trophyTier } from "@/lib/badges";
import { HeartGlyph, TrophyGlyph } from "@/components/profile/BadgeGlyphs";
import { compactCount } from "@/lib/format-count";
import type { ProfileStats as Stats } from "@/lib/types/database";

export default async function ProfileStats({
  stats,
  accentColor,
  isOwnProfile,
  hidden,
  compact = false,
  className = "",
}: {
  stats: Stats;
  accentColor: string;
  isOwnProfile: boolean;
  hidden: string[] | null;
  /** The app's header slot beside the handle: smaller numbers, no
      progress lines (Luca 2026-09-12: it has to fit on the screen). */
  compact?: boolean;
  className?: string;
}) {
  const t = await getTranslations("profile.stats");
  const hiddenSet = hiddenBadgeSet(hidden);
  const reviews = trophyTier(stats.review_count);
  const likes = trophyTier(stats.total_likes_received);

  const tiles = [
    {
      key: "followers",
      label: t("followers"),
      value: stats.follower_count,
      color: accentColor,
      link: isOwnProfile,
      glyph: null,
      tier: null,
    },
    {
      key: "following",
      label: t("following"),
      value: stats.following_count,
      color: accentColor,
      link: isOwnProfile,
      glyph: null,
      tier: null,
    },
    {
      key: "reviews",
      label: t("reviews"),
      value: stats.review_count,
      color: hiddenSet.has("reviews") ? accentColor : reviews.color,
      link: false,
      glyph: hiddenSet.has("reviews") ? null : <TrophyGlyph className="w-4 h-4" />,
      tier: hiddenSet.has("reviews") ? null : reviews,
    },
    {
      key: "likes",
      label: t("likes"),
      value: stats.total_likes_received,
      color: hiddenSet.has("likes") ? accentColor : likes.color,
      link: false,
      glyph: hiddenSet.has("likes") ? null : <HeartGlyph className="w-4 h-4" />,
      tier: hiddenSet.has("likes") ? null : likes,
    },
  ];

  return (
    <div
      className={`stats-strip${compact ? " stats-strip-compact" : ""} ${className}`}
      aria-label={t("aria")}
    >
      {tiles.map((tile) => {
        const glow = tile.tier?.perfect
          ? " stat-glow-perfect"
          : tile.tier?.elite
            ? " stat-glow-elite"
            : "";
        // Hover: the exact count, or for the trophies how close the
        // next colour is (the tier ladder is the reward, not a bar).
        const hint = tile.tier
          ? tile.tier.nextAt === null
            ? t("topTier")
            : t("nextHint", { n: tile.tier.toNext ?? 0, target: tile.tier.nextAt })
          : String(tile.value);
        const inner = (
          <>
            <p className={`stat-number${glow}`} style={{ color: tile.color }}>
              {tile.glyph && <span className="stat-glyph">{tile.glyph}</span>}
              {compactCount(tile.value)}
            </p>
            <p className="stat-label">{tile.label}</p>
          </>
        );
        return tile.link ? (
          <Link
            key={tile.key}
            href="/connections"
            className="stat-tile stat-tile-link"
            title={t("viewConnections")}
          >
            {inner}
          </Link>
        ) : (
          <div key={tile.key} className="stat-tile" title={hint}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
