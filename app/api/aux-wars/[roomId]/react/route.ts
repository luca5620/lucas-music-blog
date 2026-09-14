import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-wars/guard";

/**
 * POST /api/aux-wars/[roomId]/react  { side: "a" | "b", kind: "fire" | "poop" }
 *
 * The crowd's verdict on a song during the listening period. ONE per
 * person per game (Luca 2026-09-14: "limit it to 1 reaction per
 * person instead of spamming it") — aux_reactions has a unique
 * (game_id, user_id) index since migration 044, so this is an upsert:
 * changing your mind moves your 🔥 to the other side, or flips it to
 * 💩, exactly like a vote. The tallies live on the game row (trigger)
 * and so ride one realtime UPDATE to every screen — and stay there
 * for the whole round instead of evaporating on a reload.
 *
 * RLS only lets the row in while the game is listening.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId);
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  // One reaction per game, but people change their minds — 20 a
  // minute is plenty for that and nothing like spam-tapping.
  const limited = await rateLimit(`aux-react:${user.id}`, 20, 60_000);
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

  const { error } = await supabase.from("aux_reactions").upsert(
    { game_id: room.current_game_id, room_id: room.id, user_id: user.id, side, kind } as never,
    { onConflict: "game_id,user_id" }
  );
  if (error) {
    if (/policy|permission/i.test(error.message)) {
      return NextResponse.json({ error: "Reactions are for the listening period." }, { status: 403 });
    }
    console.error("aux react failed:", error.message);
    return NextResponse.json({ error: "Didn't land." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, side, kind });
}
