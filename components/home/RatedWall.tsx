/**
 * RatedWall — "What the community rated": one row of album covers
 * that drifts past on its own (Luca 2026-09-02, after Resonate's
 * cover carousel). One tile per RECORD — the first verdict shown —
 * so the row is wide, not repetitive. Each tile carries exactly two
 * things over the art: the reviewer's avatar bottom-left, the rating
 * bottom-right. Nothing else covers the cover.
 *
 * All published reviews feed it (no "this week" filter — Luca: until
 * there's volume, just show what the community rated). The row is
 * duplicated once so the CSS marquee loops seamlessly; it pauses on
 * hover and falls back to a plain horizontal scroll under
 * prefers-reduced-motion (see WALL MARQUEE in globals.css).
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getDiscoveryFeed } from "@/lib/db/reviews";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
import { smallCover } from "@/lib/images";
import { getRatingHex, formatRating } from "@/lib/rating";
import type { FeedReview } from "@/components/reviews/DiscoveryFeedClient";
import HomeSection from "./HomeSection";

const TILE_CAP = 24;

export default async function RatedWall() {
  // LANGUAGES: the section copy + the tile's hover/alt text. Titles,
  // artists and names inside them are data and stay as they are.
  const t = await getTranslations("home.community");
  const [raw, blocked] = await Promise.all([
    getDiscoveryFeed(60) as unknown as Promise<FeedReview[]>,
    getViewerBlockedIdSet(),
  ]);

  // One tile per record, covers only.
  const seen = new Set<string>();
  const tiles: FeedReview[] = [];
  for (const r of raw) {
    if (blocked.has(r.user_id) || !r.cover_image) continue;
    const key = `${r.title}::${r.artist}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tiles.push(r);
    if (tiles.length >= TILE_CAP) break;
  }
  if (tiles.length === 0) return null;

  // Under ~8 tiles the loop would show the same covers twice on a wide
  // screen — pad the track by repeating so the seam still lines up.
  const track = tiles.length < 8 ? [...tiles, ...tiles] : tiles;

  const Tile = ({ r, i }: { r: FeedReview; i: number }) => {
    const p = r.profiles;
    const color = getRatingHex(r.rating);
    return (
      <Link
        href={`/reviews/${r.slug}`}
        className="wall-tile poster"
        title={t("tileTitle", {
          title: r.title,
          artist: r.artist,
          rating: formatRating(r.rating),
          name: p.display_name || p.username,
        })}
        tabIndex={i === 0 ? 0 : -1}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={smallCover(r.cover_image!)}
          alt={t("coverAlt", { title: r.title })}
          loading="lazy"
          decoding="async"
          draggable={false}
        />
        {/* Reviewer — avatar only, bottom-left. Size is INLINE on
            purpose: `.poster img { width:100%; height:100% }` in
            globals.css outranks a w-6 utility, which is how the
            avatar ended up covering the artwork (Luca 2026-09-02). */}
        {p.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.avatar_url}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ width: 22, height: 22 }}
            className="absolute bottom-1.5 left-1.5 rounded-full object-cover border border-white/50 shadow-[0_1px_6px_rgba(0,0,0,0.8)]"
          />
        ) : (
          <span
            style={{ width: 22, height: 22 }}
            className="absolute bottom-1.5 left-1.5 rounded-full bg-black/70 border border-white/50 inline-flex items-center justify-center text-[10px] font-bold text-accent-primary uppercase shadow-[0_1px_6px_rgba(0,0,0,0.8)]"
          >
            {(p.username || "U")[0]}
          </span>
        )}
        {/* The number — bottom-right */}
        <span className="poster-rating" style={{ color, borderColor: `${color}80` }}>
          {formatRating(r.rating)}
        </span>
      </Link>
    );
  };

  return (
    <HomeSection
      eyebrow={t("eyebrow")}
      title={t("title")}
      sub={t("sub")}
      aside={
        <Link
          href="/reviews"
          className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors"
        >
          {t("allReviews")}
        </Link>
      }
    >
      {/* Full-bleed row: breaks out of the page padding so the covers
          run edge to edge like a ticker. */}
      <div className="wall -mx-4 sm:-mx-6 lg:-mx-8" aria-label={t("wallLabel")}>
        <div className="wall-track">
          {track.map((r, i) => (
            <Tile key={`a-${r.id}-${i}`} r={r} i={i} />
          ))}
          {/* Second copy for the seamless loop — hidden from readers */}
          <span aria-hidden="true" className="contents">
            {track.map((r, i) => (
              <Tile key={`b-${r.id}-${i}`} r={r} i={-1} />
            ))}
          </span>
        </div>
      </div>
    </HomeSection>
  );
}
