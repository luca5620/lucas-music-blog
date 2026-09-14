import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { isUuid } from "@/lib/validate";
import type { AuxRoom, Database } from "@/lib/types/database";

/**
 * The shared front door of every /api/aux-wars/[roomId]/* route: a signed-in
 * member, a valid room id, a room the caller is allowed to SEE (RLS
 * hides private rooms from outsiders, so a null read is a 404 — not a
 * leak about whether the room exists), and optionally "must be the
 * host". Returns either the bundle the route needs or the NextResponse
 * to send straight back.
 */
export type Guarded = {
  supabase: SupabaseClient<Database>;
  user: User;
  room: AuxRoom;
};

export async function guardRoom(
  roomId: string,
  opts: { host?: boolean } = {}
): Promise<Guarded | NextResponse> {
  if (!isUuid(roomId)) {
    return NextResponse.json({ error: "Invalid room." }, { status: 400 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { data } = await supabase.from("aux_rooms").select("*").eq("id", roomId).maybeSingle();
  const room = data as unknown as AuxRoom | null;
  if (!room) {
    return NextResponse.json({ error: "Room not found." }, { status: 404 });
  }
  if (opts.host && room.host_id !== user.id) {
    return NextResponse.json({ error: "Only the host can do that." }, { status: 403 });
  }
  return { supabase, user, room };
}

export function isGuardError(g: Guarded | NextResponse): g is NextResponse {
  return g instanceof NextResponse;
}

/** Parse a JSON body, or null when it isn't JSON at all. */
export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = (await request.json()) as unknown;
    return body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  } catch {
    return null;
  }
}
