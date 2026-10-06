import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-wars/guard";
import { AuxError, callGame } from "@/lib/aux-wars/engine";

/**
 * POST /api/aux-wars/[roomId]/call
 *   { game_id, phase: "picking" | "listening", side?: "a" | "b" }
 *
 * The host closes the current game. side is required when the host
 * is the judge, when the crowd tied twice (OT already played), when
 * nobody voted, or to forfeit a match still in the picking phase.
 * Otherwise the crowd's majority decides and side is ignored.
 *
 * game_id + phase are what the host's SCREEN was showing (migration
 * 053). If the room has moved on — a second device already called it,
 * or both songs landed so a "forfeit" would now be a pick — the engine
 * refuses and this answers 409 with `stale: true`, so the screen
 * resyncs instead of acting on a game nobody meant.
 *
 * Returns the engine's CallResult so the host UI knows whether to
 * show the "you pick" buttons, an OT banner, or nothing.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-call:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const side = body.side === "a" || body.side === "b" ? body.side : null;
  // Both are REQUIRED now: a call has to say which game it means.
  if (!isUuid(body.game_id)) {
    return NextResponse.json({ error: "Which game? Refresh and try again." }, { status: 400 });
  }
  if (body.phase !== "picking" && body.phase !== "listening") {
    return NextResponse.json({ error: "Which phase? Refresh and try again." }, { status: 400 });
  }

  try {
    const result = await callGame(supabase, room.id, body.game_id, body.phase, side);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuxError) {
      return NextResponse.json({ error: err.message, stale: err.stale }, { status: err.status });
    }
    console.error("aux call failed:", err);
    return NextResponse.json({ error: "Couldn't call it. Try again." }, { status: 500 });
  }
}
