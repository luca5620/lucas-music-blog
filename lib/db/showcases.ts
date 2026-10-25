/**
 * Data for the two AUTOMATIC profile showcases (Luca 2026-10-24,
 * showcases overhaul round 2 — "Taste match" + "Most loved songs").
 *
 * Neither one is picked in Settings: they fill themselves in from what
 * the member already does on the site (their reviews, their ♥ picks,
 * their song-by-song scores), so there's nothing to set up and no
 * migration. Both fail soft to "nothing" — a profile never breaks
 * because one of these queries did.
 */

import { createClient } from "@/lib/supabase/server";
import type { Review, ReleaseTrack } from "@/lib/types/database";

/* ============================================================
   TASTE MATCH — the visitor vs the profile owner
   ============================================================ */

export interface TasteMatch {
  /** 0–100. 100 = you gave every shared record the exact same score. */
  percent: number;
  /** How many records you've both reviewed. */
  common: number;
  /** The shared record you two agree on most (ties → the higher-rated
      one), for the one-liner under the %. */
  pick: { title: string; mine: number; theirs: number };
}

/** Fewer shared records than this and the % would be noise ("100%!"
    off one single), so the widget just doesn't show. */
const MIN_COMMON = 2;

/**
 * Compare the viewer's published ratings with the owner's, record by
 * record (matched on release_id, so two reviews of the same release
 * line up even if the titles were typed differently).
 *
 * The % is simple on purpose: 100 minus the average score gap × 10.
 * A one-point average gap = 90%, a three-point gap = 70%. Easy to
 * explain, and it moves the way people expect.
 */
export async function getTasteMatch(
  viewerId: string,
  ownerReviews: Pick<Review, "release_id" | "rating" | "title">[]
): Promise<TasteMatch | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("release_id, rating")
      .eq("user_id", viewerId)
      .eq("is_published", true)
      .not("release_id", "is", null);
    if (error || !data) return null;

    const mine = new Map<string, number>();
    for (const r of data as { release_id: string; rating: number | string }[]) {
      mine.set(r.release_id, Number(r.rating));
    }

    const shared: { title: string; mine: number; theirs: number; gap: number }[] = [];
    for (const r of ownerReviews) {
      if (!r.release_id || !mine.has(r.release_id)) continue;
      const m = mine.get(r.release_id)!;
      const theirs = Number(r.rating);
      shared.push({ title: r.title, mine: m, theirs, gap: Math.abs(m - theirs) });
    }
    if (shared.length < MIN_COMMON) return null;

    const avgGap = shared.reduce((s, x) => s + x.gap, 0) / shared.length;
    const percent = Math.max(0, Math.min(100, Math.round(100 - avgGap * 10)));
    // Closest agreement first; between equal gaps, the record you both
    // rated higher makes the nicer line ("you both gave X a 10").
    shared.sort((a, b) => a.gap - b.gap || b.mine + b.theirs - (a.mine + a.theirs));
    const { title, mine: m, theirs } = shared[0];
    return { percent, common: shared.length, pick: { title, mine: m, theirs } };
  } catch {
    return null;
  }
}

/* ============================================================
   MOST LOVED SONGS — ♥ picks first, then top song-by-song scores
   ============================================================ */

export interface LovedSong {
  key: string;
  title: string;
  artist: string;
  cover: string | null;
  /** Their review of the record when there is one, else the release page. */
  href: string;
  /** Their own song-by-song score, when they gave one. */
  score: number | null;
  /** ♥'d as a personal favourite in a review. */
  hearted: boolean;
}

/** How many rows the showcase shows. There's no "see all" page yet,
    so this is simply the top of the list. */
const LOVED_LIMIT = 5;
/** Song scores below this aren't "loved", they're just rated. */
const LOVED_MIN_SCORE = 8;

interface TrackRatingJoinRow {
  release_id: string;
  track_position: number;
  rating: number | string;
  releases:
    | { slug: string; title: string; artist: string; cover_image: string | null; tracks: ReleaseTrack[] | null }
    | { slug: string; title: string; artist: string; cover_image: string | null; tracks: ReleaseTrack[] | null }[]
    | null;
}

const norm = (s: string) => s.trim().toLowerCase();

export async function getMostLovedSongs(
  userId: string,
  reviews: Review[]
): Promise<LovedSong[]> {
  // Their song-by-song scores (track_ratings, migration 041), best
  // first. Public-read like the release page's. 60 rows is plenty to
  // find five loved songs; fails soft to "no scores".
  let rows: TrackRatingJoinRow[] = [];
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("track_ratings")
      .select("release_id, track_position, rating, releases(slug, title, artist, cover_image, tracks)")
      .eq("user_id", userId)
      .order("rating", { ascending: false })
      .limit(60);
    if (!error && data) rows = data as unknown as TrackRatingJoinRow[];
  } catch {
    rows = [];
  }

  // release_id → their review of it (for the link + the ♥ picks).
  const reviewByRelease = new Map<string, Review>();
  for (const r of reviews) if (r.release_id) reviewByRelease.set(r.release_id, r);

  // "release_id:song title" → their score for that song.
  const scoreOf = new Map<string, number>();
  const scored: LovedSong[] = [];
  for (const row of rows) {
    const rel = Array.isArray(row.releases) ? row.releases[0] : row.releases;
    if (!rel) continue;
    const track = (rel.tracks ?? []).find((t) => t.position === row.track_position);
    if (!track) continue;
    const score = Number(row.rating);
    const key = `${row.release_id}:${norm(track.title)}`;
    scoreOf.set(key, score);
    const review = reviewByRelease.get(row.release_id);
    scored.push({
      key,
      title: track.title,
      artist: rel.artist,
      cover: rel.cover_image ?? review?.cover_image ?? null,
      href: review ? `/reviews/${review.slug}` : `/releases/${rel.slug}`,
      score,
      hearted: false,
    });
  }

  // The ♥ picks (reviews.standout_tracks), from every review. Ordered
  // by the song's own score when they gave one, else the record's.
  const hearted: { song: LovedSong; order: number }[] = [];
  const seen = new Set<string>();
  for (const review of reviews) {
    for (const pick of review.standout_tracks ?? []) {
      if (!pick?.title) continue;
      const key = `${review.release_id ?? review.id}:${norm(pick.title)}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const score = scoreOf.get(key) ?? null;
      hearted.push({
        song: {
          key,
          title: pick.title,
          artist: review.artist,
          cover: review.cover_image,
          href: `/reviews/${review.slug}`,
          score,
          hearted: true,
        },
        order: score ?? Number(review.rating),
      });
    }
  }
  hearted.sort((a, b) => b.order - a.order);

  // Hearts first, then the best-scored songs that weren't hearted.
  const out: LovedSong[] = hearted.map((h) => h.song);
  for (const s of scored) {
    if (out.length >= LOVED_LIMIT) break;
    if (seen.has(s.key) || (s.score ?? 0) < LOVED_MIN_SCORE) continue;
    seen.add(s.key);
    out.push(s);
  }
  return out.slice(0, LOVED_LIMIT);
}
