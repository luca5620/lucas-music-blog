import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import type { Profile } from "@/lib/types/database";

/**
 * DELETE /api/rooms/[releaseId]/messages/[messageId]
 *
 * Remove a live-room message: your own always, ANY message as staff
 * (owner/admin). RLS (003's combined users-and-mods delete policy)
 * authorizes at the DB layer too.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ releaseId: string; messageId: string }> }
) {
  const { releaseId, messageId } = await params;

  if (!isUuid(releaseId) || !isUuid(messageId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`msg-delete:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;
  const asStaff = role === "owner" || role === "admin";

  let query = supabase.from("room_messages").delete().eq("id", messageId);
  if (!asStaff) {
    query = query.eq("user_id", user.id);
  }
  const { data, error } = await query.select("id");

  if (error) {
    console.error("room message delete failed:", error.message);
    return NextResponse.json({ error: "Delete failed." }, { status: 500 });
  }
  if ((data ?? []).length === 0) {
    return NextResponse.json(
      { error: "Message not found or not yours." },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
