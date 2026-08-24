import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isText, isUuid } from "@/lib/validate";
import { getUserVote } from "@/lib/db/debates";

/**
 * POST /api/debates/[debateId]/messages — drop a take in the room.
 * Body: { content }
 *
 * The message is stamped with the side the author has voted for at
 * post time (null = spectator badge in the UI). We look the vote up
 * server-side — the client never gets to claim a side it didn't vote.
 *
 * Returns { message } with the poster's profile joined, matching the
 * shape the realtime subscription builds, so the client can swap its
 * optimistic placeholder for the real row.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await params;

  if (!isUuid(debateId)) {
    return NextResponse.json({ error: "Invalid debate." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`debate-msg:${user.id}`, 20, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { content } = (body ?? {}) as { content?: unknown };
  if (!isText(content, 500)) {
    return NextResponse.json(
      { error: "Message must be 1–500 characters." },
      { status: 400 }
    );
  }

  // Room must exist and still be open.
  const { data: debate } = await supabase
    .from("debates")
    .select("id, status")
    .eq("id", debateId)
    .single();

  if (!debate) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }
  if ((debate as { status: string }).status === "closed") {
    return NextResponse.json(
      { error: "This debate is closed." },
      { status: 403 }
    );
  }

  // Stamp the author's current side (or null for spectators).
  const side = await getUserVote(debateId, user.id);

  const { data, error } = await supabase
    .from("debate_messages")
    .insert({
      debate_id: debateId,
      user_id: user.id,
      side,
      content: (content as string).trim(),
    } as never)
    .select(
      "*, profiles!debate_messages_user_id_fkey(id, username, display_name, avatar_url, role)"
    )
    .single();

  if (error || !data) {
    console.error("debate message failed:", error?.message);
    return NextResponse.json(
      { error: "Message didn't send. Try again." },
      { status: 500 }
    );
  }

  // Flatten the joined profile to the shape the client expects.
  const row = data as Record<string, unknown> & {
    profiles: unknown;
  };
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  const { profiles: _drop, ...message } = row;
  void _drop;

  return NextResponse.json(
    { message: { ...message, profile } },
    { status: 201 }
  );
}
