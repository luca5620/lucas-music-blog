import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { likeReview } from "@/lib/db/reviews";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { createNotification } from "@/lib/db/notifications";

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

  // A LIKE rings the author's bell; an unlike never does. Dedup in
  // createNotification keeps like/unlike loops from refilling it.
  if (result.liked) {
    const { data: reviewRow } = await supabase
      .from("reviews")
      .select("user_id, slug, title")
      .eq("id", reviewId)
      .maybeSingle();
    const r = reviewRow as
      | { user_id: string; slug: string; title: string }
      | null;
    if (r) {
      await createNotification({
        recipientId: r.user_id,
        actorId: user.id,
        type: "review_like",
        href: `/reviews/${r.slug}`,
        title: r.title,
      });
    }
  }

  return NextResponse.json(result);
}
