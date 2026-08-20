import { createClient } from "@/lib/supabase/server";
import type { Profile, Release, Review } from "@/lib/types/database";

/** Profile fields we join onto review rows for attribution. */
export interface ReviewAuthor {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: Profile["role"];
}

export type ReviewWithAuthor = Review & { profiles: ReviewAuthor };

/**
 * One review looked up by its (globally unique) slug, with the author
 * profile and the attached release joined in. Drafts are only returned
 * to their owner — pass viewerId so the check happens in one query path.
 */
export async function getReviewWithContextBySlug(
  slug: string,
  viewerId?: string
): Promise<(ReviewWithAuthor & { releases: Release | null }) | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select(
      // profiles must be joined VIA reviews_user_id_fkey: since
      // migration 006 added profiles.featured_review_id there are TWO
      // relationships between reviews and profiles, and an unqualified
      // embed makes PostgREST error out (PGRST201) instead of guessing.
      "*, profiles!reviews_user_id_fkey!inner(username, display_name, avatar_url, role), releases(*)"
    )
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as ReviewWithAuthor & {
    releases: Release | Release[] | null;
  };

  // Drafts are private to their author.
  if (!row.is_published && row.user_id !== viewerId) return null;

  return {
    ...row,
    releases: Array.isArray(row.releases) ? row.releases[0] ?? null : row.releases,
  };
}

/**
 * True if a review slug is already taken. Used by the API to pick a
 * unique slug (`x-by-user`, `x-by-user-2`, …) at creation time.
 */
export async function reviewSlugTaken(slug: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("id")
    .eq("slug", slug)
    .limit(1)
    .maybeSingle();
  return !!data;
}

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
    .select(
      "*, profiles!reviews_user_id_fkey!inner(username, display_name, avatar_url, role)"
    )
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
      "*, profiles!reviews_user_id_fkey!inner(username, display_name, avatar_url, role), review_likes(count), releases(slug)"
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
