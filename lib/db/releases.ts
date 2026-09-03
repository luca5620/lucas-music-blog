import { createClient } from "@/lib/supabase/server";
import {
  hasDropped,
  isDroppingSoonEligible,
  todayEastern,
} from "@/lib/upcoming";
import type {
  Profile,
  Release,
  ReleaseArtist,
  ReleaseStats,
} from "@/lib/types/database";

export async function getReleaseBySlug(slug: string): Promise<Release | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as Release;
}

export async function getReleaseById(id: string): Promise<Release | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Release;
}

export async function getReleaseBySpotifyId(
  spotifyId: string
): Promise<Release | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("*")
    .eq("spotify_id", spotifyId)
    .single();

  if (error || !data) return null;
  return data as Release;
}

/**
 * Reviews for a release, joined with profile data, sorted by rating desc
 * then created_at desc.
 */
export async function getReleaseReviews(releaseId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    // FK-qualified: reviews↔profiles has two relationships since 006
    // (author + featured_review_id) — unqualified embeds error out.
    .select(
      "*, profiles!reviews_user_id_fkey!inner(username, display_name, avatar_url, role)"
    )
    .eq("release_id", releaseId)
    .eq("is_published", true)
    .order("rating", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];
  return data;
}

export async function getReleaseFollowers(
  releaseId: string,
  limit = 12
): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("release_follows")
    .select("profiles!inner(*)")
    .eq("release_id", releaseId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type Row = { profiles: Profile | Profile[] | null };
  return (data as unknown as Row[])
    .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles))
    .filter((p): p is Profile => !!p);
}

export async function getReleaseStats(
  releaseId: string
): Promise<ReleaseStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_release_stats", {
    release_uuid: releaseId,
  } as never);

  if (error || !data) {
    return { follower_count: 0, review_count: 0, avg_rating: null };
  }

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { follower_count: 0, review_count: 0, avg_rating: null };
  }

  const r = row as {
    follower_count: number | null;
    review_count: number | null;
    avg_rating: number | string | null;
  };
  return {
    follower_count: r.follower_count ?? 0,
    review_count: r.review_count ?? 0,
    avg_rating:
      r.avg_rating === null || r.avg_rating === undefined
        ? null
        : typeof r.avg_rating === "string"
        ? Number(r.avg_rating)
        : r.avg_rating,
  };
}

export async function followRelease(
  userId: string,
  releaseId: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("release_follows")
    .upsert(
      { follower_id: userId, release_id: releaseId } as never,
      { onConflict: "follower_id,release_id", ignoreDuplicates: true }
    );
}

export async function unfollowRelease(
  userId: string,
  releaseId: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("release_follows")
    .delete()
    .eq("follower_id", userId)
    .eq("release_id", releaseId);
}

export async function isFollowingRelease(
  userId: string,
  releaseId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("release_follows")
    .select("id")
    .eq("follower_id", userId)
    .eq("release_id", releaseId)
    .single();

  return !!data;
}

/**
 * Search releases by title (case-insensitive). Returns rows with the
 * primary artist name joined in (`artists.name`).
 */
export async function searchReleases(query: string, limit = 10) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("*, artists!releases_primary_artist_id_fkey(name)")
    .ilike("title", `%${query}%`)
    .order("popularity", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];
  return data;
}

export async function upsertRelease(
  input: Omit<Release, "id" | "created_at" | "updated_at">
): Promise<Release> {
  const supabase = await createClient();
  const onConflict = input.spotify_id ? "spotify_id" : "slug";

  const { data, error } = await supabase
    .from("releases")
    .upsert(input as never, { onConflict })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `upsertRelease failed: ${error?.message ?? "no data returned"}`
    );
  }
  return data as Release;
}

/**
 * Insert junction rows linking artists to a release. Idempotent —
 * conflicts on the composite primary key (release_id, artist_id, role)
 * are ignored.
 */
