/**
 * ReleaseCard — one record in a grid (the artist page discography).
 *
 * OPEN TILE (Luca 2026-10-25, "improve the boxy flow"): it used to be a
 * panel-xbox card with its own border, glow and scan bar, so a
 * discography read as a wall of boxes. Now the cover IS the tile — a
 * square sleeve with a soft shadow — and the words sit under it on the
 * page: title, "ALBUM · 2011" (or the countdown), then the community
 * score and how many reviews it has. Hover lifts the cover a touch.
 */

import Link from "next/link";
import type { Release } from "@/lib/types/database";
import { getRatingHex, formatRating } from "@/lib/rating";
import { smallCover } from "@/lib/images";
import { daysUntil, isWaitingForDrop } from "@/lib/upcoming";
import LiveBadge from "@/components/rooms/LiveBadge";
import { useTranslations } from "next-intl";

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

  const t = useTranslations("releases.views");
  const tc = useTranslations("common");
  const hasRating = typeof avgRating === "number" && !Number.isNaN(avgRating);
  // Release day, but not out yet (a 5am ET K-pop drop, migration 064)
  // → "Later today", not "Tomorrow" (a few hours still rounds up to 1).
  const waiting = isWaitingForDrop(release.release_date, release);
  const days = waiting ? null : daysUntil(release.release_date, release);

  return (
    <Link href={`/releases/${release.slug}`} className="disc-tile group">
      {/* The sleeve */}
      <div className="disc-tile-cover">
        {release.cover_image ? (
          <img
            src={release.cover_image}
            // Browser picks: 300px file at grid sizes, 640 when the
            // tile spans a phone screen.
            srcSet={`${smallCover(release.cover_image)} 300w, ${release.cover_image} 640w`}
            sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw"
            alt={tc("coverAlt", { title: release.title })}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="disc-tile-blank">{"//"}</span>
        )}
        <span className="disc-tile-live">
          <LiveBadge lastActivityAt={lastActivityAt} />
        </span>
      </div>

      {/* Title, then type · year (or the countdown while it's still ahead) */}
      <div className="disc-tile-text">
        <h3>{release.title}</h3>
        {artistName &&
          (artistSlug ? (
            <span
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                window.location.href = `/artists/${artistSlug}`;
              }}
              className="disc-tile-artist hover:text-accent-primary cursor-pointer"
            >
              {artistName}
            </span>
          ) : (
            <span className="disc-tile-artist">{artistName}</span>
          ))}
        <p className="disc-tile-meta">
          {release.release_type}
          {days !== null ? (
            <b className="text-osd-amber"> · {days === 1 ? t("tomorrow") : t("dMinus", { n: days })}</b>
          ) : waiting ? (
            <b className="text-osd-amber"> · {t("laterToday")}</b>
          ) : (
            year && <> · {year}</>
          )}
        </p>

        {/* Community score + counts, only when there's something to say */}
        {(hasRating || (followerCount ?? 0) > 0) && (
          <p className="disc-tile-score">
            {hasRating && <b style={{ color: getRatingHex(avgRating!) }}>{formatRating(avgRating!)}</b>}
            {(reviewCount ?? 0) > 0 && <span>{t("reviews", { n: reviewCount! })}</span>}
            {(followerCount ?? 0) > 0 && <span>{t("followers", { n: followerCount! })}</span>}
          </p>
        )}
      </div>
    </Link>
  );
}
