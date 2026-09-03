import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isOptionalText, isText, isUuid } from "@/lib/validate";
import { checkContent } from "@/lib/content-filter";
import { notifyFollowers } from "@/lib/db/notifications";

/**
 * /api/debates/[debateId] — the creator's controls over one debate.
 *
 * PATCH — edit. Body may carry any of:
 *   { is_published: true }                  publish a draft (the original
 *                                           one-purpose body still works)
 *   { title, prompt }                       reword the topic / framing
 *   { side_a_label, side_b_label }          ONLY while nobody has voted or
 *                                           posted — once a room has takes
 *                                           in it, the sides are what
 *                                           people argued under, so they
 *                                           lock (the form greys them out)
 *   { release_id, side_a_release_id,        re-pin records (migration 039
 *     side_b_release_id }                   for the two side ids)
 *   { status: "open" | "closed" }           sign off / reopen the floor
 *
 * DELETE — remove the debate (votes and messages cascade). Creator
 * only. `.select()` on the delete so a silent zero-row result under
 * RLS is reported as a failure, never a fake success (ROADMAP's
 * standing gotcha from the 038 investigation).
 *
 * Both: creator-only, enforced twice (the check here for a friendly
 * 403, RLS's own policies for real). Luca 2026-09-02: "created
 * debates and lists should be in my reviews section to edit and
 * delete directly on there".
 */