export async function attachReleaseArtists(
  releaseId: string,
  artists: {
    artistId: string;
    role: ReleaseArtist["role"];
    position: number;
  }[]
): Promise<void> {
  if (artists.length === 0) return;

  const supabase = await createClient();
  const rows = artists.map((a) => ({
    release_id: releaseId,
    artist_id: a.artistId,
    role: a.role,
    position: a.position,
  }));

  await supabase
    .from("release_artists")
    .upsert(rows as never, {
      onConflict: "release_id,artist_id,role",
      ignoreDuplicates: true,
    });
}

/**
 * Release-first discovery feed. Returns recent releases sorted by
 * release_date desc nulls last, with primary artist + stats joined in.
 *
 * Two-pass: first fetches releases + primary artist, then resolves stats
 * in parallel via the get_release_stats RPC. We don't filter by review
 * count — releases with zero reviews still appear so the community can
 * fill them in.
 *
 * Returns [] on any error (including missing releases table) so the
 * home page degrades gracefully before migration 002 is applied.
 */
export interface ReleaseFeedItem {
  id: string;
  slug: string;
  title: string;
  cover_image: string | null;
  release_type: string;
  release_date: string | null;
  primary_artist: { slug: string; name: string };
  review_count: number;
  avg_rating: number | null;
  follower_count: number;
  /** Last activity timestamp from the associated release_room, if any. */
  last_activity_at: string | null;
}

export async function getReleaseDiscoveryFeed(
  limit: number = 12
): Promise<ReleaseFeedItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select(
      "id, slug, title, cover_image, release_type, release_date, primary_artist_id, artists!releases_primary_artist_id_fkey(slug, name), release_rooms(last_activity_at)"
    )
    .order("release_date", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];

  type JoinedArtist = { slug: string; name: string } | { slug: string; name: string }[] | null;
  type JoinedRoom =
    | { last_activity_at: string | null }
    | { last_activity_at: string | null }[]
    | null;
  type Row = {
    id: string;
    slug: string;
    title: string;
    cover_image: string | null;
    release_type: string;
    release_date: string | null;
    primary_artist_id: string;
    artists: JoinedArtist;
    release_rooms: JoinedRoom;
  };

  const rows = data as unknown as Row[];

  // Resolve stats in parallel.
  const stats = await Promise.all(
    rows.map((r) => getReleaseStats(r.id).catch(() => ({
      follower_count: 0,
      review_count: 0,
      avg_rating: null,
    } as ReleaseStats)))
  );

  return rows.map((row, i) => {
    const joined = row.artists;
    const artist = Array.isArray(joined) ? joined[0] : joined;
    const room = Array.isArray(row.release_rooms)
      ? row.release_rooms[0]
      : row.release_rooms;
    const s = stats[i];
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      cover_image: row.cover_image,
      release_type: row.release_type,
      release_date: row.release_date,
      primary_artist: {
        slug: artist?.slug ?? "",
        name: artist?.name ?? "Unknown Artist",
      },
      review_count: s.review_count,
      avg_rating: s.avg_rating,
      follower_count: s.follower_count,
      last_activity_at: room?.last_activity_at ?? null,
    };
  });
}

/**
 * Releases whose release_date is still in the future — the countdown
 * albums people pre-added via a pasted Spotify link. Soonest first,
 * primary artist name joined in for the "Dropping Soon" rail.
 */
export async function listUpcomingReleases(limit = 12): Promise<
  (Release & { artists: { name: string; slug: string } | null })[]
> {
  const supabase = await createClient();

  // Date filter at Eastern-day granularity, then the exact
  // eligibility check from lib/upcoming. A release stays on the shelf
  // through its whole release day in ET — the drop moment plus the
  // 24h OUT NOW grace (Luca 2026-09-02) — and the two filters agree
  // by construction: the grace window ends at 00:00 ET the next day,
  // which is exactly when release_date drops below todayEastern().
  const { data, error } = await supabase
    .from("releases")
    .select("*, artists!releases_primary_artist_id_fkey(name, slug)")
    .gte("release_date", todayEastern())
    .order("release_date", { ascending: true })
    .limit(limit);

  if (error || !data) return [];

  type Row = Release & {
    artists:
      | { name: string; slug: string }
      | { name: string; slug: string }[]
      | null;
  };
  return (
    (data as unknown as Row[])
      .filter((r) => isDroppingSoonEligible(r.release_date))
      .map((r) => ({
        ...r,
        artists: Array.isArray(r.artists) ? r.artists[0] ?? null : r.artists,
      }))
      // Still-coming first, already-dropped behind them. The SQL order
      // (release_date asc) put today's drops at the very front, which
      // would let yesterday's news crowd out what people are actually
      // waiting for. sort() is stable, so soonest-first survives
      // inside each group.
      .sort(
        (a, b) =>
          Number(hasDropped(a.release_date)) -
          Number(hasDropped(b.release_date))
      )
  );
}

