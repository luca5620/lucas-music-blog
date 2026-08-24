import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { likePost } from "@/lib/db/posts";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

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

  const result = await likePost(user.id, postId);

  return NextResponse.json(result);
}
