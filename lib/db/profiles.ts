import { createClient } from "@/lib/supabase/server";
import type {
  Profile,
  ProfileFavorite,
  ProfileStats,
} from "@/lib/types/database";

export async function getProfileByUsername(
  username: string
): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function getProfileById(id: string): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function updateProfile(
  id: string,
  updates: Partial<Omit<Profile, "id" | "created_at">>
): Promise<Profile | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return data as Profile;
}

export async function getProfileReviews(userId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error) return [];
  return data;
}

export async function getProfileStats(
  userId: string
): Promise<ProfileStats> {
  const supabase = await createClient();

  const [reviewsRes, followersRes, followingRes] = await Promise.all([
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_published", true),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("following_id", userId),
    supabase
      .from("follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", userId),
  ]);

  return {
    review_count: reviewsRes.count ?? 0,
    follower_count: followersRes.count ?? 0,
    following_count: followingRes.count ?? 0,
    total_likes_received: 0,
  };
}

export async function isFollowing(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("follows")
    .select("id")
    .eq("follower_id", followerId)
    .eq("following_id", followingId)
    .single();

  return !!data;
}

export async function followUser(
  followerId: string,
  followingId: string
): Promise<boolean> {
  if (followerId === followingId) return false;

  const supabase = await createClient();
  const { error } = await supabase
    .from("follows")
    .insert({ follower_id: followerId, following_id: followingId } as never);

  return !error;
}

export async function unfollowUser(
  followerId: string,
  followingId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("follows")
    .delete()
    .eq("follower_id", followerId)
    .eq("following_id", followingId);

  return !error;
}

/* ============================================
   Four Favorites — the Letterboxd-style showcase (migration 004).
   One row per slot (position 1–4), unique on (user_id, position).
   ============================================ */

/** A user's favorites, ordered by slot (1 → 4). Public read via RLS. */
export async function getProfileFavorites(
  userId: string
): Promise<ProfileFavorite[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profile_favorites")
    .select("*")
    .eq("user_id", userId)
    .order("position", { ascending: true });

  if (error || !data) return [];
  return data as ProfileFavorite[];
}

/** What the favorites API accepts for each slot. */
export interface FavoriteInput {
  position: number; // 1–4
  title: string;
  artist: string;
  cover_image?: string | null;
  release_id?: string | null;
}

/**
 * Replace the user's favorites with exactly this set:
 * 1. delete slots that are no longer in the new set
 * 2. upsert the rest on (user_id, position)
 * The caller (API route) validates everything and supplies userId
 * from the SESSION; RLS enforces ownership again at the DB level.
 * Returns the saved rows (ordered by slot), or null on failure.
 */
export async function replaceProfileFavorites(
  userId: string,
  favorites: FavoriteInput[]
): Promise<ProfileFavorite[] | null> {
  const supabase = await createClient();

  // Step 1: clear out removed slots. If the new set is empty this
  // deletes everything; otherwise only the positions NOT kept.
  const keptPositions = favorites.map((f) => f.position);
  let deleteQuery = supabase
    .from("profile_favorites")
    .delete()
    .eq("user_id", userId);
  if (keptPositions.length > 0) {
    // .not("position", "in", "(1,2)") — positions are validated
    // integers, so interpolating them into the filter is safe.
    deleteQuery = deleteQuery.not(
      "position",
      "in",
      `(${keptPositions.join(",")})`
    );
  }
  const { error: deleteError } = await deleteQuery;
  if (deleteError) return null;

  if (favorites.length === 0) return [];

  // Step 2: upsert the kept slots — the unique (user_id, position)
  // constraint turns re-saves of an existing slot into updates.
  const rows = favorites.map((f) => ({
    user_id: userId,
    position: f.position,
    title: f.title,
    artist: f.artist,
    cover_image: f.cover_image ?? null,
    release_id: f.release_id ?? null,
  }));

  const { data, error } = await supabase
    .from("profile_favorites")
    .upsert(rows as never, { onConflict: "user_id,position" })
    .select();

  if (error || !data) return null;
  return (data as ProfileFavorite[]).sort((a, b) => a.position - b.position);
}