/**
 * Community stats for a whole PAGE of releases — review count, the
 * community average, follower count, and room activity — in three
 * queries instead of one get_release_stats RPC per row.
 *
 * Exists because /releases used to render its whole grid with no
 * stats at all, so every card showed "be the first to review" and
 * every poster read UNRATED even for releases with plenty of reviews
 * (Luca 2026-09-02).
 *
 * The average is a plain mean over published ratings, matching
 * get_release_stats' avg(rating): every VOTE weighs the same.
 *
 * Ceiling worth knowing: the reviews fetch is row-based, so PostgREST's
 * default 1000-row cap applies. That's 1000 reviews across ONE page of
 * releases (24 of them) before counts start under-reporting — if the
 * catalog ever gets there, this wants to become a batch RPC.
 */
export interface ReleaseListStats {
  review_count: number;
  avg_rating: number | null;
  follower_count: number;
  last_activity_at: string | null;
}

export async function getReleaseListStats(
  releaseIds: string[]
): Promise<Map<string, ReleaseListStats>> {
  const out = new Map<string, ReleaseListStats>();
  if (releaseIds.length === 0) return out;

  // Seed every id so callers can read the map without null checks.
  for (const id of releaseIds) {
    out.set(id, {
      review_count: 0,
      avg_rating: null,
      follower_count: 0,
      last_activity_at: null,
    });
  }

  const supabase = await createClient();
  const [reviews, follows, rooms] = await Promise.all([
    supabase
      .from("reviews")
      .select("release_id, rating")
      .in("release_id", releaseIds)
      .eq("is_published", true),
    supabase
      .from("release_follows")
      .select("release_id")
      .in("release_id", releaseIds),
    supabase
      .from("release_rooms")
      .select("release_id, last_activity_at")
      .in("release_id", releaseIds),
  ]);

  // rating is numeric(3,1) NOT NULL in the schema, but PostgREST hands
  // numerics back as strings and a null would poison the mean — so
  // count the review either way and only average real numbers.
  const sums = new Map<string, { total: number; n: number }>();
  for (const row of (reviews.data ?? []) as {
    release_id: string | null;
    rating: number | string | null;
  }[]) {
    if (!row.release_id) continue;
    const entry = out.get(row.release_id);
    if (!entry) continue;
    entry.review_count += 1;

    const rating =
      typeof row.rating === "string" ? Number(row.rating) : row.rating;
    if (rating === null || rating === undefined || Number.isNaN(rating)) {
      continue;
    }
    const acc = sums.get(row.release_id) ?? { total: 0, n: 0 };
    acc.total += rating;
    acc.n += 1;
    sums.set(row.release_id, acc);
  }
  for (const [id, acc] of sums) {
    const entry = out.get(id);
    if (entry && acc.n > 0) entry.avg_rating = acc.total / acc.n;
  }

  for (const row of (follows.data ?? []) as { release_id: string | null }[]) {
    if (!row.release_id) continue;
    const entry = out.get(row.release_id);
    if (entry) entry.follower_count += 1;
  }

  for (const row of (rooms.data ?? []) as {
    release_id: string | null;
    last_activity_at: string | null;
  }[]) {
    if (!row.release_id) continue;
    const entry = out.get(row.release_id);
    if (entry) entry.last_activity_at = row.last_activity_at;
  }

  return out;
}

/** A release row with its primary artist's name resolved. */
export interface ReleaseListRow extends Release {
  artistName: string | null;
}

