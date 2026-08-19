import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  addDebateMessageReaction,
  removeDebateMessageReaction,
} from "@/lib/db/debates";

/* ─── Validation helpers ─── */

const MAX_EMOJI_LEN = 16;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ParsedBody {
  emoji: string;
  messageId: string;
}

function parseBody(raw: unknown): ParsedBody | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid JSON body" };
  }
  const b = raw as { emoji?: unknown; message_id?: unknown };

  const emojiRaw = typeof b.emoji === "string" ? b.emoji : "";
  const emoji = emojiRaw.trim();
  if (!emoji) return { error: "emoji is required" };
  if (emoji.length > MAX_EMOJI_LEN) {
    return { error: `emoji must be ≤ ${MAX_EMOJI_LEN} chars` };
  }

  const mid = typeof b.message_id === "string" ? b.message_id : "";
  if (!UUID_RE.test(mid)) {
    return { error: "message_id must be a valid uuid" };
  }
  return { emoji, messageId: mid };
}

async function authenticate() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

/**
 * Shared guards for both verbs: the message must exist and belong to
 * THIS debate, and the debate must still be open — reactions are
 * disabled on archived debates, matching the composer.
 */
async function checkTarget(
  debateId: string,
  messageId: string
): Promise<{ error: string; status: number } | null> {
  const supabase = await createClient();

  const { data: message } = await supabase
    .from("debate_messages")
    .select("id, debate_id")
    .eq("id", messageId)
    .single();

  if (
    !message ||
    (message as { debate_id: string }).debate_id !== debateId
  ) {
    return { error: "Message not found", status: 404 };
  }

  const { data: debate } = await supabase
    .from("debates")
    .select("id, status")
    .eq("id", debateId)
    .single();

  if (!debate) {
    return { error: "Debate not found", status: 404 };
  }
  if ((debate as { status: string }).status === "closed") {
    return { error: "Debate is closed", status: 403 };
  }

  return null;
}

/* ─── POST /api/debates/[debateId]/reactions ─── */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await params;

  const user = await authenticate();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const blocked = await checkTarget(debateId, parsed.messageId);
  if (blocked) {
    return NextResponse.json(
      { error: blocked.error },
      { status: blocked.status }
    );
  }

  try {
    const reaction = await addDebateMessageReaction({
      debateId,
      messageId: parsed.messageId,
      userId: user.id,
      emoji: parsed.emoji,
    });

    return NextResponse.json({ ok: true, reaction }, { status: 201 });
  } catch {
    return NextResponse.json(
      // Generic message — the real error is logged, never sent to clients.
      { error: "Failed to add reaction" },
      { status: 500 }
    );
  }
}

/* ─── DELETE /api/debates/[debateId]/reactions ─── */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await params;

  const user = await authenticate();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = parseBody(raw);
  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const blocked = await checkTarget(debateId, parsed.messageId);
  if (blocked) {
    return NextResponse.json(
      { error: blocked.error },
      { status: blocked.status }
    );
  }

  try {
    await removeDebateMessageReaction({
      userId: user.id,
      messageId: parsed.messageId,
      emoji: parsed.emoji,
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      // Generic message — the real error is logged, never sent to clients.
      { error: "Failed to remove reaction" },
      { status: 500 }
    );
  }
}
