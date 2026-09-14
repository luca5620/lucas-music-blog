import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isText } from "@/lib/validate";
import { checkContent } from "@/lib/content-filter";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-battles/guard";
import type { AuxGame, AuxMatch } from "@/lib/types/database";

/**
 * POST /api/aux-battles/[roomId]/topic  { topic }
 *
 * The host names the CURRENT round's topic (migration 043). The same
 * value lands on every match of that round, so any card in the
 * bracket can show it and aux_pick_song can check it. Allowed while
 * the current game is still picking and no song is on yet — after
 * that the topic is what people played to, and it stays.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-topic:${user.id}`, 30, 60_000);
  if (limited) return limited;

  if (room.status !== "live" || !room.current_game_id) {
    return NextResponse.json({ error: "No round is open right now." }, { status: 409 });
  }
  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { topic } = body;
  if (!isText(topic, 120) || topic.trim().length < 3) {
    return NextResponse.json({ error: "Topic must be 3–120 characters." }, { status: 400 });
  }
  const dirty = checkContent(topic);
  if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

  const { data: gameRow } = await supabase
    .from("aux_games")
    .select("*")
    .eq("id", room.current_game_id)
    .maybeSingle();
  const game = gameRow as unknown as AuxGame | null;
  if (!game) return NextResponse.json({ error: "The game is gone." }, { status: 404 });
  if (game.phase !== "picking" || game.song_a || game.song_b) {
    return NextResponse.json({ error: "Songs are already on for this topic." }, { status: 409 });
  }
  const { data: matchRow } = await supabase
    .from("aux_matches")
    .select("*")
    .eq("id", game.match_id)
    .maybeSingle();
  const match = matchRow as unknown as AuxMatch | null;
  if (!match) return NextResponse.json({ error: "The match is gone." }, { status: 404 });

  const { error } = await supabase
    .from("aux_matches")
    .update({ topic: topic.trim() } as never)
    .eq("room_id", room.id)
    .eq("round", match.round);
  if (error) {
    console.error("aux topic failed:", error.message);
    return NextResponse.json({ error: "Couldn't set the topic. Try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, topic: topic.trim(), round: match.round });
}
