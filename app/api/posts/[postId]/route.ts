import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getPostById, deletePost } from "@/lib/db/posts";
import { isUuid } from "@/lib/validate";
import type { Profile } from "@/lib/types/database";

/**
 * DELETE /api/posts/[postId]
 *
 * Author or staff. The role check here is the friendly layer — RLS is
 * what actually authorizes the delete (owners via the own-row policy,
 * staff via 013's "Admins can delete any post" policy, mirroring 007).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { postId } = await params;
  if (!isUuid(postId)) {
    return NextResponse.json({ error: "Invalid post id" }, { status: 400 });
  }

  const existing = await getPostById(postId);
  if (!existing) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  // Author can always delete their own; otherwise only staff may.
  if (existing.user_id !== user.id) {
    const supabase = await createClient();
    const { data: profileData } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    const role = (profileData as Pick<Profile, "role"> | null)?.role;
    if (role !== "owner" && role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  const success = await deletePost(postId);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to delete post." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
