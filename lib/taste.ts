import { createClient } from "@/lib/supabase/server";
import { getReleaseDescription } from "@/lib/descriptions";
import { getReleaseStats } from "@/lib/db/releases";

/**
 * The Your Taste engine (v1) — designed with Luca 2026-08-19.
 *
 * Two exports:
 *   buildTasteProfile(userId)  — per-artist affinity scores from the
 *                                viewer's own signals.
 *   getTunedToYou(profile, id) — the "TUNED TO YOU" picks: recent
 *                                reviews/debates/releases scored
 *                                70% taste match / 30% popularity,
 *                                with a freshness decay.
 *
 * Ground rules (Luca's):
 *   - Cold start: a viewer with almost no signal gets pure most-liked /
 *     most-active content until their taste shows (the 70/30 blend fades
 *     in with signal volume).
 *   - Reason chips only where clean: an item gets a reason only when one
 *     strong signal explains the pick; blends get no chip rather than a
 *     vague one.
 *
 * Everything is computed inline per request from a handful of indexed
 * queries — no ML, no precomputation. If it ever gets slow, snapshot the
 * profile nightly. All failures degrade to empty results, never throw.
 */

/* ─────────────────────────── Profile ─────────────────────────── */

export interface TasteProfile {
  /** artist_id → affinity (can be negative — low ratings suppress). */
  byArtistId: Map<string, number>;
  /** lowercased artist name → affinity, for rows that only carry names. */
  byArtistName: Map<string, number>;
  /** artist_id → the single strongest signal, phrased for a reason chip. */
  reasonByArtistId: Map<string, string>;
  /** Total signal rows — gates the cold-start blend. */
  signalCount: number;
  /** The viewer's top-3 artists by affinity (positive only, and only
      where we actually resolved a display name) — the lobby masthead's
      "transmitter receipts" strip renders these with their reason
      strings so the algorithm shows its work instead of bare chips. */
  topArtists: { id: string; name: string; weight: number }[];
  /** Releases the viewer already followed or reviewed — the mix engine
      hard-excludes these from the PREMIERE pool ("recommending" an
      album you rated last week is filler, not a recommendation).
      Liked-review releases deliberately stay IN: liking someone's
      review is a nudge toward an album, not proof you've digested it. */
  interactedReleaseIds: Set<string>;
}

/** Signal weights. Ratings map (rating−5)/2.5 → 10/10 = +2, 0/10 = −2. */
const W_ARTIST_FOLLOW = 3;
const W_RELEASE_FOLLOW = 1.5;
const W_REVIEW_LIKE = 1;

/** Reviews older than this contribute at half weight (taste drifts). */
const REVIEW_STALE_MS = 180 * 24 * 60 * 60 * 1000;

