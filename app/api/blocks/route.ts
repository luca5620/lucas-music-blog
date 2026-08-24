import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { blockUser, unblockUser, getBlockedIds } from "@/lib/db/moderation";

/**
 * /api/blocks — the viewer's personal block list.
 *
 *   GET             → { blocked: string[] }  (ids the viewer blocked)
 *   POST   {user_id} → block that user
 *   DELETE {user_id} → unblock that user
 *
 * Blocking is one-directional and private: the blocked user is
 * never told. Client components (comments, debate chat) fetch the
 * GET list once and filter blocked authors out of what they render.
 */

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const blocked = await getBlockedIds(user.id);
  return NextResponse.json({ blocked });
}

async function parseTargetUserId(
  request: NextRequest
): Promise<string | NextResponse> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { user_id } = (body ?? {}) as { user_id?: string };
  if (!isUuid(user_id)) {
    return NextResponse.json({ error: "Invalid user id" }, { status: 400 });
  }
  return user_id!;
}

export async function POST(request: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`blocks:${user.id}`, 30, 3_600_000);
  if (limited) return limited;

  const target = await parseTargetUserId(request);
  if (target instanceof NextResponse) return target;

  if (target === user.id) {
    return NextResponse.json(
      { error: "You can't block yourself" },
      { status: 400 }
    );
  }

  try {
    await blockUser(user.id, target);
    return NextResponse.json({ ok: true, blocked: true });
  } catch (err) {
    console.error("block failed:", err);
    return NextResponse.json({ error: "Could not block user" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`blocks:${user.id}`, 30, 3_600_000);
  if (limited) return limited;

  const target = await parseTargetUserId(request);
  if (target instanceof NextResponse) return target;

  await unblockUser(user.id, target);
  return NextResponse.json({ ok: true, blocked: false });
}
