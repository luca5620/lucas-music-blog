import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createComment } from "@/lib/db/comments";

export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { reviewId, content, parentId } = body;

  if (!reviewId || !content?.trim()) {
    return NextResponse.json(
      { error: "reviewId and content are required" },
      { status: 400 }
    );
  }

  const comment = await createComment(
    user.id,
    reviewId,
    content.trim(),
    parentId || undefined
  );

  if (!comment) {
    return NextResponse.json(
      { error: "Failed to create comment" },
      { status: 500 }
    );
  }

  return NextResponse.json(comment, { status: 201 });
}
