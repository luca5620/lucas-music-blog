import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-battles/guard";
import { isText } from "@/lib/validate";
import { checkContent } from "@/lib/content-filter";

/**
 * PATCH  /api/aux-battles/[roomId] — the host reworks the LOBBY settings
 *        (name, format, judge, host_plays). Locked once live.
 * DELETE /api/aux-battles/[roomId] — the host tears the room down. Matches,
 *        games, votes, chat go with it (cascades). RLS re-checks host.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-edit:${user.id}`, 30, 60_000);
  if (limited) return limited;

  if (room.status !== "lobby") {
    return NextResponse.json({ error: "Settings lock once the battle starts." }, { status: 409 });
  }
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    if (!isText(body.name, 120) || body.name.trim().length < 3) {
      return NextResponse.json({ error: "Room name must be 3–120 characters." }, { status: 400 });
    }
    const dirty = checkContent(body.name);
    if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });
    patch.name = body.name.trim();
  }
  if (body.format !== undefined) {
    if (body.format !== "bo1" && body.format !== "bo3") {
      return NextResponse.json({ error: "Format must be bo1 or bo3." }, { status: 400 });
    }
    patch.format = body.format;
  }
  if (body.judge !== undefined) {
    if (body.judge !== "crowd" && body.judge !== "host") {
      return NextResponse.json({ error: "Judge must be crowd or host." }, { status: 400 });
    }
    patch.judge = body.judge;
  }
  if (body.host_plays !== undefined) {
    if (typeof body.host_plays !== "boolean") {
      return NextResponse.json({ error: "Invalid host flag." }, { status: 400 });
    }
    patch.host_plays = body.host_plays;
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to change." }, { status: 400 });
  }

  const { error } = await supabase.from("aux_rooms").update(patch as never).eq("id", room.id);
  if (error) {
    return NextResponse.json({ error: "Couldn't save. Try again." }, { status: 500 });
  }

  // Playing ↔ hosting only: keep the host's member row in step.
  if (patch.host_plays === true) {
    await supabase
      .from("aux_members")
      .upsert({ room_id: room.id, user_id: user.id, role: "player" } as never, {
        onConflict: "room_id,user_id",
      });
  } else if (patch.host_plays === false) {
    await supabase
      .from("aux_members")
      .delete()
      .eq("room_id", room.id)
      .eq("user_id", user.id);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-delete:${user.id}`, 10, 60_000);
  if (limited) return limited;

  const { error } = await supabase.from("aux_rooms").delete().eq("id", room.id);
  if (error) {
    return NextResponse.json({ error: "Couldn't delete the room." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
