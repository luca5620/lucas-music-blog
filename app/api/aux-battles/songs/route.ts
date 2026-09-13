import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  SONG_SOURCES,
  searchSongs,
  searchableSources,
  songFromLink,
  type SongSource,
} from "@/lib/aux-battles/songs";
import { readJson } from "@/lib/aux-battles/guard";

/**
 * GET  /api/aux-battles/songs?q=…&source=spotify|soundcloud|youtube
 *      → { results: AuxSong[], searchable: {spotify, soundcloud, youtube} }
 * POST /api/aux-battles/songs  { url }
 *      → { song: AuxSong }   (a pasted Spotify / SoundCloud / YouTube link)
 *
 * The song picker's two doors. Search needs the service's key on the
 * server (searchable says which are on); a pasted link never needs
 * one, so every source always has a way in.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  // Search hits paid quotas (YouTube: 100 units a call) — keep it tight.
  const limited = await rateLimit(`aux-search:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim().slice(0, 120);
  const source = searchParams.get("source") as SongSource | null;
  const searchable = searchableSources();

  if (!source || !SONG_SOURCES.includes(source)) {
    return NextResponse.json({ error: "Unknown source." }, { status: 400 });
  }
  if (q.length < 2) {
    return NextResponse.json({ results: [], searchable });
  }
  if (!searchable[source]) {
    return NextResponse.json({ results: [], searchable, notice: "link-only" });
  }
  const results = await searchSongs(q, source, 8);
  return NextResponse.json({ results, searchable });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limited = await rateLimit(`aux-link:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const body = await readJson(request);
  if (!body) return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  const { url } = body;
  if (typeof url !== "string" || url.trim().length < 10 || url.length > 500) {
    return NextResponse.json({ error: "Paste a Spotify, SoundCloud or YouTube link." }, { status: 400 });
  }
  const song = await songFromLink(url);
  if (!song) {
    return NextResponse.json(
      { error: "Couldn't read that link. It has to be a Spotify track, a SoundCloud track or a YouTube video." },
      { status: 422 }
    );
  }
  return NextResponse.json({ song });
}