async function loadOwn(debateId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, row: null };

  // RLS's select policy already hides other people's drafts, so a
  // wrong-owner request reads as "not found" — but check explicitly
  // for the honest 403 when someone pokes at a LIVE debate id.
  const { data } = await supabase
    .from("debates")
    .select("id, created_by, is_published, slug, title, message_count, status")
    .eq("id", debateId)
    .maybeSingle();
  return {
    supabase,
    user,
    row: (data ?? null) as {
      id: string;
      created_by: string;
      is_published?: boolean;
      slug: string;
      title: string;
      message_count: number;
      status: "open" | "closed";
    } | null,
  };
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await params;
  if (!isUuid(debateId)) {
    return NextResponse.json({ error: "Invalid debate id" }, { status: 400 });
  }

  const { supabase, user, row } = await loadOwn(debateId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Same budget as edits elsewhere — 10 per 5 minutes.
  const limited = await rateLimit(`debates-edit:${user.id}`, 10, 300_000);
  if (limited) return limited;

  if (!row) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }
  if (row.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = (body ?? {}) as Record<string, unknown>;

  const updates: Record<string, unknown> = {};

  // ---- Publish (the original PATCH) ----
  let publishing = false;
  if (b.is_published !== undefined) {
    if (b.is_published !== true) {
      return NextResponse.json(
        { error: "A live debate can't be unpublished — close it instead." },
        { status: 400 }
      );
    }
    if (row.is_published === false) {
      updates.is_published = true;
      publishing = true;
    }
  }

  // ---- Wording ----
  if (b.title !== undefined) {
    if (!isText(b.title, 140) || (b.title as string).trim().length < 3) {
      return NextResponse.json(
        { error: "Title must be 3–140 characters." },
        { status: 400 }
      );
    }
    updates.title = (b.title as string).trim();
  }
  if (b.prompt !== undefined) {
    if (!isOptionalText(b.prompt, 500)) {
      return NextResponse.json(
        { error: "Prompt must be 500 characters or fewer." },
        { status: 400 }
      );
    }
    updates.prompt =
      typeof b.prompt === "string" && b.prompt.trim() ? b.prompt.trim() : null;
  }

  // ---- Sides: only while the room is still empty ----
  if (b.side_a_label !== undefined || b.side_b_label !== undefined) {
    if (!isText(b.side_a_label, 40) || !isText(b.side_b_label, 40)) {
      return NextResponse.json(
        { error: "Both side labels are required (max 40 characters each)." },
        { status: 400 }
      );
    }
    const sideA = (b.side_a_label as string).trim();
    const sideB = (b.side_b_label as string).trim();
    if (sideA.toLowerCase() === sideB.toLowerCase()) {
      return NextResponse.json(
        { error: "The two sides have to actually disagree — labels must differ." },
        { status: 400 }
      );
    }
    const { count: voteCount } = await supabase
      .from("debate_votes")
      .select("debate_id", { count: "exact", head: true })
      .eq("debate_id", debateId);
    if ((voteCount ?? 0) > 0 || row.message_count > 0) {
      return NextResponse.json(
        {
          error:
            "People have already voted or argued under these sides — the labels are locked. Everything else can still change.",
        },
        { status: 409 }
      );
    }
    updates.side_a_label = sideA;
    updates.side_b_label = sideB;
  }

  // ---- Releases ----
  for (const key of ["release_id", "side_a_release_id", "side_b_release_id"] as const) {
    if (b[key] === undefined) continue;
    if (b[key] !== null && !isUuid(b[key])) {
      return NextResponse.json({ error: "Invalid release." }, { status: 400 });
    }
    updates[key] = b[key];
  }

  // ---- Status ----
  if (b.status !== undefined) {
    if (b.status !== "open" && b.status !== "closed") {
      return NextResponse.json({ error: "Invalid status." }, { status: 400 });
    }
    updates.status = b.status;
  }

  // Zero-tolerance filter (App Store 1.2) — slurs never hit the DB.
  const dirty = checkContent(
    ...(["title", "prompt", "side_a_label", "side_b_label"] as const)
      .map((k) => updates[k])
      .filter((v): v is string => typeof v === "string")
  );
  if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ success: true });
  }

  // `.select()` + row count: an RLS no-op must not read as success.
  let { data: updated, error } = await supabase
    .from("debates")
    .update(updates as never)
    .eq("id", debateId)
    .select("id");

  // Side columns predate migration 039 on a lagging database: retry
  // without them so the rest of the edit still lands.
  if (
    error &&
    /side_[ab]_release_id/.test(error.message) &&
    ("side_a_release_id" in updates || "side_b_release_id" in updates)
  ) {
    delete updates.side_a_release_id;
    delete updates.side_b_release_id;
    if (Object.keys(updates).length > 0) {
      ({ data: updated, error } = await supabase
        .from("debates")
        .update(updates as never)
        .eq("id", debateId)
        .select("id"));
    }
  }

  if (error) {
    console.error("debate edit failed:", error.message);
    return NextResponse.json(
      { error: "Couldn't save the debate. Try again." },
      { status: 500 }
    );
  }
  if (!updated || updated.length === 0) {
    return NextResponse.json(
      { error: "Nothing changed — you may not have permission to edit this debate." },
      { status: 403 }
    );
  }

  if (publishing) {
    await notifyFollowers({
      actorId: user.id,
      type: "new_debate",
      href: `/debates/${row.slug}`,
      title: (updates.title as string | undefined) ?? row.title,
    });
  }

  return NextResponse.json({ success: true, slug: row.slug });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ debateId: string }> }
) {
  const { debateId } = await params;
  if (!isUuid(debateId)) {
    return NextResponse.json({ error: "Invalid debate id" }, { status: 400 });
  }

  const { supabase, user, row } = await loadOwn(debateId);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await rateLimit(`debates-delete:${user.id}`, 10, 300_000);
  if (limited) return limited;

  if (!row) {
    return NextResponse.json({ error: "Debate not found." }, { status: 404 });
  }
  if (row.created_by !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data: deleted, error } = await supabase
    .from("debates")
    .delete()
    .eq("id", debateId)
    .select("id");

  if (error) {
    console.error("debate delete failed:", error.message);
    return NextResponse.json(
      { error: "Couldn't delete the debate. Try again." },
      { status: 500 }
    );
  }
  if (!deleted || deleted.length === 0) {
    return NextResponse.json(
      { error: "The debate wasn't deleted — you may not have permission." },
      { status: 403 }
    );
  }
  return NextResponse.json({ success: true });
}
