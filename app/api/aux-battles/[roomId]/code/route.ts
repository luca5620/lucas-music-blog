import { NextResponse } from "next/server";
import { guardRoom, isGuardError } from "@/lib/aux-battles/guard";

/**
 * GET /api/aux-battles/[roomId]/code — the host reads the private room's
 * six-letter code (aux_room_code mints it on first call). Nobody else
 * can: the RPC checks the host and aux_room_codes has no read policy.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, room } = g;

  if (!room.is_private) {
    return NextResponse.json({ code: null });
  }
  const { data, error } = await supabase.rpc("aux_room_code", { p_room_id: room.id } as never);
  if (error || typeof data !== "string") {
    return NextResponse.json({ error: "Couldn't read the code." }, { status: 500 });
  }
  return NextResponse.json({ code: data });
}
