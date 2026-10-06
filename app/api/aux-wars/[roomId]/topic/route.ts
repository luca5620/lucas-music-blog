import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isText, isUuid } from "@/lib/validate";
import { checkContent } from "@/lib/content-filter";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-wars/guard";
import { AuxError, setTopic } from "@/lib/aux-wars/engine";

/**
 * POST /api/aux-wars/[roomId]/topic  { topic, game_id? }
 *
 * The host names the CURRENT round's topic (migration 043). The same
 * value lands on every match of that round, so any card in the
 * bracket can show it and aux_pick_song can check it. In a "topic
 * each game" bo3 room (046) it lands on this GAME instead. Allowed
 * while the current game is still picking and no song is on yet —
 * after that the topic is what people played to, and it stays.
 *
 * The write itself is aux_set_topic (migration 053): the host's
 * direct write access to matches and games is gone, so every change
 * to a bracket goes through one locked function. The content filter
 * stays HERE, before it — the database doesn't know our word list.
 *
 * game_id (optional) is the game the host's screen was showing; if
 * the room moved on, the answer is 409 with `stale: true`.
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
  const gameId = isUuid(body.game_id) ? body.game_id : null;

  try {
    const result = await setTopic(supabase, room.id, gameId, topic.trim());
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    if (err instanceof AuxError) {
      return NextResponse.json({ error: err.message, stale: err.stale }, { status: err.status });
    }
    console.error("aux topic failed:", err);
    return NextResponse.json({ error: "Couldn't set the topic. Try again." }, { status: 500 });
  }
}
