/**
 * ProfileStats — the four numbers a profile leads with, Instagram
 * style, right under the name (Luca's idea, 2026-09-12):
 *
 *   FOLLOWERS · FOLLOWING · REVIEWS · LIKES
 *
 * REVIEWS and LIKES wear the trophy colours (lib/badges.ts: tier 9 =
 * the purple ELITE, tier 10 = the glowing PERFECT blue — the same
 * ladder the rating badges climb), with a thin progress bar toward
 * the next tier and "7 to 25" under the number, so the next trophy
 * is always in sight. Followers / following sit in the theme accent.
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
}: {
  stats: Stats;
  accentColor: string;
  isOwnProfile: boolean;
  hidden: string[] | null;
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
    <div className="stats-strip" aria-label={t("aria")}>
      {tiles.map((tile) => {
        const glow = tile.tier?.perfect
          ? " stat-glow-perfect"
          : tile.tier?.elite
            ? " stat-glow-elite"
            : "";
        const inner = (
          <>
            <p
              className={`stat-number${glow}`}
              style={{ color: tile.color }}
              title={String(tile.value)}
            >
              {tile.glyph && <span className="stat-glyph">{tile.glyph}</span>}
              {compactCount(tile.value)}
            </p>
            <p className="stat-label">{tile.label}</p>
            {tile.tier && (
              <span className="stat-progress" aria-hidden="true">
                <span
                  className="stat-progress-fill"
                  style={{
                    width: `${Math.round(tile.tier.progress * 100)}%`,
                    background: tile.tier.color,
                  }}
                />
              </span>
            )}
            {tile.tier && (
              <p className="stat-next">
                {tile.tier.nextAt === null
                  ? t("topTier")
                  : t("toNext", { n: tile.tier.toNext ?? 0, target: tile.tier.nextAt })}
              </p>
            )}
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
          <div key={tile.key} className="stat-tile">
            {inner}
          </div>
        );
      })}
    </div>
  );
}
