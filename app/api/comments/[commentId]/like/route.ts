import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { likeComment } from "@/lib/db/comments";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

/**
 * POST /api/comments/[commentId]/like — Toggle the viewer's like on
 * a comment (Luca's universal-like pass, migration 030). Returns the
 * updated like count and whether the viewer now likes it — the same
 * contract as the review/post like routes so the UI code matches.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Shares the review-like budget: 30 toggles per user per minute.
  const limited = await rateLimit(`like:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const { commentId } = await params;

  if (!isUuid(commentId)) {
    return NextResponse.json(
      { error: "commentId must be a valid id" },
      { status: 400 }
    );
  }

  const result = await likeComment(user.id, commentId);

  // null = comment_likes table missing (migration 030 not run yet) or
  // a write failure — tell the client to keep the old state.
  if (!result) {
    return NextResponse.json(
      { error: "Comment likes aren't available right now." },
      { status: 503 }
    );
  }

  return NextResponse.json(result);
}
