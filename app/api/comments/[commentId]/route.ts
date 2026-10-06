import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateComment, deleteComment } from "@/lib/db/comments";
import type { Profile } from "@/lib/types/database";
import { checkContentLocalized } from "@/lib/content-filter";
import { rateLimit } from "@/lib/rate-limit";
import { isText, isUuid } from "@/lib/validate";

// Same ceiling as POST /api/comments — an edit can't sneak past the
// length rule that creating the comment had to obey.
const MAX_COMMENT_LENGTH = 2000;

/**
 * PUT /api/comments/[commentId] — edit your own comment.
 * Body: { content }
 *
 * Ownership is enforced twice: updateComment filters on the caller's
 * id, and RLS only lets an author update their own row.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Edits are rarer than new comments — 20 a minute is plenty for
  // someone fixing typos, and nowhere near a write-flood.
  const limited = await rateLimit(`comments-edit:${user.id}`, 20, 60_000);
  if (limited) return limited;

  const { commentId } = await params;
  if (!isUuid(commentId)) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
  }

  // A malformed body is a 400, not an unhandled throw (which Next
  // would turn into a bare 500).
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { content } = (body ?? {}) as { content?: unknown };

  if (typeof content !== "string" || !content.trim()) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }
  if (!isText(content.trim(), MAX_COMMENT_LENGTH)) {
    return NextResponse.json(
      { error: `Comment is too long (max ${MAX_COMMENT_LENGTH} characters)` },
      { status: 400 }
    );
  }

  // Zero-tolerance filter (App Store 1.2) — slurs never hit the DB.
  const dirty = await checkContentLocalized(content);
  if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

  const comment = await updateComment(commentId, user.id, content.trim());

  if (!comment) {
    return NextResponse.json(
      { error: "Failed to update comment or not authorized" },
      { status: 404 }
    );
  }

  return NextResponse.json(comment);
}

/**
 * DELETE /api/comments/[commentId] — delete your own comment (or any
 * comment, for staff).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Deletes share the edit bucket. Staff clearing a spam wave get 20 a
  // minute — fast for a human, and still a wall for a runaway script.
  const limited = await rateLimit(`comments-edit:${user.id}`, 20, 60_000);
  if (limited) return limited;

  const { commentId } = await params;
  if (!isUuid(commentId)) {
    return NextResponse.json({ error: "Invalid comment id" }, { status: 400 });
  }

  // Staff (owner/admin) may delete ANY comment — moderation without
  // waiting for a report. Same role gate as /api/admin/reports; the
  // DB's 007 admin-delete policy backs it up at the RLS layer.
  const supabase = await createClient();
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;
  const asStaff = role === "owner" || role === "admin";

  const success = await deleteComment(commentId, user.id, { asStaff });

  if (!success) {
    return NextResponse.json(
      { error: "Failed to delete comment or not authorized" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
