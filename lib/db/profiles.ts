import { createClient } from "@/lib/supabase/server";
import type { Profile, ProfileStats } from "@/lib/types/database";

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
