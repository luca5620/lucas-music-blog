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
/**
 * Delete a comment. Normal callers only ever match their own rows
 * (the user_id filter); staff (owner/admin — the API route verifies
 * the role) skip that filter and can remove ANY comment, authorized
 * at the DB layer by 007's "Admins can delete any comment" policy.
 *
 * Returns true only when a row was ACTUALLY deleted — the returning
 * select distinguishes "deleted" from "matched nothing" (a 0-row
 * delete is not an error in PostgREST).
 */
export async function deleteComment(
  commentId: string,
  userId: string,
  opts?: { asStaff?: boolean }
) {
  const supabase = await createClient();
  let query = supabase.from("comments").delete().eq("id", commentId);
  if (!opts?.asStaff) {
    query = query.eq("user_id", userId);
  }
  const { data, error } = await query.select("id");

  if (error) {
    console.error("Error deleting comment:", error);
    return false;
  }

  return (data ?? []).length > 0;
}

/**
 * Toggle the viewer's like on a comment (migration 030). Mirrors
 * likeReview: flip the row, then return the fresh count + state.
 * Pre-migration the table doesn't exist — the API route surfaces
 * that as a 503 and the UI simply hides hearts.
 */
export async function likeComment(
  userId: string,
  commentId: string
): Promise<{ liked: boolean; count: number } | null> {
  const supabase = await createClient();

  const { data: existing, error: readError } = await supabase
    .from("comment_likes")
    .select("id")
    .eq("user_id", userId)
    .eq("comment_id", commentId)
    .maybeSingle();

  // Table missing (pre-migration) or other read failure — bail.
  if (readError) {
    console.error("Error reading comment like:", readError);
    return null;
  }

  if (existing) {
    await supabase
      .from("comment_likes")
      .delete()
      .eq("user_id", userId)
      .eq("comment_id", commentId);
  } else {
    const { error } = await supabase
      .from("comment_likes")
      .insert({ user_id: userId, comment_id: commentId } as never);
    if (error) {
      console.error("Error liking comment:", error);
      return null;
    }
  }

  const { count } = await supabase
    .from("comment_likes")
    .select("id", { count: "exact", head: true })
    .eq("comment_id", commentId);

  return { liked: !existing, count: count ?? 0 };
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
