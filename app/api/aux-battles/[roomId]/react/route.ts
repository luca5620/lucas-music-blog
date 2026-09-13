import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-battles/guard";

/**
 * POST /api/aux-battles/[roomId]/react  { side: "a" | "b", kind: "fire" | "poop" }
 *
 * The crowd noise during the listening period (Luca: "quick reaction
 * with either a fire or poop emoji"). Not a vote — many per person,
 * they float up on every screen through the realtime INSERT and are
 * tallied per side for the heat meter. RLS only lets them in while
 * the game is listening. 60 taps a minute per person keeps the
 * spam-tapping fun without letting one thumb flood the table.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId);
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-react:${user.id}`, 60, 60_000);
  if (limited) return limited;

  if (room.status !== "live" || !room.current_game_id) {
    return NextResponse.json({ error: "Nothing is playing." }, { status: 409 });
  }
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { side, kind } = body;
  if (side !== "a" && side !== "b") {
    return NextResponse.json({ error: 'side must be "a" or "b".' }, { status: 400 });
  }
  if (kind !== "fire" && kind !== "poop") {
    return NextResponse.json({ error: "kind must be fire or poop." }, { status: 400 });
  }

  const { error } = await supabase
    .from("aux_reactions")
    .insert({ game_id: room.current_game_id, room_id: room.id, user_id: user.id, side, kind } as never);
  if (error) {
    if (/policy|permission/i.test(error.message)) {
      return NextResponse.json({ error: "Reactions are for the listening period." }, { status: 403 });
    }
    return NextResponse.json({ error: "Didn't land." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