export async function buildTasteProfile(
  userId: string
): Promise<TasteProfile> {
  const supabase = await createClient();

  const [artistFollowsRes, releaseFollowsRes, myReviewsRes, myLikesRes] =
    await Promise.all([
      supabase
        .from("artist_follows")
        .select("artist_id, artists!inner(name)")
        .eq("follower_id", userId),
      supabase
        .from("release_follows")
        .select("release_id")
        .eq("follower_id", userId),
      supabase
        .from("reviews")
        .select("release_id, artist, rating, created_at")
        .eq("user_id", userId),
      supabase
        .from("review_likes")
        .select("reviews!inner(release_id, artist)")
        .eq("user_id", userId),
    ]);

  const byArtistId = new Map<string, number>();
  const byArtistName = new Map<string, number>();
  // Track the strongest contribution per artist so the reason chip names
  // the signal that actually drove the pick.
  const bestSignal = new Map<string, { weight: number; reason: string }>();
  // Display names as we learn them (follows carry one, the release
  // lookup below carries another) — needed so topArtists can say
  // "Björk", not a bare uuid.
  const nameByArtistId = new Map<string, string>();
  let signalCount = 0;

  const addById = (
    artistId: string,
    weight: number,
    reason: string | null
  ) => {
    byArtistId.set(artistId, (byArtistId.get(artistId) ?? 0) + weight);
    if (reason) {
      const prev = bestSignal.get(artistId);
      if (!prev || Math.abs(weight) > Math.abs(prev.weight)) {
        bestSignal.set(artistId, { weight, reason });
      }
    }
  };
  const addByName = (name: string, weight: number) => {
    const key = name.trim().toLowerCase();
    if (!key) return;
    byArtistName.set(key, (byArtistName.get(key) ?? 0) + weight);
  };

  /* Artist follows — the loudest explicit signal. */
  type FollowRow = {
    artist_id: string;
    artists: { name: string } | { name: string }[] | null;
  };
  for (const row of (artistFollowsRes.data ?? []) as unknown as FollowRow[]) {
    const name = Array.isArray(row.artists)
      ? row.artists[0]?.name
      : row.artists?.name;
    addById(row.artist_id, W_ARTIST_FOLLOW, `you follow ${name ?? "them"}`);
    if (name) {
      addByName(name, W_ARTIST_FOLLOW);
      nameByArtistId.set(row.artist_id, name);
    }
    signalCount++;
  }

  /* Ratings — signed: loving an album lifts the artist, hating it sinks
     them. Name-keyed immediately; id-keyed after the release lookup. */
  const myReviews = (myReviewsRes.data ?? []) as {
    release_id: string | null;
    artist: string;
    rating: number;
    created_at: string;
  }[];
  const now = Date.now();
  const reviewWeights = new Map<string, { weight: number; reason: string }>();
  for (const r of myReviews) {
    const stale = now - new Date(r.created_at).getTime() > REVIEW_STALE_MS;
    const weight = ((Number(r.rating) - 5) / 2.5) * (stale ? 0.5 : 1);
    addByName(r.artist, weight);
    signalCount++;
    if (r.release_id) {
      const prev = reviewWeights.get(r.release_id);
      if (!prev || Math.abs(weight) > Math.abs(prev.weight)) {
        reviewWeights.set(r.release_id, {
          weight,
          reason: `you rated ${r.artist} ${r.rating}/10`,
        });
      }
    }
  }

  /* Release follows + liked reviews — collect release ids, resolve the
     release → artist mapping in one query. */
  const followedReleaseIds = (releaseFollowsRes.data ?? []).map(
    (r) => (r as { release_id: string }).release_id
  );
  signalCount += followedReleaseIds.length;

  type LikeRow = {
    reviews:
      | { release_id: string | null; artist: string }
      | { release_id: string | null; artist: string }[]
      | null;
  };
  const likedReleaseIds: string[] = [];
  for (const row of (myLikesRes.data ?? []) as unknown as LikeRow[]) {
    const review = Array.isArray(row.reviews) ? row.reviews[0] : row.reviews;
    if (!review) continue;
    addByName(review.artist, W_REVIEW_LIKE);
    if (review.release_id) likedReleaseIds.push(review.release_id);
    signalCount++;
  }

  const releaseIds = [
    ...new Set([
      ...followedReleaseIds,
      ...likedReleaseIds,
      ...reviewWeights.keys(),
    ]),
  ];
  if (releaseIds.length > 0) {
    const { data } = await supabase
      .from("releases")
      .select("id, primary_artist_id, artists!releases_primary_artist_id_fkey(name)")
      .in("id", releaseIds);

    type RelRow = {
      id: string;
      primary_artist_id: string | null;
      artists: { name: string } | { name: string }[] | null;
    };
    const artistOf = new Map<string, { id: string; name: string | null }>();
    for (const row of (data ?? []) as unknown as RelRow[]) {
      if (!row.primary_artist_id) continue;
      const name = Array.isArray(row.artists)
        ? row.artists[0]?.name ?? null
        : row.artists?.name ?? null;
      artistOf.set(row.id, { id: row.primary_artist_id, name });
      if (name) nameByArtistId.set(row.primary_artist_id, name);
    }

    for (const rid of followedReleaseIds) {
      const artist = artistOf.get(rid);
      if (!artist) continue;
      addById(
        artist.id,
        W_RELEASE_FOLLOW,
        `you're watching ${artist.name ?? "their release"}`
      );
    }
    for (const rid of likedReleaseIds) {
      const artist = artistOf.get(rid);
      if (artist) addById(artist.id, W_REVIEW_LIKE, null);
    }
    for (const [rid, { weight, reason }] of reviewWeights) {
      const artist = artistOf.get(rid);
      if (artist) addById(artist.id, weight, weight > 0 ? reason : null);
    }
  }

  const reasonByArtistId = new Map<string, string>();
  for (const [artistId, { weight, reason }] of bestSignal) {
    if (weight > 0) reasonByArtistId.set(artistId, reason);
  }

  /* The masthead receipts: top-3 artists by affinity. Positive weight
     only (a hated artist is not a "receipt") and named only — an
     unresolvable id would render as a blank row, so it's skipped and
     the next-best artist takes the slot. */
  const topArtists = [...byArtistId.entries()]
    .filter(([id, weight]) => weight > 0 && nameByArtistId.has(id))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([id, weight]) => ({ id, name: nameByArtistId.get(id)!, weight }));

  // Followed + self-reviewed releases (NOT liked-review ones — see the
  // interface comment) for the mix engine's already-interacted filter.
  const interactedReleaseIds = new Set([
    ...followedReleaseIds,
    ...reviewWeights.keys(),
  ]);

  return {
    byArtistId,
    byArtistName,
    reasonByArtistId,
    signalCount,
    topArtists,
    interactedReleaseIds,
  };
}

/** Affinity lookup that falls back from artist id to name. */
export function affinityFor(
  profile: TasteProfile,
  artistId: string | null,
  artistName: string | null
): number {
  if (artistId !== null) {
    const byId = profile.byArtistId.get(artistId);
    if (byId !== undefined) return byId;
  }
  if (artistName) {
    return profile.byArtistName.get(artistName.trim().toLowerCase()) ?? 0;
  }
  return 0;
}

/* ─────────────────────── TUNED TO YOU picks ─────────────────────── */

