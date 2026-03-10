import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { updateComment, deleteComment } from "@/lib/db/comments";

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
  const success = await deleteComment(commentId, user.id);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to delete comment or not authorized" },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true });
}
