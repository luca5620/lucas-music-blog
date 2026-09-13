import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isText } from "@/lib/validate";
import { checkContent } from "@/lib/content-filter";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-battles/guard";

/**
 * POST /api/aux-battles/[roomId]/messages  { content } — say something in the
 * room. Same rules as every chat on the site: 1–500 characters, the
 * zero-tolerance content filter (App Store 1.2), 20 a minute. Private
 * rooms: RLS only accepts members. Returns the row with the poster's
 * profile so the client can swap its optimistic bubble for the real
 * one (the realtime echo carries the same id).
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId);
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-msg:${user.id}`, 20, 60_000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { content } = body;
  if (!isText(content, 500)) {
    return NextResponse.json({ error: "Message must be 1–500 characters." }, { status: 400 });
  }
  const dirty = checkContent(content);
  if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

  const { data, error } = await supabase
    .from("aux_messages")
    .insert({ room_id: room.id, user_id: user.id, content: content.trim() } as never)
    .select("*, profiles!aux_messages_user_id_fkey(id, username, display_name, avatar_url, role)")
    .single();

  if (error || !data) {
    console.error("aux message failed:", error?.message);
    return NextResponse.json({ error: "Message didn't send. Try again." }, { status: 500 });
  }
  const row = data as Record<string, unknown> & { profiles: unknown };
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const { profiles: _drop, ...message } = row;
  void _drop;
  return NextResponse.json({ message: { ...message, profile } }, { status: 201 });
}
