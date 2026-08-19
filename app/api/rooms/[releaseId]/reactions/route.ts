import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReleaseById } from "@/lib/db/releases";
import {
  addReaction,
  getOrCreateRoom,
  removeReaction,
} from "@/lib/db/rooms";

/* ─── Validation helpers ─── */

const MAX_EMOJI_LEN = 16;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface ParsedBody {
  emoji: string;
  trackPosition?: number;
  messageId?: string;
}

function parseBody(raw: unknown): ParsedBody | { error: string } {
  if (!raw || typeof raw !== "object") {
    return { error: "Invalid JSON body" };
  }
  const b = raw as {
    emoji?: unknown;
    track_position?: unknown;
    message_id?: unknown;
  };

  const emojiRaw = typeof b.emoji === "string" ? b.emoji : "";
  const emoji = emojiRaw.trim();
  if (!emoji) return { error: "emoji is required" };
  if (emoji.length > MAX_EMOJI_LEN) {
    return { error: `emoji must be ≤ ${MAX_EMOJI_LEN} chars` };
  }

  const hasTrack =
    b.track_position !== undefined && b.track_position !== null;
  const hasMessage = b.message_id !== undefined && b.message_id !== null;

  if (hasTrack === hasMessage) {
    return {
      error: "exactly one of track_position or message_id is required",
    };
  }

  if (hasTrack) {
    const n = Number(b.track_position);
    if (!Number.isInteger(n) || n <= 0) {
      return { error: "track_position must be a positive integer" };
    }
    return { emoji, trackPosition: n };
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

/* ─── POST /api/rooms/[releaseId]/reactions ─── */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const { releaseId } = await params;

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

  const release = await getReleaseById(releaseId);
  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  try {
    const room = await getOrCreateRoom(release.id);
    const reaction = await addReaction({
      roomId: room.id,
      userId: user.id,
      emoji: parsed.emoji,
      trackPosition: parsed.trackPosition,
      messageId: parsed.messageId,
    });

    return NextResponse.json({ ok: true, reaction }, { status: 201 });
  } catch (err) {
    console.error("Failed to add room reaction:", err);
    return NextResponse.json(
      // Generic message — the real error is logged, never sent to clients.
      { error: "Failed to add reaction" },
      { status: 500 }
    );
  }
}

/* ─── DELETE /api/rooms/[releaseId]/reactions ─── */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const { releaseId } = await params;

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

  const release = await getReleaseById(releaseId);
  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  try {
    const room = await getOrCreateRoom(release.id);
    await removeReaction({
      roomId: room.id,
      userId: user.id,
      emoji: parsed.emoji,
      trackPosition: parsed.trackPosition,
      messageId: parsed.messageId,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Failed to remove room reaction:", err);
    return NextResponse.json(
      // Generic message — the real error is logged, never sent to clients.
      { error: "Failed to remove reaction" },
      { status: 500 }
    );
  }
}
