import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-wars/guard";

/**
 * POST   /api/aux-wars/[roomId]/members  { role: "player" | "viewer" }
 *        Join the room — as a player (lobby only) or a viewer — or
 *        switch between the two while the room is still in the lobby.
 * DELETE /api/aux-wars/[roomId]/members
 *        Leave (lobby only; once live the bracket is drawn).
 *
 * Public rooms: RLS lets anyone write their own row. Private rooms:
 * the viewer row already exists from the code (aux_join_with_code),
 * so this is just an UPDATE of the role. The host can't leave their
 * own room — they end it instead.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId);
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-member:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { role } = body;
  if (role !== "player" && role !== "viewer") {
    return NextResponse.json({ error: "Role must be player or viewer." }, { status: 400 });
  }
  if (role === "player" && room.status !== "lobby") {
    return NextResponse.json({ error: "The bracket is drawn — you can still watch." }, { status: 409 });
  }
  if (room.host_id === user.id && role === "viewer" && room.host_plays) {
    return NextResponse.json({ error: "Turn off \"host plays\" in the room settings instead." }, { status: 409 });
  }

  const { error } = await supabase
    .from("aux_members")
    .upsert({ room_id: room.id, user_id: user.id, role } as never, {
      onConflict: "room_id,user_id",
    });
  if (error) {
    // The lobby cap is a DB trigger (migration 044): 32 players in a
    // single-round room — the biggest bracket is a round of 32 — and
    // 10 in a best-of-3, which is 30 songs in the first round. It
    // lives in the database so no hand-rolled request can walk past
    // it. Viewers are never capped.
    if (/ROOM_FULL/.test(error.message)) {
      return NextResponse.json(
        {
          error:
            room.format === "bo3"
              ? "This lobby is full — best-of-3 rooms take 10 players. You can still watch."
              : "This lobby is full — 32 players is the biggest bracket. You can still watch.",
        },
        { status: 409 }
      );
    }
    console.error("aux join failed:", error.message);
    return NextResponse.json({ error: "Couldn't join. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, role });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId);
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  if (room.host_id === user.id) {
    return NextResponse.json({ error: "The host can't leave — end the battle instead." }, { status: 409 });
  }
  if (room.status !== "lobby") {
    return NextResponse.json({ error: "The battle is on — no leaving the bracket now." }, { status: 409 });
  }
  const { error } = await supabase
    .from("aux_members")
    .delete()
    .eq("room_id", room.id)
    .eq("user_id", user.id);
  if (error) {
    return NextResponse.json({ error: "Couldn't leave. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
