import { createClient } from "@/lib/supabase/server";

export interface CommentWithProfile {
  id: string;
  user_id: string;
  review_id: string;
  parent_id: string | null;
  content: string;
  created_at: string;
  updated_at: string;
  profiles: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
}

/**
 * Fetch all comments for a review, joined with profile data.
 * Ordered by created_at ascending.
 */
export async function getCommentsByReview(
  reviewId: string
): Promise<CommentWithProfile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .select(
      "id, user_id, review_id, parent_id, content, created_at, updated_at, profiles(username, display_name, avatar_url)"
    )
    .eq("review_id", reviewId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching comments:", error);
    return [];
  }

  return (data as unknown as CommentWithProfile[]) ?? [];
}

/**
 * Insert a new comment.
 */
export async function createComment(
  userId: string,
  reviewId: string,
  content: string,
  parentId?: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .insert({
      user_id: userId,
      review_id: reviewId,
      content,
      ...(parentId ? { parent_id: parentId } : {}),
    } as never)
    .select(
      "id, user_id, review_id, parent_id, content, created_at, updated_at, profiles(username, display_name, avatar_url)"
    )
    .single();

  if (error) {
    console.error("Error creating comment:", error);
    return null;
  }

  return data as unknown as CommentWithProfile;
}

/**
 * Update own comment.
 */
export async function updateComment(
  commentId: string,
  userId: string,
  content: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("comments")
    .update({ content, updated_at: new Date().toISOString() } as never)
    .eq("id", commentId)
    .eq("user_id", userId)
    .select(
      "id, user_id, review_id, parent_id, content, created_at, updated_at, profiles(username, display_name, avatar_url)"
    )
    .single();

  if (error) {
    console.error("Error updating comment:", error);
    return null;
  }

  return data as unknown as CommentWithProfile;
}

/**
 * Delete own comment.
 */
export async function deleteComment(commentId: string, userId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", userId);

  if (error) {
    console.error("Error deleting comment:", error);
    return false;
  }

  return true;
}

/**
 * Get comment count for a review.
 */
export async function getCommentCount(reviewId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("comments")
    .select("id", { count: "exact", head: true })
    .eq("review_id", reviewId);

  if (error) {
    console.error("Error counting comments:", error);
    return 0;
  }

  return count ?? 0;
}
