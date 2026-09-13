import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { guardRoom, isGuardError } from "@/lib/aux-battles/guard";

/**
 * DELETE /api/aux-battles/[roomId]/messages/[messageId] — take a message down.
 * RLS decides who may: the author, the room's host, or staff.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roomId: string; messageId: string }> }
) {
  const { roomId, messageId } = await params;
  if (!isUuid(messageId)) {
    return NextResponse.json({ error: "Invalid message." }, { status: 400 });
  }
  const g = await guardRoom(roomId);
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-msg-del:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const { error, count } = await supabase
    .from("aux_messages")
    .delete({ count: "exact" })
    .eq("id", messageId)
    .eq("room_id", room.id);
  if (error) {
    return NextResponse.json({ error: "Couldn't delete it." }, { status: 500 });
  }
  if (!count) {
    return NextResponse.json({ error: "Not yours to delete." }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
