import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isText, isOptionalText, isUuid } from "@/lib/validate";
import { checkContent } from "@/lib/content-filter";
import { slugify } from "@/lib/spotify-import";
import { notifyFollowers } from "@/lib/db/notifications";

/**
 * POST /api/debates — open a new debate.
 * Body: { title, prompt?, side_a_label, side_b_label, release_id?,
 *         side_a_release_id?, side_b_release_id? }
 * The two side ids (migration 039) tie EACH side to a record — "Side
 * A = album X, Side B = album Y" (Luca 2026-09-02). release_id stays
 * the whole-debate pin for single-topic rooms.
 *
 * The slug is generated server-side from the title plus a short random
 * suffix, so two debates named "Drake fell off" can coexist and nobody
 * can squat a slug. created_by ALWAYS comes from the session.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Opening a debate is a big action — 5 per user per hour.
  const limited = await rateLimit(`debates:${user.id}`, 5, 3_600_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    title,
    prompt,
    side_a_label,
    side_b_label,
    release_id,
    side_a_release_id,
    side_b_release_id,
    is_published,
  } = (body ?? {}) as {
    title?: unknown;
    prompt?: unknown;
    side_a_label?: unknown;
    side_b_label?: unknown;
    release_id?: unknown;
    side_a_release_id?: unknown;
    side_b_release_id?: unknown;
    is_published?: unknown;
  };

  // Draft flag (migration 024): anything but an explicit false publishes.
  if (is_published !== undefined && typeof is_published !== "boolean") {
    return NextResponse.json({ error: "Invalid draft flag." }, { status: 400 });
  }

  // --- Validation mirrors the DB check constraints so users get a
  //     friendly 400 instead of a raw Postgres error. ---
  if (!isText(title, 140) || (title as string).trim().length < 3) {
    return NextResponse.json(
      { error: "Title must be 3–140 characters." },
      { status: 400 }
    );
  }
  if (!isOptionalText(prompt, 500)) {
    return NextResponse.json(
      { error: "Prompt must be 500 characters or fewer." },
      { status: 400 }
    );
  }
  if (!isText(side_a_label, 40) || !isText(side_b_label, 40)) {
    return NextResponse.json(
      { error: "Both side labels are required (max 40 characters each)." },
      { status: 400 }
    );
  }
  const sideA = (side_a_label as string).trim();
  const sideB = (side_b_label as string).trim();
  if (sideA.toLowerCase() === sideB.toLowerCase()) {
    return NextResponse.json(
      { error: "The two sides have to actually disagree — labels must differ." },
      { status: 400 }
    );
  }
  if (release_id != null && !isUuid(release_id)) {
    return NextResponse.json({ error: "Invalid release." }, { status: 400 });
  }
  if (
    (side_a_release_id != null && !isUuid(side_a_release_id)) ||
    (side_b_release_id != null && !isUuid(side_b_release_id))
  ) {
    return NextResponse.json({ error: "Invalid side release." }, { status: 400 });
  }
  const sideAReleaseId = (side_a_release_id as string | null | undefined) ?? null;
  const sideBReleaseId = (side_b_release_id as string | null | undefined) ?? null;

  // Zero-tolerance filter (App Store 1.2) — slurs never hit the DB.
  const dirty = checkContent(title as string, prompt as string, sideA, sideB);
  if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

  const cleanTitle = (title as string).trim();

  // Random 4-char suffix keeps slugs unique without a lookup loop.
  const suffix = Math.random().toString(36).slice(2, 6);
  const slug = `${slugify(cleanTitle).slice(0, 80) || "debate"}-${suffix}`;

  const baseRow = {
    slug,
    title: cleanTitle,
    prompt: typeof prompt === "string" && prompt.trim() ? prompt.trim() : null,
    side_a_label: sideA,
    side_b_label: sideB,
    release_id: (release_id as string | undefined) ?? null,
    created_by: user.id,
    // Only mention the column when saving a DRAFT — published is the
    // column default, and omitting it keeps the publish path working
    // even before migration 024 has been run in the SQL Editor.
    ...(is_published === false ? { is_published: false } : {}),
  };
  // Side releases (039) only travel when set — and if the columns
  // don't exist yet the insert is retried without them, so a form
  // deployed ahead of the migration still opens the room (minus the
  // side art) instead of failing.
  const withSides =
    sideAReleaseId || sideBReleaseId
      ? { ...baseRow, side_a_release_id: sideAReleaseId, side_b_release_id: sideBReleaseId }
      : baseRow;

  let { data, error } = await supabase
    .from("debates")
    .insert(withSides as never)
    .select()
    .single();

  if (error && withSides !== baseRow && /side_[ab]_release_id/.test(error.message)) {
    ({ data, error } = await supabase
      .from("debates")
      .insert(baseRow as never)
      .select()
      .single());
  }

  if (error || !data) {
    console.error("debate create failed:", error?.message);
    return NextResponse.json(
      { error: "Couldn't open the debate. Try again." },
      { status: 500 }
    );
  }

  // Same rule as the others: drafts stay quiet. The publish button
  // (PATCH /api/debates/[debateId]) fires this when one goes live.
  if (is_published !== false) {
    await notifyFollowers({
      actorId: user.id,
      type: "new_debate",
      href: `/debates/${slug}`,
      title: cleanTitle,
    });
  }

  return NextResponse.json({ debate: data }, { status: 201 });
}
