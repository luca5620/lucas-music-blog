import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

/**
 * PATCH /api/debates/[debateId] — publish a draft debate.
 *
 * Body: { is_published: true }. That's the ONLY edit debates support:
 * once a room is on air its framing is what people voted on and argued
 * under, so titles/sides never change — and unpublishing a live room
 * would strand everyone in it. Creator-only, enforced twice (the check
 * here for a friendly 403, RLS's update policy for real).
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Same budget as edits elsewhere — 10 per 5 minutes.
  const limited = await rateLimit(`debates-publish:${user.id}`, 10, 300_000);
  if (limited) return limited;

  const { debateId } = await params;
  if (!isUuid(debateId)) {
    return NextResponse.json({ error: "Invalid debate id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if ((body as { is_published?: unknown } | null)?.is_published !== true) {
    return NextResponse.json(
      { error: "Only publishing is supported." },
      { status: 400 }
    );
  }

  // RLS's select policy already hides other people's drafts, so a
  // wrong-owner request reads as "not found" — but check explicitly
  // for the honest 403 when someone pokes at a LIVE debate id.
  const { data: existing } = await supabase
    .from("debates")
    .select("id, created_by, is_published")
    .eq("id", debateId)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }
  const row = existing as {
    id: string;
    created_by: string;
    is_published?: boolean;
  };
  if (row.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (row.is_published !== false) {
    // Already live (or pre-024 database with no column) — nothing to do.
    return NextResponse.json({ success: true });
  }

  const { error } = await supabase
    .from("debates")
    .update({ is_published: true } as never)
    .eq("id", debateId);

  if (error) {
    console.error("debate publish failed:", error.message);
    return NextResponse.json(
      { error: "Couldn't publish the debate. Try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
