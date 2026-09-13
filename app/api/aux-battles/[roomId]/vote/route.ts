import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-battles/guard";

/**
 * POST /api/aux-battles/[roomId]/vote  { side: "a" | "b" }
 *
 * One vote per person per game, switchable while the songs are still
 * playing — aux_votes has PRIMARY KEY (game_id, user_id), so an upsert
 * is "latest choice wins". RLS is the wall: it only lets the row in
 * while the game is in the listening phase and the voter is NOT one
 * of the two players (no voting for yourself). The tallies live on
 * the game row (trigger), so every screen gets them in one realtime
 * UPDATE.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId);
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-vote:${user.id}`, 40, 60_000);
  if (limited) return limited;

  if (room.status !== "live" || !room.current_game_id) {
    return NextResponse.json({ error: "Nothing to vote on right now." }, { status: 409 });
  }
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { side } = body;
  if (side !== "a" && side !== "b") {
    return NextResponse.json({ error: 'side must be "a" or "b".' }, { status: 400 });
  }

  const { error } = await supabase.from("aux_votes").upsert(
    { game_id: room.current_game_id, room_id: room.id, user_id: user.id, side } as never,
    { onConflict: "game_id,user_id" }
  );
  if (error) {
    // RLS refusals surface as a policy violation — the two players,
    // or a game that just closed.
    if (/policy|permission/i.test(error.message)) {
      return NextResponse.json(
        { error: "You can't vote on this one — players sit out their own game, and votes close when the host calls it." },
        { status: 403 }
      );
    }
    console.error("aux vote failed:", error.message);
    return NextResponse.json({ error: "Vote didn't land. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, side });
}
