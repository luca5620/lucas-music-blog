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
 *
 * ONE PERSON PER TILE FIRST (2026-10-05). Newest-first alone meant
 * one heavy rater's backfill session filled ~20 of 23 tiles, and a
 * "community" wall that is one person reads as a dead site. Now it's
 * picked in rounds: everybody's newest record first, then everybody's
 * second-newest, and so on — still one tile per record, still capped
 * at TILE_CAP. With few reviewers the rounds just fill from the same
 * people, so the wall never comes up short.
 *
 * Variety needs a deeper look back than the old 60 rows, so the wall
 * has its own SLIM cached query (getWallReviews below): only the
 * columns a tile draws — not the full review rows the home feed pulls,
 * whose essays would make 200 rows too heavy for the data cache.
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { unstable_cache } from "next/cache";
import { publicClient } from "@/lib/supabase/public";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
import { smallCover } from "@/lib/images";
import { getRatingHex, formatRating } from "@/lib/rating";
import HomeSection from "./HomeSection";

const TILE_CAP = 24;
/** How many recent reviews to deal the wall from — deep enough that a
    single 50-record backfill session can't be the whole window. */
const FEED_WINDOW = 200;
/** Most tiles one person gets while others are on the wall… */
const MAX_ROUNDS = 4;
/** …unless the wall would be shorter than this (the marquee pads
    anything under 8 by repeating, which looks emptier still). */
const MIN_TILES = 12;

/** Exactly what one tile draws — nothing more. */
interface WallReview {
  id: string;
  slug: string;
  title: string;
  artist: string;
  rating: number;
  cover_image: string | null;
  user_id: string;
  profiles: { username: string; display_name: string | null; avatar_url: string | null };
}

/* CACHED (2 min, same window as the home feed) with the cookie-less
   publicClient() — the wall is identical for every visitor, and the
   standing rule is that nothing inside unstable_cache may touch
   lib/supabase/server.ts. The viewer's blocks are applied AFTER, per
   request. !inner on profiles drops reviews whose author is gone. */
const getWallReviews = unstable_cache(
  async (): Promise<WallReview[]> => {
    const { data, error } = await publicClient()
      .from("reviews")
      .select(
        "id, slug, title, artist, rating, cover_image, user_id, profiles!reviews_user_id_fkey!inner(username, display_name, avatar_url)"
      )
      .eq("is_published", true)
      .not("cover_image", "is", null)
      .order("created_at", { ascending: false })
      .limit(FEED_WINDOW);
    if (error || !data) return [];
    return data as unknown as WallReview[];
  },
  ["rated-wall"],
  { revalidate: 120 }
);

export default async function RatedWall() {
  // LANGUAGES: the section copy + the tile's hover/alt text. Titles,
  // artists and names inside them are data and stay as they are.
  const t = await getTranslations("home.community");
  const [raw, blocked] = await Promise.all([
    getWallReviews().catch(() => [] as WallReview[]),
    getViewerBlockedIdSet(),
  ]);

  // Step 1 — each reviewer's usable reviews, newest first (the feed
  // already arrives newest-first, so pushing in order keeps that).
  // Covers only; blocked authors never appear.
  const byUser = new Map<string, WallReview[]>();
  for (const r of raw) {
    if (blocked.has(r.user_id) || !r.cover_image) continue;
    const list = byUser.get(r.user_id);
    if (list) list.push(r);
    else byUser.set(r.user_id, [r]);
  }

  // Step 2 — deal them out in rounds. Round 0 takes every reviewer's
  // newest, round 1 their second-newest, … Within a round, reviewers
  // are ordered by how recently they last rated (Map insertion order
  // = the order their newest review appeared), so the wall still
  // leads with what's fresh. One tile per RECORD throughout: a record
  // someone else already put on the wall is skipped.
  //
  // Rounds alone still let the one prolific rater fill every slot the
  // others run out of, so the rounds stop at MAX_ROUNDS tiles per
  // person — UNLESS that leaves the wall shorter than MIN_TILES, in
  // which case the dealing carries on so the row stays full.
  const seen = new Set<string>();
  const tiles: WallReview[] = [];
  const queues = [...byUser.values()];
  for (let round = 0; tiles.length < TILE_CAP; round++) {
    if (round >= MAX_ROUNDS && tiles.length >= MIN_TILES) break;
    let dealt = false;
    for (const queue of queues) {
      const r = queue[round];
      if (!r) continue;
      dealt = true;
      const key = `${r.title}::${r.artist}`.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tiles.push(r);
      if (tiles.length >= TILE_CAP) break;
    }
    if (!dealt) break; // every queue is empty — nothing left to show
  }
  if (tiles.length === 0) return null;

  // Under ~8 tiles the loop would show the same covers twice on a wide
  // screen — pad the track by repeating so the seam still lines up.
  const track = tiles.length < 8 ? [...tiles, ...tiles] : tiles;

  const Tile = ({ r, i }: { r: WallReview; i: number }) => {
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
