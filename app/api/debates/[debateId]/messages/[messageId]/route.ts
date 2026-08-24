import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import type { Profile } from "@/lib/types/database";

/**
 * DELETE /api/debates/[debateId]/messages/[messageId]
 *
 * Remove a take from the floor: your own always, ANY message as staff
 * (owner/admin) — the same in-place moderation as review comments.
 * RLS backs both cases (006's delete-own + 007's admin-delete), so
 * even a bug here couldn't delete what the session isn't allowed to.
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ debateId: string; messageId: string }> }
) {
  const { debateId, messageId } = await params;

  if (!isUuid(debateId) || !isUuid(messageId)) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`msg-delete:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;
  const asStaff = role === "owner" || role === "admin";

  let query = supabase
    .from("debate_messages")
    .delete()
    .eq("id", messageId)
    .eq("debate_id", debateId);
  if (!asStaff) {
    query = query.eq("user_id", user.id);
  }
  const { data, error } = await query.select("id");

  if (error) {
    console.error("debate message delete failed:", error.message);
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
