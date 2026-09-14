import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isText } from "@/lib/validate";
import { checkContent } from "@/lib/content-filter";
import { slugify } from "@/lib/spotify-import";
import { notifyFollowers } from "@/lib/db/notifications";
import { readJson } from "@/lib/aux-battles/guard";

/**
 * POST /api/aux-battles — host a new aux battle.
 * Body: { name, format: "bo1"|"bo3", judge: "crowd"|"host",
 *         is_private?, host_plays? }
 *
 * The room opens in the LOBBY; players join there and the host taps
 * Start (POST /api/aux-battles/[roomId]/start). A private room also gets its
 * six-letter code minted right here (aux_room_code, host-only RPC) so
 * the host sees it on the very first paint. host_id ALWAYS comes from
 * the session. Public rooms fan out to followers as "hosted an aux
 * battle" — private ones stay quiet.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Hosting is a big action — 10 rooms per user per hour.
  const limited = await rateLimit(`aux-host:${user.id}`, 10, 3_600_000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });

  const { name, format, judge, is_private, is_hidden, host_plays, topic_each_game } = body;

  if (!isText(name, 120) || name.trim().length < 3) {
    return NextResponse.json({ error: "Room name must be 3–120 characters." }, { status: 400 });
  }
  const dirty = checkContent(name);
  if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });
  if (format !== "bo1" && format !== "bo3") {
    return NextResponse.json({ error: "Format must be bo1 or bo3." }, { status: 400 });
  }
  if (judge !== "crowd" && judge !== "host") {
    return NextResponse.json({ error: "Judge must be crowd or host." }, { status: 400 });
  }
  if (is_private !== undefined && typeof is_private !== "boolean") {
    return NextResponse.json({ error: "Invalid private flag." }, { status: 400 });
  }
  if (is_hidden !== undefined && typeof is_hidden !== "boolean") {
    return NextResponse.json({ error: "Invalid hidden flag." }, { status: 400 });
  }
  if (topic_each_game !== undefined && typeof topic_each_game !== "boolean") {
    return NextResponse.json({ error: "Invalid topic flag." }, { status: 400 });
  }
  if (host_plays !== undefined && typeof host_plays !== "boolean") {
    return NextResponse.json({ error: "Invalid host flag." }, { status: 400 });
  }

  const base = slugify(name.trim()).slice(0, 60) || "aux-battle";
  const suffix = Math.random().toString(36).slice(2, 7);
  const slug = `${base}-${suffix}`;

  const { data, error } = await supabase
    .from("aux_rooms")
    .insert({
      slug,
      host_id: user.id,
      name: name.trim(),
      format,
      judge,
      is_private: is_private === true,
      // Hidden only means something for a private room, and it's the
      // opt-IN box (migration 045): private on its own still lets the
      // crowd watch and vote.
      is_hidden: is_private === true && is_hidden === true,
      // A topic per game only means something where there are games
      // to separate: a best-of-3 (migration 046).
      topic_each_game: format === "bo3" && topic_each_game === true,
      host_plays: host_plays !== false,
    } as never)
    .select("*")
    .single();

  if (error || !data) {
    console.error("aux room create failed:", error?.message);
    return NextResponse.json({ error: "Couldn't open the room. Try again." }, { status: 500 });
  }
  const room = data as {
    id: string;
    slug: string;
    is_private: boolean;
    is_hidden: boolean;
    host_plays: boolean;
    name: string;
  };

  // The playing host is a player from the start.
  if (room.host_plays) {
    await supabase
      .from("aux_members")
      .insert({ room_id: room.id, user_id: user.id, role: "player" } as never);
  }

  let code: string | null = null;
  if (room.is_private) {
    const { data: minted } = await supabase.rpc("aux_room_code", { p_room_id: room.id } as never);
    code = typeof minted === "string" ? minted : null;
  }
  // Followers hear about anything they could actually open. A private
  // room is one of those now — they can watch and vote, they just
  // can't take a spot without the code. Only HIDDEN rooms stay quiet.
  if (!room.is_hidden) {
    await notifyFollowers({
      actorId: user.id,
      type: "new_aux",
      href: `/aux-battles/${room.slug}`,
      title: room.name,
    });
  }

  return NextResponse.json({ room: { id: room.id, slug: room.slug }, code }, { status: 201 });
}
