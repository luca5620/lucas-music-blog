import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-battles/guard";

/**
 * The host's door policy (Luca 2026-09-14: "as a host of a aux battle
 * room, you should have the choice to remove people from the room or
 * block them if they keep spam-joining").
 *
 * POST   /api/aux-battles/[roomId]/bans  { userId, ban?: boolean }
 *        ban !== false (the default) BLOCKS: the member row goes and
 *        an aux_bans row stays behind, so re-joining, chatting,
 *        voting and reacting are all shut — that's the answer to
 *        someone who keeps coming back. ban === false is a plain
 *        REMOVE: the row goes, they can walk back in.
 * DELETE /api/aux-battles/[roomId]/bans  { userId }
 *        Lift a block.
 *
 * RLS does the real work: aux_bans only takes the host's writes, and
 * the member/message/vote/reaction policies all check aux_is_banned.
 * The host can never remove themselves — they end the battle instead.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-ban:${user.id}`, 60, 60_000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { userId, ban } = body;
  if (typeof userId !== "string" || !isUuid(userId)) {
    return NextResponse.json({ error: "Invalid person." }, { status: 400 });
  }
  if (userId === user.id) {
    return NextResponse.json(
      { error: "You can't remove yourself — end the battle instead." },
      { status: 409 }
    );
  }

  // Block first, THEN remove: the other way round leaves a gap where
  // a spam-joiner's next request can land.
  if (ban !== false) {
    const { error } = await supabase
      .from("aux_bans")
      .upsert({ room_id: room.id, user_id: userId } as never, {
        onConflict: "room_id,user_id",
      });
    if (error) {
      console.error("aux ban failed:", error.message);
      return NextResponse.json({ error: "Couldn't block them." }, { status: 500 });
    }
  }

  const { error: kickError } = await supabase
    .from("aux_members")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", userId);
  if (kickError) {
    console.error("aux kick failed:", kickError.message);
    return NextResponse.json({ error: "Couldn't remove them." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, banned: ban !== false });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, room } = g;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { userId } = body;
  if (typeof userId !== "string" || !isUuid(userId)) {
    return NextResponse.json({ error: "Invalid person." }, { status: 400 });
  }

  const { error } = await supabase
    .from("aux_bans")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "Couldn't lift that block." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
