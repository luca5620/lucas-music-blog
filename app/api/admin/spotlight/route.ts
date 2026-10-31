import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { sessionUsedEmailCode } from "@/lib/auth/amr";
import { isDateString, isOptionalText, isSafeSlug, isUuid } from "@/lib/validate";
import type { Profile } from "@/lib/types/database";

/**
 * /api/admin/spotlight — picking the Community Spotlight (migration 068).
 *
 *   POST   { release, week_start, note? }  → set that week's album
 *          `release` = the album's slug OR its full album-page link
 *          (paste peakmusicreviews.com/releases/... straight in).
 *          Picking a week that already has an album replaces it.
 *   DELETE { id }                           → remove a week
 *
 * Owners and admins only, email-code sessions only — checked here for
 * a clean error, and again by the table's RLS policy, which is what
 * actually holds the key.
 */

async function staffOnly() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;
  if (role !== "owner" && role !== "admin") {
    return { error: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  // Email-code gate, same three layers as every admin tool
  // (middleware, this route, the RLS policy).
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!sessionUsedEmailCode(session?.access_token)) {
    return {
      error: NextResponse.json(
        { error: "Sign in again with your email code to use admin tools." },
        { status: 403 }
      ),
    };
  }
  const limited = await rateLimit(`admin-spotlight:${user.id}`, 30, 60_000);
  if (limited) return { error: limited };
  return { supabase, user };
}

/** "…/releases/currents-tame-impala?x=1" or "currents-tame-impala" → the slug. */
function slugFrom(input: string): string {
  const trimmed = input.trim();
  const m = trimmed.match(/\/releases\/([^/?#]+)/);
  return decodeURIComponent(m ? m[1] : trimmed);
}

export async function POST(request: NextRequest) {
  const gate = await staffOnly();
  if ("error" in gate) return gate.error;
  const { supabase, user } = gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { release, week_start, note } = (body ?? {}) as {
    release?: unknown;
    week_start?: unknown;
    note?: unknown;
  };

  const slug = typeof release === "string" ? slugFrom(release) : "";
  if (!isSafeSlug(slug)) {
    return NextResponse.json({ error: "Paste the album's link or slug." }, { status: 400 });
  }
  if (!isDateString(week_start)) {
    return NextResponse.json({ error: "Pick the week's Monday." }, { status: 400 });
  }
  if (!isOptionalText(note, 280)) {
    return NextResponse.json({ error: "Keep the note under 280 characters." }, { status: 400 });
  }

  const { data: rel } = await supabase
    .from("releases")
    .select("id, title")
    .eq("slug", slug)
    .maybeSingle<{ id: string; title: string }>();
  if (!rel) {
    return NextResponse.json({ error: "No album with that link on Peak Music." }, { status: 404 });
  }

  // The trigger snaps any date to its Monday and fills in the exact
  // start/end instants, so one pick per week is guaranteed by the
  // unique week_start. Upsert = picking again replaces the album.
  const cleanNote = typeof note === "string" && note.trim() ? note.trim() : null;
  const { data, error } = await supabase
    .from("spotlight_weeks")
    .upsert(
      { release_id: rel.id, week_start, note: cleanNote, created_by: user.id } as never,
      { onConflict: "week_start" }
    )
    .select("id, week_start")
    .single<{ id: string; week_start: string }>();

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message || "Couldn't save the spotlight." },
      { status: 400 }
    );
  }
  return NextResponse.json({ ok: true, id: data.id, week_start: data.week_start, title: rel.title });
}

export async function DELETE(request: NextRequest) {
  const gate = await staffOnly();
  if ("error" in gate) return gate.error;
  const { supabase } = gate;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { id } = (body ?? {}) as { id?: unknown };
  if (!isUuid(id)) {
    return NextResponse.json({ error: "Which week?" }, { status: 400 });
  }
  const { error } = await supabase.from("spotlight_weeks").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
