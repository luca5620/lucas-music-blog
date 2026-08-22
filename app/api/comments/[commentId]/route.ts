import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { updateComment, deleteComment } from "@/lib/db/comments";
import type { Profile } from "@/lib/types/database";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;
  const body = await request.json();
  const { content } = body;

  if (!content?.trim()) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }

  const comment = await updateComment(commentId, user.id, content.trim());

  if (!comment) {
    return NextResponse.json(
      { error: "Failed to update comment or not authorized" },
      { status: 404 }
    );
  }

  return NextResponse.json(comment);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ commentId: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { commentId } = await params;

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
