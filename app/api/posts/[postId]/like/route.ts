import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { likePost } from "@/lib/db/posts";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { createNotification } from "@/lib/db/notifications";
import { BLOCKED_ACTION_ERROR, isBlockedBy } from "@/lib/db/moderation";

/**
 * POST /api/posts/[postId]/like — Toggle like on a post.
 * Returns updated like count and whether user has liked.
 * Mirrors /api/reviews/[reviewId]/like.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Shares the review-like bucket: 30 like toggles per user per minute
  // across both content types.
  const limited = await rateLimit(`like:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const { postId } = await params;

  if (!isUuid(postId)) {
    return NextResponse.json(
      { error: "postId must be a valid id" },
      { status: 400 }
    );
  }

  // The post's author, looked up before the toggle for the block check
  // (and reused for the notification).
  const { data: postRow } = await supabase
    .from("posts")
    .select("user_id, slug, title")
    .eq("id", postId)
    .maybeSingle();
  const p = postRow as
    | { user_id: string; slug: string; title: string }
    | null;

  // Blocked by the author → no new like; un-liking stays allowed
  // (same rule as the review-like route).
  if (p && (await isBlockedBy(p.user_id))) {
    const { data: mine } = await supabase
      .from("post_likes")
      .select("id")
      .eq("user_id", user.id)
      .eq("post_id", postId)
      .maybeSingle();
    if (!mine) {
      return NextResponse.json({ error: BLOCKED_ACTION_ERROR }, { status: 403 });
    }
  }

  const result = await likePost(user.id, postId);

  // A LIKE rings the author's bell (see the review-like route).
  if (result.liked) {
    if (p) {
      await createNotification({
        recipientId: p.user_id,
        actorId: user.id,
        type: "post_like",
        href: `/posts/${p.slug}`,
        title: p.title,
      });
    }
  }

  return NextResponse.json(result);
}
