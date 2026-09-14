import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-wars/guard";
import { AuxError, callGame } from "@/lib/aux-wars/engine";

/**
 * POST /api/aux-wars/[roomId]/call  { side?: "a" | "b" }
 *
 * The host closes the current game. side is required when the host
 * is the judge, when the crowd tied twice (OT already played), when
 * nobody voted, or to forfeit a match still in the picking phase.
 * Otherwise the crowd's majority decides and side is ignored.
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

  const body = (await readJson(request)) ?? {};
  const side = body.side === "a" || body.side === "b" ? body.side : null;

  try {
    const result = await callGame(supabase, room, side);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AuxError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error("aux call failed:", err);
    return NextResponse.json({ error: "Couldn't call it. Try again." }, { status: 500 });
  }
}
