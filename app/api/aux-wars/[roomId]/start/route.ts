import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { guardRoom, isGuardError } from "@/lib/aux-wars/guard";
import { AuxError, startRoom } from "@/lib/aux-wars/engine";

/**
 * POST /api/aux-wars/[roomId]/start — the host draws the bracket and puts
 * the first match on air (lib/aux-wars/engine.ts → aux_start_room, one
 * locked transaction since migration 053).
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-start:${user.id}`, 10, 60_000);
  if (limited) return limited;

  try {
    await startRoom(supabase, room.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuxError) {
      return NextResponse.json({ error: err.message, stale: err.stale }, { status: err.status });
    }
    console.error("aux start failed:", err);
    return NextResponse.json({ error: "Couldn't start the Aux War." }, { status: 500 });
  }
}