export type TunedItem =
  | {
      type: "review";
      /** Row id — the fullscreen rail's like button posts against it. */
      id: string;
      slug: string;
      title: string;
      artist: string;
      rating: number;
      /** Genre chip beside the artist line on the CriticSegment card. */
      genre: string | null;
      cover_image: string | null;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      /** Author's role — drives the "PEAK CRITIC" badge in the chyron
          (reviewer/admin/owner get it, plain users don't). */
      role: string | null;
      /** The review's words (summary, falling back to snippet) —
          shown right on the pager card, no extra click. */
      body: string | null;
      /** The reviewer's picked tracks — the card renders them as pills
          that load THAT track into the Spotify embed slot. */
      standout_tracks: { title: string; spotifyUrl: string }[];
      like_count: number;
      viewer_has_liked: boolean;
      /** Comment count for the rail button — conversation needs scent. */
      comment_count: number;
      /** Direct link to the exact track/album (fullscreen card CTA —
          Luca 2026-08-22: "check out immediately, no extra clicks"). */
      spotify_url: string | null;
      /** For the chyron's "REC {timeAgo}" stamp. */
      created_at: string;
      reason: string | null;
    }
  | {
      type: "post";
      /** Row id — the fullscreen rail's like button posts against it. */
      id: string;
      slug: string;
      title: string;
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      /** Author's role — for the badge in the "PRESENTED BY" chyron. */
      role: string | null;
      /** The post's words — shown right on the pager card. */
      body: string;
      video_kind: "youtube" | "tiktok" | null;
      video_id: string | null;
      /** Tied release cover, if the post is catalog-attached. */
      cover_image: string | null;
      /** Tied release identity for the "FEATURING: {title} — {artist}"
          caption line (null when the post isn't catalog-attached). */
      release_title: string | null;
      release_slug: string | null;
      release_artist: string | null;
      like_count: number;
      viewer_has_liked: boolean;
      /** For the chyron's timestamp. */
      created_at: string;
      reason: string | null;
    }
  | {
      type: "debate";
      slug: string;
      title: string;
      /** The debate's framing question — the OnAir card's pull-quote. */
      prompt: string | null;
      side_a_label: string;
      side_b_label: string;
      /** Tied release, if any — the mix engine's same-release dedup
          keys on it so a debate and its album never both air. */
      release_id: string | null;
      activity: number; // votes + messages
      /** Messages alone — the card's "{n} TAKES" counter (activity
          still bundles votes in for scoring). */
      message_count: number;
      /** Per-side vote tallies — feed the VoteBar's live A/B split. */
      side_a_count: number;
      side_b_count: number;
      /** The host chyron: whoever opened the debate. */
      creator_username: string | null;
      creator_avatar_url: string | null;
      cover_image: string | null;
      created_at: string;
      reason: string | null;
    }
  | {
      type: "release";
      slug: string;
      title: string;
      artist: string;
      cover_image: string | null;
      is_unreleased: boolean;
      /** Real release date — "AIRED {date}" on the Premiere card, and
          the D-{n} countdown source for unreleased drops. */
      release_date: string | null;
      /** Derived from the tracks[] jsonb — "{n} TRACKS · {m} MIN". */
      track_count: number;
      /** Null when durations are unknown (Genius-only imports store
          duration_ms 0) so the card can drop the runtime cleanly. */
      total_runtime_min: number | null;
      /** Community stats via get_release_stats — filled POST-PICK for
          the ≤6 picked releases only, never the whole candidate pool.
          Null/0 when the timeout-guarded RPC doesn't come back. */
      avg_rating: number | null;
      review_count: number;
      created_at: string;
      /** Letterboxd-style synopsis (manual → Genius → Wikipedia) —
          filled ONLY for the final picked items, on the card to
          entice the tap (Luca 2026-08-22). */
      description: string | null;
      description_source: "manual" | "genius" | "wikipedia" | null;
      description_url: string | null;
      /** Carried through so the post-pick enrichment can resolve. */
      release_type: string;
      genius_id: string | null;
      /** Direct link to the exact track/album on Spotify. */
      spotify_url: string | null;
      reason: string | null;
    };

// Sized for the channel-surf pager: enough cards to scroll through
// without letting one artist or type take the feed over.
const TUNED_MAX_ITEMS = 12;
const TUNED_MAX_PER_ARTIST = 2;
const TUNED_MAX_PER_TYPE = 6;
/** Reviews written by people the viewer follows get this taste boost. */
const W_FOLLOWED_AUTHOR = 1.5;
/** Half-strength freshness at two weeks; nothing goes fully to zero. */
const FRESH_HALF_LIFE_DAYS = 14;

/** FNV-1a, folded to [0, 1). Tiny, dependency-free, and — the property
    the day-seed jitter needs — DETERMINISTIC: the same string always
    hashes to the same number, unlike Math.random(). */
function hash01(s: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime, 32-bit wrap via imul
  }
  // >>> 0 makes the 32-bit int unsigned; dividing by 2^32 lands in [0,1).
  return (h >>> 0) / 4_294_967_296;
}

/** Stable identity for a tuned item — the SAME strings the client
    writes into the pmr_taste_seen cookie and sessionStorage, so the
    server's seen-downrank and the lobby's watched-row dimming agree.
    Change one side and rotation silently dies. */
function tunedKeyOf(item: TunedItem): string {
  switch (item.type) {
    case "review":
      return `review:${item.id}`;
    case "post":
      return `post:${item.id}`;
    case "debate":
      return `debate:${item.slug}`;
    case "release":
      return `release:${item.slug}`;
  }
}

interface Candidate {
  item: TunedItem;
  artistKey: string; // artist id/name for the diversity guard
  /** The release this item is ABOUT (review/post/debate → release_id,
      release → its own id; null when untied). The pick loop dedups on
      it so one album can't appear twice as, say, a review card AND a
      premiere card in the same broadcast. */
  releaseKey: string | null;
  taste: number;
  popularity: number;
  /** TRUE engagement counts only (likes / follows / votes+messages),
      no freshness pads — the "popular right now" chip gates on this
      absolutely, because a chip earned by a freshness tiebreaker on a
      zero-like item would be a lie. */
  rawPop: number;
  /** The reason is "you follow @x" — follow reasons always earn their
      chip; affinity reasons need real taste weight behind them. */
  reasonIsFollow: boolean;
  ageDays: number;
  reason: string | null;
  score?: number;
}

