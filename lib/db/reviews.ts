import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/types/database";

export async function getReviewsByUser(
  userId: string,
  options?: { includeUnpublished?: boolean }
) {
  const supabase = await createClient();
  let query = supabase
    .from("reviews")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!options?.includeUnpublished) {
    query = query.eq("is_published", true);
  }

  const { data, error } = await query;
  if (error) return [];
  return data as Review[];
}

export async function getReviewBySlug(
  userId: string,
  slug: string
): Promise<Review | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("user_id", userId)
    .eq("slug", slug)
    .single();

  if (error || !data) return null;
  return data as Review;
}

export async function getAllPublishedReviews(options?: {
  genre?: string;
  limit?: number;
  offset?: number;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("reviews")
    .select("*, profiles!inner(username, display_name, avatar_url, role)")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (options?.genre) {
    query = query.eq("genre", options.genre);
  }

  if (options?.offset) {
    query = query.range(
      options.offset,
      options.offset + (options.limit ?? 20) - 1
    );
  } else if (options?.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;
  if (error) return [];
  return data;
}

export async function createReview(
  reviewData: Omit<Review, "id" | "created_at" | "updated_at">
): Promise<Review | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .insert(reviewData as never)
    .select()
    .single();

  if (error || !data) return null;
  return data as Review;
}

export async function updateReview(
  id: string,
  updates: Partial<Omit<Review, "id" | "user_id" | "created_at">>
): Promise<Review | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .update({ ...updates, updated_at: new Date().toISOString() } as never)
    .eq("id", id)
    .select()
    .single();

  if (error || !data) return null;
  return data as Review;
}

export async function deleteReview(id: string): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("reviews").delete().eq("id", id);
  return !error;
}

export async function likeReview(
  userId: string,
  reviewId: string
): Promise<{ liked: boolean; count: number }> {
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("review_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("review_id", reviewId)
    .single();

  if (existing) {
    await supabase
      .from("review_likes")
      .delete()
      .eq("user_id", userId)
      .eq("review_id", reviewId);
  } else {
    await supabase
      .from("review_likes")
      .insert({ user_id: userId, review_id: reviewId } as never);
  }

  const { count } = await supabase
    .from("review_likes")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId);

  return {
    liked: !existing,
    count: count ?? 0,
  };
}

export async function getReviewLikes(reviewId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("review_likes")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId);

  return count ?? 0;
}

export async function hasUserLiked(
  userId: string,
  reviewId: string
): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("review_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("review_id", reviewId)
    .single();

  return !!data;
}

/**
 * Discovery feed — recent published reviews across all users,
 * with profile data (username, display_name, avatar, role) plus
 * like_count and viewer_has_liked for the like UI.
 */
export async function getDiscoveryFeed(limit = 12, viewerId?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      "*, profiles!inner(username, display_name, avatar_url, role), review_likes(count)"
    )
    .eq("is_published", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  type RawRow = Record<string, unknown> & {
    id: string;
    review_likes?: { count: number }[] | null;
  };
  const rows = data as RawRow[];
  const reviewIds = rows.map((r) => r.id);

  let likedSet = new Set<string>();
  if (viewerId && reviewIds.length > 0) {
    const { data: likesData } = await supabase
      .from("review_likes")
      .select("review_id")
      .eq("user_id", viewerId)
      .in("review_id", reviewIds);
    if (likesData) {
      likedSet = new Set(
        (likesData as { review_id: string }[]).map((r) => r.review_id)
      );
    }
  }

  return rows.map((row) => {
    const { review_likes, ...rest } = row;
    const like_count = Array.isArray(review_likes)
      ? review_likes[0]?.count ?? 0
      : 0;
    return {
      ...rest,
      like_count,
      viewer_has_liked: likedSet.has(row.id),
    };
  });
}
