import { createClient } from "@/lib/supabase/server";

/* ============================================
   Friends activity — data access layer

   Powers the /friends page: a merged, newest-first feed of what the
   people YOU follow have been doing (diary logs, reviews, lists,
   likes), plus a "popular with friends" rail of the releases they've
   been spinning most in the last 30 days.

   Everything runs server-side through the cookie-aware Supabase
   client, so RLS applies: private lists and unpublished reviews are
   filtered both by our explicit .eq() checks AND by the database
   policies (belt and suspenders).
   ============================================ */

/* --- Shapes returned to the UI --- */

/** Who did the thing — enough to render an avatar + profile link. */
export interface ActivityActor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/** "luca logged House Of Balloons — 10.0" */
export interface DiaryActivityPayload {
  title: string;
  artist: string;
  cover_image: string | null;
  rating: number | null;
  is_relisten: boolean;
}

/** "luca reviewed DAMN. — 9.5" (links to /reviews/[slug]) */
export interface ReviewActivityPayload {
  slug: string;
  title: string;
  artist: string;
  rating: number;
  cover_image: string | null;
}

/** "luca made a list: 3am driving music" (links to /lists/[user]/[slug]) */
export interface ListActivityPayload {
  slug: string;
  title: string;
  is_ranked: boolean;
  item_count: number;
}

/** "luca liked a review of DAMN." (links to the liked review) */
export interface LikeActivityPayload {
  review_slug: string;
  review_title: string;
  review_artist: string;
}

/**
 * One row in the merged feed. A discriminated union on `type` so the
 * renderer can switch() and TypeScript knows exactly which payload
 * shape it's holding in each branch.
 */
export type ActivityItem =
  | { type: "diary"; created_at: string; actor: ActivityActor; payload: DiaryActivityPayload }
  | { type: "review"; created_at: string; actor: ActivityActor; payload: ReviewActivityPayload }
  | { type: "list"; created_at: string; actor: ActivityActor; payload: ListActivityPayload }
  | { type: "like"; created_at: string; actor: ActivityActor; payload: LikeActivityPayload };

/** One tile in the "Popular with friends" rail. */
export interface PopularItem {
  title: string;
  artist: string;
  cover_image: string | null;
  /** How many friend logs + reviews it got in the last 30 days. */
  count: number;
  /** Average of whatever ratings those carried (null if none rated). */
  avg_rating: number | null;
}

/* --- Internal helpers --- */

/**
 * Supabase types joined rows loosely (sometimes an object, sometimes
 * a one-element array), so we describe the raw shapes ourselves and
 * unwrap with this helper — same pattern as lib/db/lists.ts.
 */
type JoinedProfile = ActivityActor | ActivityActor[] | null;

function unwrapActor(profiles: JoinedProfile): ActivityActor {
  const p = Array.isArray(profiles) ? profiles[0] : profiles;
  return {
    username: p?.username ?? "",
    display_name: p?.display_name ?? null,
    avatar_url: p?.avatar_url ?? null,
  };
}

/** IDs of everyone the viewer follows. Empty array = follows nobody. */
async function getFollowedIds(viewerId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", viewerId);

  if (error || !data) return [];
  return (data as { following_id: string }[]).map((r) => r.following_id);
}

/* --- Raw row shapes for the four feed queries --- */

interface RawDiaryRow {
  title: string;
  artist: string;
  cover_image: string | null;
  rating: number | null;
  is_relisten: boolean;
  created_at: string;
  profiles: JoinedProfile;
}

interface RawReviewRow {
  slug: string;
  title: string;
  artist: string;
  rating: number;
  cover_image: string | null;
  created_at: string;
  profiles: JoinedProfile;
}

interface RawListRow {
  slug: string;
  title: string;
  is_ranked: boolean;
  created_at: string;
  profiles: JoinedProfile;
  list_items: { count: number }[] | null;
}

interface RawLikeRow {
  created_at: string;
  profiles: JoinedProfile;
  reviews:
    | { slug: string; title: string; artist: string }
    | { slug: string; title: string; artist: string }[]
    | null;
}

