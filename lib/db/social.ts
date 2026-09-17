import { createClient } from "@/lib/supabase/server";
import { lastFridayEasternUtcMs } from "@/lib/upcoming";
import type { Profile } from "@/lib/types/database";

/**
 * Social page data (Luca 2026-08-31 — the Friends tab became
 * "Social" and gained two discovery modules):
 *
 *  - Top Rooms: the most recently active live rooms; the LIVE
 *    head-counts come from realtime presence, which only a browser
 *    can observe — so the server hands candidates to the TopRooms
 *    client component and IT sorts by who's actually there.
 *  - Top Reviews This Week: most review-likes RECEIVED since the
 *    last Friday-midnight-Eastern reset. Deliberately age-blind: an
 *    old review that catches fire this week tops the chart — that's
 *    the point (resurfacing the back catalog).
 */

export interface ActiveRoomCandidate {
  roomId: string;
  releaseSlug: string;
  title: string;
  artistName: string;
  coverImage: string | null;
  lastActivityAt: string | null;
}

/**
 * Recently active rooms, newest activity first — the candidate set
 * the client ranks by live presence. More candidates than the UI
 * shows (12 vs 6) so a quiet-but-recent room can be outranked by an
 * older room that's full of people right now.
 */
export async function getActiveRooms(
  limit = 12
): Promise<ActiveRoomCandidate[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("release_rooms")
    .select(
      "id, last_activity_at, releases(slug, title, cover_image, artists!releases_primary_artist_id_fkey(name))"
    )
    .not("last_activity_at", "is", null)
    .order("last_activity_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type Row = {
    id: string;
    last_activity_at: string | null;
    releases: {
      slug: string;
      title: string;
      cover_image: string | null;
      artists: { name: string } | { name: string }[] | null;
    } | null;
  };

  return (data as unknown as Row[])
    .filter((r) => r.releases)
    .map((r) => {
      const artist = Array.isArray(r.releases!.artists)
        ? r.releases!.artists[0]
        : r.releases!.artists;
      return {
        roomId: r.id,
        releaseSlug: r.releases!.slug,
        title: r.releases!.title,
        artistName: artist?.name ?? "",
        coverImage: r.releases!.cover_image,
        lastActivityAt: r.last_activity_at,
      };
    });
}

export interface TopWeekReview {
  id: string;
  slug: string;
  title: string;
  artist: string;
  rating: number;
  cover_image: string | null;
  user_id: string;
  /** Likes received since the Friday reset — the ranking signal. */
  week_likes: number;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: "user" | "reviewer" | "admin" | "owner" | "tester";
  } | null;
}

/**
 * The week's most-liked reviews (likes RECEIVED since last Friday
 * 00:00 ET, live — no materialized anything at this scale).
 */
export async function getTopReviewsThisWeek(
  limit = 10
): Promise<TopWeekReview[]> {
  const supabase = await createClient();
  const cutoff = new Date(lastFridayEasternUtcMs()).toISOString();

  // Every like this week (id only). 10k cap = far beyond current
  // scale; revisit with a SQL group-by RPC if the site blows up.
  const { data: likeRows, error } = await supabase
    .from("review_likes")
    .select("review_id")
    .gte("created_at", cutoff)
    .limit(10_000);

  if (error || !likeRows || likeRows.length === 0) return [];

  const counts = new Map<string, number>();
  for (const row of likeRows as { review_id: string }[]) {
    counts.set(row.review_id, (counts.get(row.review_id) ?? 0) + 1);
  }

  const topIds = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);

  const { data: reviews, error: reviewError } = await supabase
    .from("reviews")
    .select(
      "id, slug, title, artist, rating, cover_image, user_id, profiles(username, display_name, avatar_url, role)"
    )
    .in("id", topIds)
    .eq("is_published", true);

  if (reviewError || !reviews) return [];

  return (reviews as unknown as Omit<TopWeekReview, "week_likes">[])
    .map((r) => ({ ...r, week_likes: counts.get(r.id) ?? 0 }))
    .sort((a, b) => b.week_likes - a.week_likes);
}

/* ------------------------------------------------------------------ */
/*  YOUR FRIENDS THIS WEEK (migration 049)                             */
/* ------------------------------------------------------------------ */

/** The three little charts on /social. */
export type WeekMetric = "aux" | "reviews" | "likes";

export interface WeekLeader {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Profile["role"];
  score: number;
}

/** One entry per metric, each already ordered and capped. */
export type WeekLeaders = Record<WeekMetric, WeekLeader[]>;

const EMPTY_WEEK_LEADERS: WeekLeaders = { aux: [], reviews: [], likes: [] };

/**
 * Top few people in the viewer's circle (themselves + everyone they
 * follow) this week, on three counts: Aux Wars won, reviews written,
 * likes received.
 *
 * `since` is passed in rather than decided in SQL so the whole page
 * agrees on one "this week" — the same Friday-00:00-Eastern reset the
 * Top Reviews chart above it already uses. See migration 049.
 *
 * Returns empty lists when 049 hasn't been run, when the viewer
 * follows nobody, or on any error: this is a garnish on the page, and
 * it must never be the reason /social fails to render.
 */
export async function getWeekLeaders(
  since: number,
  perMetric = 3
): Promise<WeekLeaders> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("social_week_leaders", {
    p_since: new Date(since).toISOString(),
    p_limit: perMetric,
  } as never);

  if (error || !Array.isArray(data)) return EMPTY_WEEK_LEADERS;

  const out: WeekLeaders = { aux: [], reviews: [], likes: [] };
  for (const raw of data as (WeekLeader & { metric: string })[]) {
    const bucket = out[raw.metric as WeekMetric];
    // An unknown metric means the DB is ahead of this build — skip it
    // rather than throwing on a page that is mostly other things.
    if (!bucket) continue;
    bucket.push({
      user_id: raw.user_id,
      username: raw.username,
      display_name: raw.display_name,
      avatar_url: raw.avatar_url,
      role: raw.role,
      score: raw.score,
    });
  }
  return out;
}
