import { NextResponse } from "next/server";
import { isUuid } from "@/lib/validate";
import { getUser } from "@/lib/auth";
import {
  getAuxRoomMetaById,
  getAuxRoomState,
  getViewerAuxReaction,
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
  const live = user && room.current_game_id ? room.current_game_id : null;
  const [vote, reaction] = live && user
    ? await Promise.all([
        getViewerAuxVote(live, user.id),
        getViewerAuxReaction(live, user.id),
      ])
    : [null, null];
  return NextResponse.json(
    { ...state, vote, reaction },
    { headers: { "Cache-Control": "no-store" } }
  );
}
