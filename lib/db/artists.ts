import { createClient } from "@/lib/supabase/server";
import type {
  Artist,
  ArtistStats,
  Profile,
  Release,
} from "@/lib/types/database";

export async function getArtistBySlug(slug: string): Promise<Artist | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as Artist;
}

export async function getArtistById(id: string): Promise<Artist | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Artist;
}

export async function getArtistBySpotifyId(
  spotifyId: string
): Promise<Artist | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .eq("spotify_id", spotifyId)
    .single();

  if (error || !data) return null;
  return data as Artist;
}

export async function getArtistReleases(artistId: string): Promise<Release[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("releases")
    .select("*")
    .eq("primary_artist_id", artistId)
    .order("release_date", { ascending: false, nullsFirst: false });

  if (error || !data) return [];
  return data as Release[];
}

export async function getArtistFollowers(
  artistId: string,
  limit = 12
): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artist_follows")
    .select("profiles!inner(*)")
    .eq("artist_id", artistId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type Row = { profiles: Profile | Profile[] | null };
  return (data as unknown as Row[])
    .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles))
    .filter((p): p is Profile => !!p);
}

export async function getArtistStats(artistId: string): Promise<ArtistStats> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_artist_stats", {
    artist_uuid: artistId,
  } as never);

  if (error || !data) {
    return { follower_count: 0, release_count: 0, review_count: 0 };
  }

  // SQL set-returning function returns an array of one row
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return { follower_count: 0, release_count: 0, review_count: 0 };
  }

  const r = row as {
    follower_count: number | null;
    release_count: number | null;
    review_count: number | null;
  };
  return {
    follower_count: r.follower_count ?? 0,
    release_count: r.release_count ?? 0,
    review_count: r.review_count ?? 0,
  };
}

export async function followArtist(
  userId: string,
  artistId: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("artist_follows")
    .upsert(
      { follower_id: userId, artist_id: artistId } as never,
      { onConflict: "follower_id,artist_id", ignoreDuplicates: true }
    );
}

export async function unfollowArtist(
  userId: string,
  artistId: string
): Promise<void> {
  const supabase = await createClient();
  await supabase
    .from("artist_follows")
    .delete()
    .eq("follower_id", userId)
    .eq("artist_id", artistId);
}

export async function isFollowingArtist(
  userId: string,
  artistId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("artist_follows")
    .select("id")
    .eq("follower_id", userId)
    .eq("artist_id", artistId)
    .single();

  return !!data;
}

export async function searchArtists(
  query: string,
  limit = 10
): Promise<Artist[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("artists")
    .select("*")
    .ilike("name", `%${query}%`)
    .order("popularity", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error || !data) return [];
  return data as Artist[];
}

export async function upsertArtist(
  input: Omit<Artist, "id" | "created_at" | "updated_at">
): Promise<Artist> {
  const supabase = await createClient();
  const onConflict = input.spotify_id ? "spotify_id" : "slug";

  const { data, error } = await supabase
    .from("artists")
    .upsert(input as never, { onConflict })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `upsertArtist failed: ${error?.message ?? "no data returned"}`
    );
  }
  return data as Artist;
}

export async function listArtists(opts?: {
  sort?: "popularity" | "recent" | "alpha";
  limit?: number;
  offset?: number;
}): Promise<Artist[]> {
  const supabase = await createClient();
  const sort = opts?.sort ?? "popularity";
  const limit = opts?.limit ?? 20;
  const offset = opts?.offset ?? 0;

  let query = supabase.from("artists").select("*");

  switch (sort) {
    case "popularity":
      query = query.order("popularity", { ascending: false, nullsFirst: false });
      break;
    case "recent":
      query = query.order("created_at", { ascending: false });
      break;
    case "alpha":
      query = query.order("name", { ascending: true });
      break;
  }

  query = query.range(offset, offset + limit - 1);

  const { data, error } = await query;
  if (error || !data) return [];
  return data as Artist[];
}
