/**
 * RatedThisWeek — the cover wall on the logged-out home (Luca
 * 2026-09-02, borrowed from Resonate's "Rated this week"): a dense
 * grid of album covers people rated in the last 7 days, each carrying
 * the reviewer's avatar and the rating badge. One tile per RECORD —
 * a hot album rated by five people shows once, with the first
 * verdict — so the wall is wide, not repetitive.
 *
 * Reuses getDiscoveryFeed (latest published reviews). When the week
 * is thin (under 6 records) it widens to "recently rated" so the
 * wall never looks empty to a first-time visitor.
 */

import Link from "next/link";
import { getDiscoveryFeed } from "@/lib/db/reviews";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
import { smallCover } from "@/lib/images";
import { getRatingHex, formatRating } from "@/lib/rating";
import type { FeedReview } from "@/components/reviews/DiscoveryFeedClient";
import HomeSection from "./HomeSection";
import Reveal from "./Reveal";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const TILE_CAP = 18;

export default async function RatedThisWeek() {
  const [raw, blocked] = await Promise.all([
    getDiscoveryFeed(48) as unknown as Promise<FeedReview[]>,
    getViewerBlockedIdSet(),
  ]);
  const all = raw.filter((r) => !blocked.has(r.user_id) && r.cover_image);

  // eslint-disable-next-line react-hooks/purity -- server render, read once per request
  const cutoff = Date.now() - WEEK_MS;
  const inWeek = all.filter((r) => new Date(r.created_at).getTime() > cutoff);
  const thisWeek = inWeek.length >= 6;
  const pool = thisWeek ? inWeek : all;

  // One tile per record.
  const seen = new Set<string>();
  const tiles: FeedReview[] = [];
  for (const r of pool) {
    const key = `${r.title}::${r.artist}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tiles.push(r);
    if (tiles.length >= TILE_CAP) break;
  }
  if (tiles.length === 0) return null;

  return (
    <HomeSection
      eyebrow={thisWeek ? "Rated this week" : "Recently rated"}
      title={thisWeek ? "What the community rated this week" : "What the community is rating"}
      sub="Real verdicts from real people, one tile per record. Tap a cover to read the take."
      aside={
        <Link
          href="/reviews"
          className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors"
        >
          all reviews →
        </Link>
      }
    >
      <div className="poster-grid">
        {tiles.map((r, i) => {
          const p = r.profiles;
          const color = getRatingHex(r.rating);
          return (
            <Reveal key={r.id} delay={Math.min(i, 8) * 45}>
              <Link
                href={`/reviews/${r.slug}`}
                className="poster group block"
                title={`${r.title} — ${r.artist}, rated ${formatRating(r.rating)} by ${p.display_name || p.username}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={smallCover(r.cover_image!)}
                  alt={`${r.title} cover`}
                  loading="lazy"
                  decoding="async"
                />
                {/* Reviewer chip — who said it */}
                <span className="absolute top-1.5 left-1.5 flex items-center gap-1 max-w-[calc(100%-12px)] rounded-full bg-black/70 border border-white/10 pl-0.5 pr-2 py-0.5 backdrop-blur-sm">
                  {p.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.avatar_url}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-4 h-4 rounded-full object-cover"
                    />
                  ) : (
                    <span className="w-4 h-4 rounded-full bg-accent-primary/30 inline-flex items-center justify-center text-[8px] font-bold text-accent-primary uppercase">
                      {(p.username || "U")[0]}
                    </span>
                  )}
                  <span className="text-[10px] text-text-primary truncate">
                    {p.display_name || p.username}
                  </span>
                </span>
                <span className="poster-rating" style={{ color, borderColor: `${color}66` }}>
                  {formatRating(r.rating)}
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </HomeSection>
  );
}
