import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import type { Profile } from "@/lib/types/database";

/**
 * POST /api/admin/badge  { username, role }
 *
 * Luca's badge tool: set a user's verification badge (the profiles
 * role column) by username. Owner-only — checked here for a clean
 * error, and again inside the grant_badge RPC (migration 019), which
 * is what actually holds the key past RLS. 'owner' is never
 * grantable: the gold Founder badge stays exclusive.
 */

const GRANTABLE = ["user", "reviewer", "admin", "tester"] as const;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profileData } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  const role = (profileData as Pick<Profile, "role"> | null)?.role;
  if (role !== "owner") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const limited = await rateLimit(`admin-badge:${user.id}`, 30, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { username, role: newRole } = (body ?? {}) as {
    username?: string;
    role?: string;
  };
  if (
    typeof username !== "string" ||
    !username.trim() ||
    username.length > 30 ||
    !GRANTABLE.includes(newRole as (typeof GRANTABLE)[number])
  ) {
    return NextResponse.json(
      { error: "Pick a username and a grantable badge." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase.rpc("grant_badge", {
    target_username: username.trim(),
    new_role: newRole,
  } as never);

  if (error) {
    // The RPC's raise-exception messages are written to be shown.
    return NextResponse.json(
      { error: error.message || "Couldn't set the badge." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, username: username.trim(), role: data });
}
