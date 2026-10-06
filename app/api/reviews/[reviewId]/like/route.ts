import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { likeReview } from "@/lib/db/reviews";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { createNotification } from "@/lib/db/notifications";
import { BLOCKED_ACTION_ERROR, isBlockedBy } from "@/lib/db/moderation";

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

  // The review's author — looked up BEFORE the toggle now, because the
  // block check below needs it (and the notification after reuses it).
  const { data: reviewRow } = await supabase
    .from("reviews")
    .select("user_id, slug, title")
    .eq("id", reviewId)
    .maybeSingle();
  const r = reviewRow as
    | { user_id: string; slug: string; title: string }
    | null;

  // Blocked by the author? Then no NEW like (migration 052). Taking an
  // old like back is still allowed — that only moves things the way
  // the blocker wants — so we only refuse when there's no like yet.
  if (r && (await isBlockedBy(r.user_id))) {
    const { data: mine } = await supabase
      .from("review_likes")
      .select("id")
      .eq("user_id", user.id)
      .eq("review_id", reviewId)
      .maybeSingle();
    if (!mine) {
      return NextResponse.json({ error: BLOCKED_ACTION_ERROR }, { status: 403 });
    }
  }

  const result = await likeReview(user.id, reviewId);

  // A LIKE rings the author's bell; an unlike never does. The unique
  // index behind createNotification (052) keeps like/unlike loops from
  // refilling it.
  if (result.liked) {
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
