import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { guardRoom, isGuardError, readJson } from "@/lib/aux-battles/guard";
import { cleanSong, isAuxSong } from "@/lib/aux-battles/songs";
import { ensureRelease } from "@/lib/catalog";

/**
 * POST /api/aux-battles/[roomId]/pick  { song: AuxSong }
 *
 * A player puts their song on for the CURRENT game. The card was
 * built by /api/aux-battles/songs (search or link) and comes back from the
 * browser, so it is re-validated here (isAuxSong) before
 * aux_pick_song — the SECURITY DEFINER function that checks the
 * caller really is one of the two players and the game is still in
 * the picking phase, then flips the phase to "listening" once both
 * songs are in.
 *
 * Spotify picks also get their catalog release ensured (the same
 * import the review form does), so the song card can link to the
 * release page and the record exists for rating afterwards. That
 * step fails soft — a battle never waits on an import.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ roomId: string }> }
) {
  const { roomId } = await params;
  const g = await guardRoom(roomId);
  if (isGuardError(g)) return g;
  const { supabase, user, room } = g;

  const limited = await rateLimit(`aux-pick:${user.id}`, 20, 60_000);
  if (limited) return limited;

  if (room.status !== "live" || !room.current_game_id) {
    return NextResponse.json({ error: "Nothing to pick for right now." }, { status: 409 });
  }

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const raw = body.song;
  if (!isAuxSong(raw)) {
    return NextResponse.json({ error: "That song card isn't valid." }, { status: 400 });
  }
  const song = cleanSong(raw);
  // Never trust a release id from the browser — re-derive it.
  delete song.release_id;
  delete song.release_slug;

  if (song.source === "spotify") {
    try {
      const release = await ensureRelease("spotify_track", song.embed_id);
      if (release?.id) {
        song.release_id = release.id;
        song.release_slug = release.slug;
      }
    } catch (err) {
      console.warn("aux pick: release import skipped —", err instanceof Error ? err.message : err);
    }
  }

  const { error } = await supabase.rpc("aux_pick_song", {
    p_game_id: room.current_game_id,
    p_song: song,
  } as never);

  if (error) {
    const msg = error.message ?? "";
    if (/NOT_A_PLAYER/.test(msg)) {
      return NextResponse.json({ error: "You're not in this match." }, { status: 403 });
    }
    if (/NO_TOPIC/.test(msg)) {
      return NextResponse.json({ error: "The host hasn't named this round's topic yet." }, { status: 409 });
    }
    if (/NOT_PICKING/.test(msg)) {
      return NextResponse.json({ error: "Picks are closed for this game." }, { status: 409 });
    }
    if (/BAD_SONG/.test(msg)) {
      return NextResponse.json({ error: "That song card isn't valid." }, { status: 400 });
    }
    console.error("aux pick failed:", msg);
    return NextResponse.json({ error: "Couldn't put the song on. Try again." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, song });
}