export async function getTunedToYou(
  profile: TasteProfile,
  viewerId: string,
  opts?: {
    /** People the viewer follows — their reviews get boosted + a reason. */
    followedUserIds?: string[];
    /** Item keys (tunedKeyOf format) the viewer already watched — read
        from the pmr_taste_seen cookie by app/your-taste/page.tsx. Seen
        items are DOWNRANKED ×0.35, never excluded: with a small pool a
        hard exclusion could empty the feed, and a rerun favorite
        should still be able to fight its way back on air. */
    seenKeys?: string[];
  }
): Promise<TunedItem[]> {
  const supabase = await createClient();
  const followedAuthors = new Set(opts?.followedUserIds ?? []);

  // Tuned To You is a feed, so blocked authors never appear in it
  // (App Store 1.2 — same rule as the Community Feed / posts walls).
  const { data: blocksData } = await supabase
    .from("user_blocks")
    .select("blocked_id")
    .eq("blocker_id", viewerId);
  const blockedAuthors = new Set(
    ((blocksData ?? []) as { blocked_id: string }[]).map((b) => b.blocked_id)
  );

  const [reviewsRes, debatesRes, releasesRes, postsRes] = await Promise.all([
    supabase
      .from("reviews")
      .select(
        "id, user_id, slug, title, artist, rating, genre, cover_image, snippet, summary, standout_tracks, created_at, release_id, releases(primary_artist_id, spotify_id, release_type, tracks), profiles!reviews_user_id_fkey!inner(username, display_name, avatar_url, role)"
      )
      .eq("is_published", true)
      .neq("user_id", viewerId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("debates")
      .select(
        "id, created_by, slug, title, prompt, side_a_label, side_b_label, release_id, message_count, created_at, releases(primary_artist_id, cover_image, title), profiles!debates_created_by_fkey(username, avatar_url)"
      )
      .eq("status", "open")
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("releases")
      .select(
        "id, slug, title, cover_image, is_unreleased, release_date, created_at, primary_artist_id, genius_id, spotify_id, release_type, description, tracks, artists!releases_primary_artist_id_fkey(name)"
      )
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("posts")
      .select(
        "id, user_id, slug, title, body, video_kind, video_id, release_id, created_at, releases(primary_artist_id, cover_image, title, slug, artists!releases_primary_artist_id_fkey(name)), profiles!posts_user_id_fkey(username, display_name, avatar_url, role)"
      )
      .neq("user_id", viewerId)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);

  /* Engagement lookups for the candidate pools, tallied in JS. */
  const reviewIds = (reviewsRes.data ?? []).map((r) => (r as { id: string }).id);
  const debateIds = (debatesRes.data ?? []).map((d) => (d as { id: string }).id);
  const releaseIds = (releasesRes.data ?? []).map(
    (r) => (r as { id: string }).id
  );
  const postIds = (postsRes.data ?? []).map((p) => (p as { id: string }).id);

  const [likesRes, votesRes, followsRes, postLikesRes, myLikesRes, myPostLikesRes, commentsRes] =
    await Promise.all([
      reviewIds.length
        ? supabase.from("review_likes").select("review_id").in("review_id", reviewIds)
        : Promise.resolve({ data: [] }),
      // `side` rides along so the OnAir card can show the live A/B
      // split — the per-debate total alone can't feed a VoteBar.
      debateIds.length
        ? supabase.from("debate_votes").select("debate_id, side").in("debate_id", debateIds)
        : Promise.resolve({ data: [] }),
      releaseIds.length
        ? supabase
            .from("release_follows")
            .select("release_id")
            .in("release_id", releaseIds)
        : Promise.resolve({ data: [] }),
      // Post likes (migration 016). Before it's applied the query just
      // errors → data null → every count 0, which is the right fallback.
      postIds.length
        ? supabase.from("post_likes").select("post_id").in("post_id", postIds)
        : Promise.resolve({ data: [] }),
      // The viewer's OWN hearts — the fullscreen rail's like buttons
      // need their initial pressed state.
      reviewIds.length
        ? supabase
            .from("review_likes")
            .select("review_id")
            .eq("user_id", viewerId)
            .in("review_id", reviewIds)
        : Promise.resolve({ data: [] }),
      postIds.length
        ? supabase
            .from("post_likes")
            .select("post_id")
            .eq("user_id", viewerId)
            .in("post_id", postIds)
        : Promise.resolve({ data: [] }),
      // Comment counts for the candidate reviews — the rail's comment
      // button shows the number so conversation has scent. Same JS-tally
      // shape as the like counts (fine at this scale; revisit alongside
      // the like tallies if row counts ever get big).
      reviewIds.length
        ? supabase.from("comments").select("review_id").in("review_id", reviewIds)
        : Promise.resolve({ data: [] }),
    ]);

  const tally = (rows: unknown[] | null, key: string) => {
    const m = new Map<string, number>();
    for (const row of rows ?? []) {
      const id = (row as Record<string, string>)[key];
      m.set(id, (m.get(id) ?? 0) + 1);
    }
    return m;
  };
  const likeCounts = tally(likesRes.data, "review_id");
  const voteCounts = tally(votesRes.data, "debate_id");
  const followCounts = tally(followsRes.data, "release_id");
  const postLikeCounts = tally(postLikesRes.data, "post_id");
  const commentCounts = tally(commentsRes.data, "review_id");
  // Per-side tallies for the same vote rows — the OnAir card's VoteBar
  // needs the A/B split, not just the total the scorer uses.
  const voteSides = new Map<string, { a: number; b: number }>();
  for (const row of (votesRes.data ?? []) as unknown as { debate_id: string; side: "a" | "b" }[]) {
    const t = voteSides.get(row.debate_id) ?? { a: 0, b: 0 };
    if (row.side === "b") t.b += 1;
    else t.a += 1;
    voteSides.set(row.debate_id, t);
  }
  const myReviewLikes = new Set(
    (myLikesRes.data ?? []).map((r) => (r as { review_id: string }).review_id),
  );
  const myPostLikes = new Set(
    (myPostLikesRes.data ?? []).map((r) => (r as { post_id: string }).post_id),
  );

  const now = Date.now();
  const ageDays = (iso: string) =>
    Math.max(0, (now - new Date(iso).getTime()) / 86_400_000);
  const first = <T,>(joined: T | T[] | null): T | null =>
    Array.isArray(joined) ? joined[0] ?? null : joined;

  /* Exact Spotify link for a release row. Singles link the TRACK:
     tracks[0].spotify_id holds it on both import paths (track-keyed
     singles reuse the row's own id there; album-sourced singles
     store the real track id). Everything else links the album.
     Genius-only releases have neither → null. */
  type SpotifyRef = {
    spotify_id: string | null;
    release_type: string;
    tracks: { spotify_id?: string | null }[] | null;
  };
  const spotifyUrlFor = (r: SpotifyRef | null): string | null => {
    if (!r) return null;
    if (r.release_type === "single") {
      const trackId = r.tracks?.[0]?.spotify_id ?? r.spotify_id;
      return trackId ? `https://open.spotify.com/track/${trackId}` : null;
    }
    return r.spotify_id
      ? `https://open.spotify.com/album/${r.spotify_id}`
      : null;
  };

  const candidates: Candidate[] = [];

  type ReviewProfile = {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    role: string | null;
  };
  type ReviewRow = {
    id: string;
    user_id: string;
    slug: string;
    title: string;
    artist: string;
    rating: number;
    genre: string | null;
    cover_image: string | null;
    snippet: string | null;
    summary: string | null;
    /** jsonb column — array of {title, spotifyUrl} picks. */
    standout_tracks: { title: string; spotifyUrl: string }[] | null;
    created_at: string;
    release_id: string | null;
    releases:
      | {
          primary_artist_id: string | null;
          spotify_id: string | null;
          release_type: string;
          tracks: { spotify_id?: string | null }[] | null;
        }
      | {
          primary_artist_id: string | null;
          spotify_id: string | null;
          release_type: string;
          tracks: { spotify_id?: string | null }[] | null;
        }[]
      | null;
    profiles: ReviewProfile | ReviewProfile[] | null;
  };
  for (const r of (reviewsRes.data ?? []) as unknown as ReviewRow[]) {
    if (blockedAuthors.has(r.user_id)) continue;
    const artistId = first(r.releases)?.primary_artist_id ?? null;
    const fromFollow = followedAuthors.has(r.user_id);
    const taste =
      affinityFor(profile, artistId, r.artist) +
      (fromFollow ? W_FOLLOWED_AUTHOR : 0);
    const author = first(r.profiles);
    const username = author?.username ?? "";
    // A followed author beats an artist-affinity reason: "your person
    // rated this" is the cleaner explanation of the two.
    const reason = fromFollow
      ? `from @${username} — you follow them`
      : artistId
        ? profile.reasonByArtistId.get(artistId) ?? null
        : null;
    candidates.push({
      item: {
        type: "review",
        id: r.id,
        slug: r.slug,
        title: r.title,
        artist: r.artist,
        rating: Number(r.rating),
        genre: r.genre,
        cover_image: r.cover_image,
        username,
        display_name: author?.display_name ?? null,
        avatar_url: author?.avatar_url ?? null,
        role: author?.role ?? null,
        body: r.summary ?? r.snippet,
        standout_tracks: r.standout_tracks ?? [],
        like_count: likeCounts.get(r.id) ?? 0,
        viewer_has_liked: myReviewLikes.has(r.id),
        comment_count: commentCounts.get(r.id) ?? 0,
        spotify_url: spotifyUrlFor(first(r.releases)),
        created_at: r.created_at,
        reason: null,
      },
      artistKey: artistId ?? r.artist.toLowerCase(),
      releaseKey: r.release_id,
      taste,
      popularity: likeCounts.get(r.id) ?? 0,
      rawPop: likeCounts.get(r.id) ?? 0,
      reasonIsFollow: fromFollow,
      ageDays: ageDays(r.created_at),
      reason,
    });
  }

  type PostRowT = {
    id: string;
    user_id: string;
    slug: string;
    title: string;
    body: string;
    video_kind: "youtube" | "tiktok" | null;
    video_id: string | null;
    created_at: string;
    release_id: string | null;
    releases:
      | {
          primary_artist_id: string | null;
          cover_image: string | null;
          title: string;
          slug: string;
          artists: { name: string } | { name: string }[] | null;
        }
      | {
          primary_artist_id: string | null;
          cover_image: string | null;
          title: string;
          slug: string;
          artists: { name: string } | { name: string }[] | null;
        }[]
      | null;
    profiles:
      | { username: string; display_name: string | null; avatar_url: string | null; role: string | null }
      | { username: string; display_name: string | null; avatar_url: string | null; role: string | null }[]
      | null;
  };
  for (const p of (postsRes.data ?? []) as unknown as PostRowT[]) {
    if (blockedAuthors.has(p.user_id)) continue;
    const rel = first(p.releases);
    const artistId = rel?.primary_artist_id ?? null;
    const author = first(p.profiles);
    const fromFollow = followedAuthors.has(p.user_id);
    const taste =
      affinityFor(profile, artistId, null) +
      (fromFollow ? W_FOLLOWED_AUTHOR : 0);
    const username = author?.username ?? "";
    const reason = fromFollow
      ? `from @${username} — you follow them`
      : artistId
        ? profile.reasonByArtistId.get(artistId) ?? null
        : null;
    candidates.push({
      item: {
        type: "post",
        id: p.id,
        slug: p.slug,
        title: p.title,
        username,
        display_name: author?.display_name ?? null,
        avatar_url: author?.avatar_url ?? null,
        role: author?.role ?? null,
        body: p.body,
        video_kind: p.video_kind,
        video_id: p.video_id,
        cover_image: rel?.cover_image ?? null,
        // Tied-release identity for the "FEATURING:" caption line —
        // all three stay null together when the post is free-floating.
        release_title: rel?.title ?? null,
        release_slug: rel?.slug ?? null,
        release_artist: rel ? first(rel.artists)?.name ?? null : null,
        like_count: postLikeCounts.get(p.id) ?? 0,
        viewer_has_liked: myPostLikes.has(p.id),
        created_at: p.created_at,
        reason: null,
      },
      // Untied posts key on the author so one prolific poster can't
      // flood the pager (same diversity guard as artists).
      artistKey: artistId ?? `post-author:${username}`,
      releaseKey: p.release_id,
      taste,
      // Real hearts (migration 016) lead; freshness (0..1) is the
      // tiebreaker so a brand-new zero-like post still scores above
      // zero. (A literal 0 here once dropped ALL posts from the pager
      // — the `score <= 0` pick guard ate them.)
      popularity:
        (postLikeCounts.get(p.id) ?? 0) +
        Math.pow(0.5, ageDays(p.created_at) / FRESH_HALF_LIFE_DAYS),
      // rawPop = hearts only — the freshness pad above must never earn
      // a "popular right now" chip.
      rawPop: postLikeCounts.get(p.id) ?? 0,
      reasonIsFollow: fromFollow,
      ageDays: ageDays(p.created_at),
      reason,
    });
  }

  type DebateRow = {
    id: string;
    created_by: string;
    slug: string;
    title: string;
    prompt: string | null;
    side_a_label: string;
    side_b_label: string;
    release_id: string | null;
    message_count: number;
    created_at: string;
    releases:
      | { primary_artist_id: string | null; cover_image: string | null; title: string }
      | { primary_artist_id: string | null; cover_image: string | null; title: string }[]
      | null;
    profiles:
      | { username: string; avatar_url: string | null }
      | { username: string; avatar_url: string | null }[]
      | null;
  };
  for (const d of (debatesRes.data ?? []) as unknown as DebateRow[]) {
    if (blockedAuthors.has(d.created_by)) continue;
    const release = first(d.releases);
    const artistId = release?.primary_artist_id ?? null;
    const votes = voteCounts.get(d.id) ?? 0;
    const sides = voteSides.get(d.id) ?? { a: 0, b: 0 };
    const creator = first(d.profiles);
    candidates.push({
      item: {
        type: "debate",
        slug: d.slug,
        title: d.title,
        prompt: d.prompt,
        side_a_label: d.side_a_label,
        side_b_label: d.side_b_label,
        release_id: d.release_id,
        activity: votes + d.message_count,
        message_count: d.message_count,
        side_a_count: sides.a,
        side_b_count: sides.b,
        creator_username: creator?.username ?? null,
        creator_avatar_url: creator?.avatar_url ?? null,
        cover_image: release?.cover_image ?? null,
        created_at: d.created_at,
        reason: null,
      },
      artistKey: artistId ?? `debate:${d.id}`,
      releaseKey: d.release_id,
      taste: artistId ? affinityFor(profile, artistId, null) : 0,
      popularity: votes + d.message_count,
      // Votes and messages are both real human actions — the whole
      // activity number is honest popularity.
      rawPop: votes + d.message_count,
      reasonIsFollow: false,
      ageDays: ageDays(d.created_at),
      reason: artistId ? profile.reasonByArtistId.get(artistId) ?? null : null,
    });
  }

  type ReleaseRow = {
    id: string;
    slug: string;
    title: string;
    cover_image: string | null;
    is_unreleased: boolean;
    release_date: string | null;
    created_at: string;
    primary_artist_id: string | null;
    genius_id: string | null;
    spotify_id: string | null;
    release_type: string;
    description: string | null;
    tracks: { spotify_id?: string | null; title?: string | null; duration_ms?: number | null }[] | null;
    artists: { name: string } | { name: string }[] | null;
  };
  // First-track titles by release slug — anchors the Genius album
  // description lookup during post-pick enrichment below.
  const firstTrackBySlug = new Map<string, string | null>();
  // Row ids by slug — the post-pick get_release_stats RPC needs the
  // uuid, but the payload only carries the slug.
  const releaseIdBySlug = new Map<string, string>();
  for (const r of (releasesRes.data ?? []) as unknown as ReleaseRow[]) {
    // Already followed or reviewed by the viewer → not a recommendation,
    // just filler. Out before it costs a candidate slot.
    if (profile.interactedReleaseIds.has(r.id)) continue;
    const artistName = first(r.artists)?.name ?? "";
    firstTrackBySlug.set(r.slug, r.tracks?.[0]?.title ?? null);
    releaseIdBySlug.set(r.slug, r.id);
    // Freshness runs off the REAL release date when we have one (an
    // album imported today but released in 1997 is not "fresh"); the
    // import date is the fallback. ageDays clamps future dates to 0 =
    // maximally fresh, which is exactly right for unreleased drops.
    const age = ageDays(r.release_date ?? r.created_at);
    // "{n} TRACKS · {m} MIN" straight from the tracks[] jsonb we already
    // fetched for the Spotify link — no extra query. Genius-only imports
    // store duration_ms 0 on every track, so a zero total means "we don't
    // know", not "zero minutes" → null lets the card drop the runtime.
    const runtimeMs = (r.tracks ?? []).reduce(
      (sum, t) => sum + (t.duration_ms ?? 0),
      0
    );
    candidates.push({
      item: {
        type: "release",
        slug: r.slug,
        title: r.title,
        artist: artistName,
        cover_image: r.cover_image,
        is_unreleased: r.is_unreleased ?? false,
        release_date: r.release_date,
        track_count: r.tracks?.length ?? 0,
        total_runtime_min: runtimeMs > 0 ? Math.round(runtimeMs / 60_000) : null,
        // Community stats land post-pick (RPC below) — defaults mean
        // "no data yet", and the card hides the community line.
        avg_rating: null,
        review_count: 0,
        created_at: r.created_at,
        description: r.description?.trim() || null,
        description_source: r.description?.trim() ? "manual" : null,
        description_url: null,
        release_type: r.release_type,
        genius_id: r.genius_id,
        spotify_url: spotifyUrlFor(r),
        reason: null,
      },
      artistKey: r.primary_artist_id ?? artistName.toLowerCase(),
      releaseKey: r.id,
      taste: affinityFor(profile, r.primary_artist_id, artistName),
      // Same starvation fix posts got: real follows lead, freshness
      // (0..1) is the tiebreaker so a zero-follow release still scores
      // above zero instead of being eaten by the `score <= 0` guard.
      popularity:
        (followCounts.get(r.id) ?? 0) +
        Math.pow(0.5, age / FRESH_HALF_LIFE_DAYS),
      // rawPop = real follows only, same rule as posts: the freshness
      // pad keeps a release scoreable but can't earn it a chip.
      rawPop: followCounts.get(r.id) ?? 0,
      reasonIsFollow: false,
      ageDays: age,
      reason: r.primary_artist_id
        ? profile.reasonByArtistId.get(r.primary_artist_id) ?? null
        : null,
    });
  }

  /* ── Hard filter: real negative affinity means the viewer told us
     they DON'T want this artist (a sub-5 rating goes negative; one bad
     album alone sits at −2 and only repeat offenders sink past it).
     The 30% popularity half of the blend could otherwise float a hated
     artist back into the feed — filter, don't just downrank. −1, not 0,
     so a mild single-signal dip doesn't erase an artist forever. ── */
  const scored = candidates.filter((c) => c.taste > -1);

  /* ── Score: 70% taste / 30% popularity, normalized per content type
     so no pool's raw scale dominates. Per-type maxima in ONE pre-pass
     (two small Maps) instead of the old per-candidate maxBy scan —
     same numbers, O(n) not O(n²). ── */
  const maxTaste = new Map<string, number>();
  const maxPop = new Map<string, number>();
  for (const c of scored) {
    const t = c.item.type;
    // Taste normalizes over max(0, taste) — negatives clamp to 0 here
    // exactly like the old maxBy did.
    maxTaste.set(t, Math.max(maxTaste.get(t) ?? 1e-9, Math.max(0, c.taste)));
    maxPop.set(t, Math.max(maxPop.get(t) ?? 1e-9, c.popularity));
  }

  /* Cold start is a FADE, not a switch: w slides 0→1 over the first
     ten signals, blending from pure popularity toward the full 70/30
     taste mix. The old binary (3 signals flipped it all at once) made
     one follow whiplash the whole feed. */
  const w = Math.min(1, profile.signalCount / 10);

  /* Day-seed jitter: ±15% deterministic noise, keyed on viewer + the
     day in EASTERN time (en-CA formats as YYYY-MM-DD; midnight Eastern
     is the site-wide day boundary, same as release drops) + the item's
     stable key. The feed reshuffles a little every midnight, stays
     rock-solid within a day, and differs between viewers — without a
     single byte of stored state. */
  const dayKey = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/New_York",
  });
  const seen = new Set(opts?.seenKeys ?? []);

  for (const c of scored) {
    const tasteNorm = Math.max(0, c.taste) / (maxTaste.get(c.item.type) ?? 1e-9);
    const popNorm = c.popularity / (maxPop.get(c.item.type) ?? 1e-9);
    const base = w * (0.7 * tasteNorm + 0.3 * popNorm) + (1 - w) * popNorm;
    const fresh = Math.pow(0.5, c.ageDays / FRESH_HALF_LIFE_DAYS);
    // Freshness scales the score but never zeroes it — an old item the
    // viewer would love still beats a new one they wouldn't.
    c.score = base * (0.4 + 0.6 * fresh);

    const key = tunedKeyOf(c.item);
    // hash01 ∈ [0,1) → multiplier ∈ [0.85, 1.15).
    c.score *= 0.85 + 0.3 * hash01(`${viewerId}|${dayKey}|${key}`);
    // Watched recently (client cookie) → strong downrank, never an
    // exclusion — see the seenKeys opt comment.
    if (seen.has(key)) c.score *= 0.35;

    // Reason chips gate on ABSOLUTE values now, not per-type ratios —
    // "because you liked X" over a 0.4-affinity blip was a lie the
    // normalized threshold used to tell when the pool was weak:
    //   - follow reasons always earn their chip (explicit signal);
    //   - affinity reasons need real weight (>= 2 = a 10/10 rating or
    //     an artist follow, not residue);
    //   - "popular right now" needs 3+ REAL interactions (rawPop has
    //     no freshness pads), else no chip at all.
    c.item.reason =
      (c.reasonIsFollow || c.taste >= 2) && c.reason
        ? c.reason
        : c.rawPop >= 3
          ? "popular right now"
          : null;
  }

  /* ── Greedy pick with diversity guards. Collects CANDIDATES (not
     bare items) because the interleave below still needs scores. ── */
  scored.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  const pickedCands: Candidate[] = [];
  const perArtist = new Map<string, number>();
  const perType = new Map<string, number>();
  // One card per RELEASE across all types: a review of an album, a post
  // about it, a debate over it, and its premiere card are four takes on
  // the same thing — the broadcast airs only the strongest one.
  const pickedReleases = new Set<string>();
  for (const c of scored) {
    if (pickedCands.length >= TUNED_MAX_ITEMS) break;
    if ((c.score ?? 0) <= 0) continue;
    if ((perArtist.get(c.artistKey) ?? 0) >= TUNED_MAX_PER_ARTIST) continue;
    if ((perType.get(c.item.type) ?? 0) >= TUNED_MAX_PER_TYPE) continue;
    if (c.releaseKey && pickedReleases.has(c.releaseKey)) continue;
    pickedCands.push(c);
    perArtist.set(c.artistKey, (perArtist.get(c.artistKey) ?? 0) + 1);
    perType.set(c.item.type, (perType.get(c.item.type) ?? 0) + 1);
    if (c.releaseKey) pickedReleases.add(c.releaseKey);
  }

  /* ── Type interleave: the greedy pick decides WHAT airs, this decides
     the RUNNING ORDER. Pure score order tends to clump (three reviews
     in a row, then three releases) — channel surfing should alternate
     formats. Queue per type in picked (score) order, then round-robin:
     always take the highest-scored head among the non-empty queues,
     skipping the type we just aired whenever ANY other queue still has
     items. Slot 1 stays the global top pick (first pass has no
     last-type to skip), and within-type order is preserved (queues
     only ever pop from the front). ── */
  const queues = new Map<TunedItem["type"], Candidate[]>();
  for (const c of pickedCands) {
    const q = queues.get(c.item.type);
    if (q) q.push(c);
    else queues.set(c.item.type, [c]);
  }
  const ordered: Candidate[] = [];
  let lastType: TunedItem["type"] | null = null;
  while (ordered.length < pickedCands.length) {
    let bestType: TunedItem["type"] | null = null;
    let best: Candidate | null = null;
    for (const [t, q] of queues) {
      if (q.length === 0 || t === lastType) continue;
      if (!best || (q[0].score ?? 0) > (best.score ?? 0)) {
        best = q[0];
        bestType = t;
      }
    }
    if (!best || bestType === null) {
      // Only the just-aired type has anything left — back-to-back is
      // allowed when it's the sole option (e.g. a review-heavy mix).
      bestType = lastType!;
      best = queues.get(bestType)![0];
    }
    queues.get(bestType)!.shift();
    ordered.push(best);
    lastType = bestType;
  }
  const picked: TunedItem[] = ordered.map((c) => c.item);

  /* ── Post-pick enrichment, PICKED release cards only (≤6, never the
     whole 30-candidate pool). Two independent jobs share one
     Promise.all so they run in parallel:
       1. Synopses — manual → Genius → Wikipedia via lib/descriptions,
          30-day cached, timeout-guarded. The blurb is the enticement
          to tap (Luca 2026-08-22).
       2. Community stats — get_release_stats RPC per picked release
          for the Premiere card's "COMMUNITY: {avg} FROM {n} REVIEWS"
          line. Timeout-guarded here (the RPC helper itself only
          swallows errors): a slow RPC loses the stats line, never
          delays the feed. ── */
  const RPC_TIMEOUT_MS = 2_500;
  await Promise.all(
    picked.flatMap((item) => {
      if (item.type !== "release") return [];
      const jobs: Promise<void>[] = [];
      if (!item.description) {
        jobs.push(
          getReleaseDescription({
            title: item.title,
            release_type: item.release_type,
            genius_id: item.genius_id,
            description: null,
            artistName: item.artist,
            firstTrack: firstTrackBySlug.get(item.slug) ?? null,
          })
            .then((desc) => {
              if (desc) {
                item.description = desc.text;
                item.description_source = desc.source;
                item.description_url = desc.url;
              }
            })
            .catch(() => {})
        );
      }
      const releaseId = releaseIdBySlug.get(item.slug);
      if (releaseId) {
        jobs.push(
          Promise.race([
            getReleaseStats(releaseId),
            // Losing the race just leaves the defaults (null/0) — the
            // card hides its community line, nothing breaks.
            new Promise<null>((resolve) =>
              setTimeout(() => resolve(null), RPC_TIMEOUT_MS)
            ),
          ])
            .then((stats) => {
              if (stats) {
                item.avg_rating = stats.avg_rating;
                item.review_count = stats.review_count;
              }
            })
            .catch(() => {})
        );
      }
      return jobs;
    }),
  );

  return picked;
}
