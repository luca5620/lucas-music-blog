import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReleaseById } from "@/lib/db/releases";
import {
  getOrCreateRoom,
  getRoomMessages,
  postRoomMessage,
} from "@/lib/db/rooms";
import type { Profile, RoomMessage } from "@/lib/types/database";

type MessageProfile = Pick<
  Profile,
  "id" | "username" | "display_name" | "avatar_url" | "role"
>;

type EnrichedMessage = RoomMessage & { profile: MessageProfile };

const MAX_CONTENT = 1000;

/**
 * POST /api/rooms/[releaseId]/messages
 * Body: { content: string; track_position?: number }
 * Posts a new message to the live room for the given release.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const { releaseId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const release = await getReleaseById(releaseId);
  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = body as { content?: unknown; track_position?: unknown };
  const rawContent = typeof parsed.content === "string" ? parsed.content : "";
  const content = rawContent.trim();

  if (!content) {
    return NextResponse.json(
      { error: "content is required" },
      { status: 400 }
    );
  }
  if (content.length > MAX_CONTENT) {
    return NextResponse.json(
      { error: `content must be ≤ ${MAX_CONTENT} chars` },
      { status: 400 }
    );
  }

  let trackPosition: number | undefined;
  if (parsed.track_position !== undefined && parsed.track_position !== null) {
    const n = Number(parsed.track_position);
    if (!Number.isInteger(n) || n <= 0) {
      return NextResponse.json(
        { error: "track_position must be a positive integer" },
        { status: 400 }
      );
    }
    trackPosition = n;
  }

  try {
    const room = await getOrCreateRoom(release.id);
    const inserted = await postRoomMessage({
      roomId: room.id,
      userId: user.id,
      content,
      trackPosition,
    });

    // Re-query the profile for enrichment. The poster is the current
    // user, so this is a single-row read on a small table.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, role")
      .eq("id", user.id)
      .single();

    const message: EnrichedMessage = {
      ...inserted,
      profile: (profile as MessageProfile | null) ?? {
        id: user.id,
        username: "anonymous",
        display_name: null,
        avatar_url: null,
        role: "user",
      },
    };

    return NextResponse.json({ message }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to post message",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/rooms/[releaseId]/messages?before=<iso>
 * Public read of recent messages (RLS is read-public).
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const { releaseId } = await params;

  const release = await getReleaseById(releaseId);
  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }

  const before = request.nextUrl.searchParams.get("before") ?? undefined;

  try {
    const room = await getOrCreateRoom(release.id);
    const messages = await getRoomMessages(room.id, { limit: 50, before });
    return NextResponse.json({ room, messages });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to load messages",
      },
      { status: 500 }
    );
  }
}
