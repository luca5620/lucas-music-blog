import { NextResponse } from "next/server";
import { isUuid } from "@/lib/validate";
import { getUser } from "@/lib/auth";
import {
  getAuxRoomMetaById,
  getAuxRoomState,
  getViewerAuxVote,
} from "@/lib/db/aux-battles";

/**
 * GET /api/aux-battles/[roomId]/state — the whole room bundle (room,
 * members, matches, games) plus the viewer's vote on the current
 * game. AuxRoom calls it after a realtime reconnect and when the tab
 * comes back to the front, so a missed event can never strand a
 * screen on the wrong phase. Reads run under the viewer's RLS, so a
 * private room the viewer isn't in simply 404s.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  if (!isUuid(roomId)) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }
  const room = await getAuxRoomMetaById(roomId);
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  const [state, user] = await Promise.all([getAuxRoomState(room), getUser()]);
  const vote =
    user && room.current_game_id ? await getViewerAuxVote(room.current_game_id, user.id) : null;
  return NextResponse.json({ ...state, vote }, { headers: { "Cache-Control": "no-store" } });
}
