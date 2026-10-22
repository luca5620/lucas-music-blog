import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  albumPreviews,
  trackPreview,
  previewByName,
  type PreviewTrack,
} from "@/lib/spotify/preview";
import type { Release } from "@/lib/types/database";

/**
 * GET /api/preview?source=<local|spotify|spotify_track|genius>&id=<id>
 *                  [&title=…&artist=…]   (Genius only — matched by name)
 *
 * → { tracks: [{ title, spotify_id, url }] }
 *
 * The 30s previews behind every ▶ button (search results, the picked
 * record in the review form, its tracklist). See lib/spotify/preview.ts
 * for where the audio comes from.
 *
 * Read-only and the same answer for everyone, so it's public (the
 * /search page works signed out) and CDN-cached for a day — a record
 * somebody already previewed costs no function time for the next
 * listener (Vercel's CPU meter is the ceiling we watch). Rate limited
 * per IP like every route.
 */

const ID_RE = /^[A-Za-z0-9]{10,30}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ok(tracks: PreviewTrack[]) {
  return NextResponse.json(
    { tracks },
    {
      headers: {
        "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      },
    }
  );
}

/** A PMR release → the right Spotify door. */
async function previewsForRelease(id: string): Promise<PreviewTrack[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("id, title, spotify_id, tracks, artists!releases_primary_artist_id_fkey(name)")
    .eq("id", id)
    .maybeSingle();
  const row = data as
    | (Pick<Release, "id" | "title" | "spotify_id" | "tracks"> & {
        artists: { name: string } | { name: string }[] | null;
      })
    | null;
  if (!row) return [];

  const tracks = Array.isArray(row.tracks) ? row.tracks : [];
  if (row.spotify_id) {
    // A song picked from search is stored under its TRACK id (one
    // track whose id is the release's own id); everything else is an
    // album id.
    const isTrackRow =
      tracks.length === 1 && tracks[0]?.spotify_id === row.spotify_id;
    return isTrackRow ? trackPreview(row.spotify_id) : albumPreviews(row.spotify_id);
  }
  // Genius-only release: only a single song can be matched by name.
  if (tracks.length <= 1) {
    const artist = Array.isArray(row.artists) ? row.artists[0] : row.artists;
    return previewByName(row.title, artist?.name ?? "");
  }
  return [];
}

export async function GET(request: NextRequest) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const limited = await rateLimit(`preview:${ip}`, 60, 60_000);
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const source = sp.get("source") ?? "";
  const id = sp.get("id") ?? "";

  try {
    if (source === "local" && UUID_RE.test(id)) return ok(await previewsForRelease(id));
    if (source === "spotify" && ID_RE.test(id)) return ok(await albumPreviews(id));
    if (source === "spotify_track" && ID_RE.test(id)) return ok(await trackPreview(id));
    if (source === "genius") {
      const title = (sp.get("title") ?? "").slice(0, 200);
      const artist = (sp.get("artist") ?? "").slice(0, 200);
      return ok(await previewByName(title, artist));
    }
  } catch (err) {
    console.warn("preview failed:", err instanceof Error ? err.message : err);
    // Not cached — a hiccup shouldn't stick for a day.
    return NextResponse.json({ tracks: [] });
  }
  return NextResponse.json({ error: "Invalid source or id" }, { status: 400 });
}
