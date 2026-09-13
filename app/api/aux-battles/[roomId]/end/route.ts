import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { guardRoom, isGuardError } from "@/lib/aux-battles/guard";
import { AuxError, endRoom } from "@/lib/aux-battles/engine";

/**
 * POST /api/aux-battles/[roomId]/end — the host pulls the plug. The room is
 * finished with no champion; the chat stays readable.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-end:${user.id}`, 10, 60_000);
  if (limited) return limited;

  try {
    await endRoom(supabase, room);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof AuxError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: "Couldn't end the battle." }, { status: 500 });
  }
}
