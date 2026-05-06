import { createClient } from "@/lib/supabase/server";
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
    .select("*, profiles!inner(username, display_name, avatar_url, role)")
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

export async function listReleases(opts?: {
  sort?: "recent" | "popularity" | "alpha";
  limit?: number;
  offset?: number;
  artistId?: string;
}): Promise<Release[]> {
  const supabase = await createClient();
  const sort = opts?.sort ?? "recent";
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  let query = supabase.from("releases").select("*");

  if (opts?.artistId) {
    query = query.eq("primary_artist_id", opts.artistId);
  }

  switch (sort) {
    case "recent":
      query = query.order("release_date", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "popularity":
      query = query.order("popularity", {
        ascending: false,
        nullsFirst: false,
      });
      break;
    case "alpha":
      query = query.order("title", { ascending: true });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Release[];
}
