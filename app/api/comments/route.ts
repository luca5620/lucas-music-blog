import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createComment } from "@/lib/db/comments";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { checkContent } from "@/lib/content-filter";

// UUIDs only — anything else is rejected before touching the database.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const MAX_COMMENT_LENGTH = 2000;

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Max 10 comments per user per minute.
  const limited = await rateLimit(`comments:${user.id}`, 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { reviewId, content, parentId } = body as {
    reviewId?: unknown;
    content?: unknown;
    parentId?: unknown;
  };

  // --- Validate shape and sizes ---
  if (typeof reviewId !== "string" || !UUID_RE.test(reviewId)) {
    return NextResponse.json({ error: "Invalid reviewId" }, { status: 400 });
  }
  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json({ error: "Content is required" }, { status: 400 });
  }
  if (content.trim().length > MAX_COMMENT_LENGTH) {
    return NextResponse.json(
      { error: `Comment is too long (max ${MAX_COMMENT_LENGTH} characters)` },
      { status: 400 }
    );
  }
  if (
    parentId !== undefined &&
    parentId !== null &&
    (typeof parentId !== "string" || !UUID_RE.test(parentId))
  ) {
    return NextResponse.json({ error: "Invalid parentId" }, { status: 400 });
  }

  // Zero-tolerance filter (App Store 1.2) — slurs never hit the DB.
  const dirty = checkContent(content);
  if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

  const supabase = await createClient();

  // The review must exist and be visible to the commenter.
  const { data: reviewRow } = await supabase
    .from("reviews")
    .select("id, is_published, user_id")
    .eq("id", reviewId)
    .maybeSingle();
  const review = reviewRow as
    | { id: string; is_published: boolean; user_id: string }
    | null;
  if (!review || (!review.is_published && review.user_id !== user.id)) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  // If replying, the parent comment must belong to the SAME review —
  // otherwise a reply could be grafted onto an unrelated thread.
  if (parentId) {
    const { data: parentRow } = await supabase
      .from("comments")
      .select("id, review_id")
      .eq("id", parentId)
      .maybeSingle();
    const parent = parentRow as { id: string; review_id: string } | null;
    if (!parent || parent.review_id !== reviewId) {
      return NextResponse.json({ error: "Invalid parent comment" }, { status: 400 });
    }
  }

  const comment = await createComment(
    user.id,
    reviewId,
    content.trim(),
    (parentId as string | null | undefined) || undefined
  );

  if (!comment) {
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }

  return NextResponse.json(comment, { status: 201 });
}
