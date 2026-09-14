import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { createNotification } from "@/lib/db/notifications";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-battles/guard";
import type { AuxProfile } from "@/lib/db/aux-battles";

/**
 * GET  /api/aux-battles/[roomId]/invite — who the host can invite:
 *      the people who follow them back (Luca 2026-09-14: "someone you
 *      are friends with (follow each other only)"), each flagged with
 *      whether they're already in the room.
 * POST /api/aux-battles/[roomId]/invite  { userId }
 *      Invite one of them. aux_invite re-checks the mutual follow
 *      server-side and hands them a SEAT, so an invite into a private
 *      room IS the code — they can take a spot without being told six
 *      letters. Then the bell rings (and, because the push trigger
 *      fires on every notification row, their phone does too — no app
 *      rebuild was needed for this).
 */

interface InvitableRow {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  role: AuxProfile["role"];
  already_in: boolean;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, room } = g;

  const { data, error } = await supabase.rpc("aux_invitable", { p_room_id: room.id } as never);
  if (error) {
    console.error("aux invitable failed:", error.message);
    return NextResponse.json({ people: [] });
  }
  const people = ((data ?? []) as InvitableRow[]).map((r) => ({
    profile: {
      id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      role: r.role,
    },
    alreadyIn: r.already_in,
  }));
  return NextResponse.json({ people }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId, { host: true });
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  // Inviting is a message into someone's bell — 30 an hour is a
  // generous lobby and nowhere near a way to pester anyone.
  const limited = await rateLimit(`aux-invite:${user.id}`, 30, 3_600_000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { userId } = body;
  if (typeof userId !== "string" || !isUuid(userId)) {
    return NextResponse.json({ error: "Invalid person." }, { status: 400 });
  }

  const { error } = await supabase.rpc("aux_invite", {
    p_room_id: room.id,
    p_user_id: userId,
  } as never);

  if (error) {
    const msg = error.message ?? "";
    if (/NOT_MUTUAL/.test(msg)) {
      return NextResponse.json(
        { error: "You can only invite people you follow who follow you back." },
        { status: 403 }
      );
    }
    if (/BANNED/.test(msg)) {
      return NextResponse.json({ error: "You blocked them from this room." }, { status: 409 });
    }
    if (/FINISHED/.test(msg)) {
      return NextResponse.json({ error: "This battle is over." }, { status: 409 });
    }
    if (/NOT_HOST/.test(msg)) {
      return NextResponse.json({ error: "Only the host can invite." }, { status: 403 });
    }
    console.error("aux invite failed:", msg);
    return NextResponse.json({ error: "Couldn't send that invite." }, { status: 500 });
  }

  // Best-effort, like every other notification: the seat is already
  // theirs, and a bell hiccup must not read as a failed invite.
  await createNotification({
    recipientId: userId,
    actorId: user.id,
    type: "aux_invite",
    href: `/aux-battles/${room.slug}`,
    title: room.name,
  });

  return NextResponse.json({ ok: true });
}
