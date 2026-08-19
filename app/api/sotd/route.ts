import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid, isText } from "@/lib/validate";
import { getReleaseById } from "@/lib/db/releases";
import { getArtistById } from "@/lib/db/artists";

/**
 * POST /api/sotd  { release_id, track_title }
 *
 * Sets (or changes) TODAY's song of the day. Same catalog-first
 * philosophy as reviews: the client sends only a release id and
 * which track on it; artist/cover/link are derived server-side so
 * nothing display-worthy is ever user-typed.
 *
 * Streak honesty rule: the pick must differ from YESTERDAY's —
 * re-submitting the same track daily isn't a streak, it's a macro.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = rateLimit(`sotd:${user.id}`, 15, 3600_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { release_id, track_title } = (body ?? {}) as {
    release_id?: string;
    track_title?: string;
  };

  if (!isUuid(release_id) || !isText(track_title, 300)) {
    return NextResponse.json(
      { error: "Pick a release and a track." },
      { status: 400 }
    );
  }

  // Load the release and verify the track actually exists on it.
  const release = await getReleaseById(release_id);
  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }
  const track = (release.tracks ?? []).find((t) => t.title === track_title);
  if (!track) {
    return NextResponse.json(
      { error: "That track isn't on this release." },
      { status: 400 }
    );
  }

  const artist = await getArtistById(release.primary_artist_id);
  const artistName = artist?.name ?? "Unknown Artist";

  // Best link target: 30s preview → Spotify track page → our release page.
  const trackUrl =
    track.preview_url ||
    (track.spotify_id
      ? `https://open.spotify.com/track/${track.spotify_id}`
      : `/releases/${release.slug}`);

  // Yesterday's pick must differ (same release AND same track = lazy).
  const yesterday = new Date(Date.now() - 86_400_000)
    .toISOString()
    .slice(0, 10);
  const { data: prev } = await supabase
    .from("song_of_day")
    .select("release_id, track_title")
    .eq("user_id", user.id)
    .eq("picked_on", yesterday)
    .maybeSingle();

  if (
    prev &&
    (prev as { release_id: string | null; track_title: string }).release_id ===
      release_id &&
    (prev as { track_title: string }).track_title === track.title
  ) {
    return NextResponse.json(
      { error: "Same song as yesterday — pick something new to keep the streak honest." },
      { status: 409 }
    );
  }

  // Upsert today's row: setting it again just changes today's pick.
  const today = new Date().toISOString().slice(0, 10);
  const { error } = await supabase.from("song_of_day").upsert(
    {
      user_id: user.id,
      picked_on: today,
      release_id,
      track_title: track.title,
      artist: artistName,
      cover_image: release.cover_image,
      track_url: trackUrl,
    } as never,
    { onConflict: "user_id,picked_on" }
  );

  if (error) {
    console.error("sotd upsert failed:", error.message);
    return NextResponse.json(
      { error: "Couldn't save today's song — try again." },
      { status: 500 }
    );
  }

  // Fresh streak for instant UI feedback.
  const { data: streak } = await supabase.rpc("get_sotd_streak", {
    user_uuid: user.id,
  } as never);

  return NextResponse.json({ ok: true, streak: streak ?? 1 });
}