export async function listReleases(opts?: {
  sort?: "recent" | "popularity" | "alpha";
  limit?: number;
  offset?: number;
  artistId?: string;
  /**
   * Only UNRELEASED records (Luca 2026-09-03: "add a filter for
   * unreleased music" — the wedge, see ROADMAP Strategy). With this
   * on, "recent" means newest ADDED to the catalog (created_at), not
   * release_date — leaks and unreleased tracks mostly have no date,
   * and "what just surfaced" is the question people are asking. The
   * popularity RPC (034) has no unreleased switch, so that sort falls
   * back to the same newest-added order here.
   */
  unreleased?: boolean;
}): Promise<ReleaseListRow[]> {
  const supabase = await createClient();
  const sort = opts?.sort ?? "recent";
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  const byColumn = async (
    column: "release_date" | "popularity" | "title" | "created_at"
  ): Promise<Release[]> => {
    let query = supabase.from("releases").select("*");
    if (opts?.artistId) {
      query = query.eq("primary_artist_id", opts.artistId);
    }
    if (opts?.unreleased) {
      query = query.eq("is_unreleased", true);
    }
    query =
      column === "title"
        ? query.order("title", { ascending: true })
        : query.order(column, { ascending: false, nullsFirst: false });

    const { data, error } = await query.range(offset, offset + limit - 1);
    if (error || !data) return [];
    return data as Release[];
  };

  let rows: Release[];
  if (opts?.unreleased) {
    rows = await byColumn(sort === "alpha" ? "title" : "created_at");
  } else if (sort === "popularity") {
    // "Popularity" means what the COMMUNITY did with a release —
    // total published reviews — not Spotify's popularity score, which
    // is what this tab used to sort by (Luca 2026-09-02). Ordering by
    // an aggregate has to happen in SQL for pagination to be correct,
    // hence the RPC from migration 034.
    const { data, error } = await supabase.rpc(
      "list_releases_by_review_count",
      {
        p_limit: limit,
        p_offset: offset,
        p_artist_id: opts?.artistId ?? null,
      } as never
    );
    // Before 034 is applied the function doesn't exist — fall back to
    // the old column order so the tab still returns a sane page
    // instead of going blank.
    rows =
      !error && data ? (data as unknown as Release[]) : await byColumn("popularity");
  } else {
    rows = await byColumn(sort === "alpha" ? "title" : "release_date");
  }

  if (rows.length === 0) return [];

  // Artist names in one extra query rather than a per-sort embed —
  // the popularity path comes back from an RPC that can't carry a
  // PostgREST join, so resolving them here keeps all three sorts
  // rendering the same card.
  const artistIds = [
    ...new Set(rows.map((r) => r.primary_artist_id).filter(Boolean)),
  ];
  const names = new Map<string, string>();
  if (artistIds.length > 0) {
    const { data } = await supabase
      .from("artists")
      .select("id, name")
      .in("id", artistIds);
    for (const a of (data ?? []) as { id: string; name: string }[]) {
      names.set(a.id, a.name);
    }
  }

  return rows.map((r) => ({
    ...r,
    artistName: names.get(r.primary_artist_id) ?? null,
  }));
}

/**
 * Unreleased records currently on the platform (is_unreleased = true —
 * Genius deep-catalog imports and by-hand adds), newest first, with
 * the primary artist's name. Feeds the Unreleased section on the
 * logged-out home.
 */
export async function listUnreleasedReleases(limit = 8): Promise<
  { id: string; slug: string; title: string; cover_image: string | null; artist: string }[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("id, slug, title, cover_image, artists!releases_primary_artist_id_fkey(name)")
    .eq("is_unreleased", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];

  type Row = {
    id: string;
    slug: string;
    title: string;
    cover_image: string | null;
    artists: { name: string } | { name: string }[] | null;
  };
  return (data as unknown as Row[]).map((r) => {
    const a = Array.isArray(r.artists) ? r.artists[0] : r.artists;
    return { id: r.id, slug: r.slug, title: r.title, cover_image: r.cover_image, artist: a?.name ?? "" };
  });
}
