import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { likeReview } from "@/lib/db/reviews";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

/**
 * POST /api/reviews/[reviewId]/like — Toggle like on a review.
 * Returns updated like count and whether user has liked.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Max 30 like toggles per user per minute.
  const limited = await rateLimit(`like:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const { reviewId } = await params;

  if (!isUuid(reviewId)) {
    return NextResponse.json(
      { error: "reviewId must be a valid id" },
      { status: 400 }
    );
  }

  const result = await likeReview(user.id, reviewId);

  return NextResponse.json(result);
}