/* --- The feed --- */

/**
 * Everything the viewer's friends have done recently, merged into one
 * newest-first array capped at `limit` items.
 *
 * Strategy: fetch the follow list once, then run the four source
 * queries IN PARALLEL (each already capped at `limit`, since the
 * merged feed can never need more than `limit` from any one source),
 * then merge + sort + slice in JS. Four small indexed queries beat
 * one giant UNION view for a hobby-scale site, and it keeps each
 * source's join simple.
 */
export async function getFriendActivity(
  viewerId: string,
  options?: { limit?: number }
): Promise<ActivityItem[]> {
  const limit = options?.limit ?? 40;

  const followedIds = await getFollowedIds(viewerId);
  if (followedIds.length === 0) return []; // follows nobody yet

  const supabase = await createClient();

  // The actor join is identical for all four queries.
  const ACTOR = "profiles!inner(username, display_name, avatar_url)";

  const [diaryRes, reviewsRes, listsRes, likesRes] = await Promise.all([
    // 1. Diary logs by friends
    supabase
      .from("diary_entries")
      .select(`title, artist, cover_image, rating, is_relisten, created_at, ${ACTOR}`)
      .in("user_id", followedIds)
      .order("created_at", { ascending: false })
      .limit(limit),

    // 2. Published reviews by friends
    supabase
      .from("reviews")
      .select(`slug, title, artist, rating, cover_image, created_at, ${ACTOR}`)
      .in("user_id", followedIds)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(limit),

    // 3. Public lists created by friends (with an item count for flavor)
    supabase
      .from("lists")
      .select(`slug, title, is_ranked, created_at, ${ACTOR}, list_items(count)`)
      .in("user_id", followedIds)
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit),

    // 4. Review likes by friends — join the liked review for its title/link
    supabase
      .from("review_likes")
      .select(`created_at, ${ACTOR}, reviews!inner(slug, title, artist)`)
      .in("user_id", followedIds)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  const items: ActivityItem[] = [];

  // --- Normalize each source into typed ActivityItems ---

  for (const row of (diaryRes.data ?? []) as unknown as RawDiaryRow[]) {
    items.push({
      type: "diary",
      created_at: row.created_at,
      actor: unwrapActor(row.profiles),
      payload: {
        title: row.title,
        artist: row.artist,
        cover_image: row.cover_image,
        rating: row.rating === null ? null : Number(row.rating),
        is_relisten: row.is_relisten,
      },
    });
  }

  for (const row of (reviewsRes.data ?? []) as unknown as RawReviewRow[]) {
    items.push({
      type: "review",
      created_at: row.created_at,
      actor: unwrapActor(row.profiles),
      payload: {
        slug: row.slug,
        title: row.title,
        artist: row.artist,
        rating: Number(row.rating),
        cover_image: row.cover_image,
      },
    });
  }

  for (const row of (listsRes.data ?? []) as unknown as RawListRow[]) {
    items.push({
      type: "list",
      created_at: row.created_at,
      actor: unwrapActor(row.profiles),
      payload: {
        slug: row.slug,
        title: row.title,
        is_ranked: row.is_ranked,
        // list_items(count) comes back as [{ count: n }]
        item_count: Array.isArray(row.list_items)
          ? row.list_items[0]?.count ?? 0
          : 0,
      },
    });
  }

  for (const row of (likesRes.data ?? []) as unknown as RawLikeRow[]) {
    // The joined review may arrive as an object or one-element array.
    const review = Array.isArray(row.reviews) ? row.reviews[0] : row.reviews;
    if (!review) continue; // review was deleted between queries — skip
    items.push({
      type: "like",
      created_at: row.created_at,
      actor: unwrapActor(row.profiles),
      payload: {
        review_slug: review.slug,
        review_title: review.title,
        review_artist: review.artist,
      },
    });
  }

  // Merge: newest first (ISO timestamps compare correctly as strings),
  // then cap at the requested size.
  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return items.slice(0, limit);
}

/* --- Popular with friends --- */

/**
 * The releases your friends have logged + reviewed most in the last
 * 30 days, grouped by (title, artist) case-insensitively, with a
 * count and average rating for the chip on each poster.
 *
 * Grouping happens in JS because the "release" may be free-text (no
 * release_id), so title+artist is the only reliable group key.
 */
export async function getPopularWithFriends(
  viewerId: string,
  options?: { limit?: number }
): Promise<PopularItem[]> {
  const limit = options?.limit ?? 6;

  const followedIds = await getFollowedIds(viewerId);
  if (followedIds.length === 0) return [];

  const supabase = await createClient();

  // 30 days back from now, as an ISO timestamp for the .gte() filters.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Pull recent diary logs and reviews by friends, in parallel.
  // 300 rows per source is far more than a friend group produces in a
  // month, while still bounding the query.
  const [diaryRes, reviewsRes] = await Promise.all([
    supabase
      .from("diary_entries")
      .select("title, artist, cover_image, rating")
      .in("user_id", followedIds)
      .gte("created_at", since)
      .limit(300),
    supabase
      .from("reviews")
      .select("title, artist, cover_image, rating")
      .in("user_id", followedIds)
      .eq("is_published", true)
      .gte("created_at", since)
      .limit(300),
  ]);

  interface SourceRow {
    title: string;
    artist: string;
    cover_image: string | null;
    rating: number | null;
  }

  const rows: SourceRow[] = [
    ...((diaryRes.data ?? []) as SourceRow[]),
    ...((reviewsRes.data ?? []) as SourceRow[]),
  ];

  // Group by lowercase "title|artist" so "Damn" and "DAMN." by the
  // same artist still merge when the casing differs.
  interface Group {
    title: string;
    artist: string;
    cover_image: string | null;
    count: number;
    ratingSum: number;
    ratingCount: number;
  }
  const groups = new Map<string, Group>();

  for (const row of rows) {
    const key = `${row.title.trim().toLowerCase()}|${row.artist.trim().toLowerCase()}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        title: row.title,
        artist: row.artist,
        cover_image: null,
        count: 0,
        ratingSum: 0,
        ratingCount: 0,
      };
      groups.set(key, group);
    }
    group.count += 1;
    // Keep the first cover we see (any is fine — same release).
    if (!group.cover_image && row.cover_image) {
      group.cover_image = row.cover_image;
    }
    if (row.rating !== null && row.rating !== undefined) {
      group.ratingSum += Number(row.rating);
      group.ratingCount += 1;
    }
  }

  // Most-logged first; average rating breaks ties.
  return Array.from(groups.values())
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      const avgA = a.ratingCount ? a.ratingSum / a.ratingCount : 0;
      const avgB = b.ratingCount ? b.ratingSum / b.ratingCount : 0;
      return avgB - avgA;
    })
    .slice(0, limit)
    .map((g) => ({
      title: g.title,
      artist: g.artist,
      cover_image: g.cover_image,
      count: g.count,
      // One decimal, matching the site's 1–10.0 rating convention.
      avg_rating: g.ratingCount
        ? Math.round((g.ratingSum / g.ratingCount) * 10) / 10
        : null,
    }));
}

/* --- Find friends --- */

/** A lightweight profile row for the "people to follow" suggestions. */
export interface SuggestedProfile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

/**
 * A few profiles the viewer ISN'T following yet (newest members
 * first) — shown on /friends when the feed is empty so a brand-new
 * account has somewhere to start.
 */
export async function getSuggestedProfiles(
  viewerId: string,
  options?: { limit?: number }
): Promise<SuggestedProfile[]> {
  const limit = options?.limit ?? 6;
  const supabase = await createClient();

  const followedIds = await getFollowedIds(viewerId);
  // Exclude yourself and everyone you already follow.
  const excluded = [viewerId, ...followedIds];

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url")
    .not("id", "in", `(${excluded.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as SuggestedProfile[];
}
