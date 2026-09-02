import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureRelease } from "@/lib/catalog";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /releases/spotify/[albumId] — "open the release for this Spotify
 * album", importing it on first touch (Luca 2026-09-02: playlist-
 * imported list items weren't clickable).
 *
 * Playlist imports store each track's album id instead of importing
 * 100 albums up front (migration 037), so the release may not exist in
 * the catalog yet. This is the bridge: look it up, import it if it's
 * new, then redirect to the canonical /releases/[slug] page. Same
 * import-on-demand rule the catalog already runs on — just triggered
 * by a click on a list item instead of by the search picker.
 *
 * A redirect rather than a rendered page on purpose: the release page
 * stays the single canonical URL, so a shared link, a refresh, and a
 * back-button all land somewhere real.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ albumId: string }> }
) {
  const { albumId } = await params;

  const home = new URL("/lists", request.url);
  if (!/^[A-Za-z0-9]{10,30}$/.test(albumId)) {
    return NextResponse.redirect(home);
  }

  const supabase = await createClient();

  // 1. Already in the catalog? Then anyone — signed in or not — goes
  //    straight through. This is the common case after the first
  //    person clicks a given album.
  const { data: existing } = await supabase
    .from("releases")
    .select("slug")
    .eq("spotify_id", albumId)
    .maybeSingle();

  if (existing) {
    return NextResponse.redirect(
      new URL(`/releases/${(existing as { slug: string }).slug}`, request.url)
    );
  }

  // 2. Not there yet — importing writes to the catalog, and
  //    catalog_import_release is granted to `authenticated` only. Send
  //    a logged-out visitor to sign in and come back to this same URL,
  //    which then resolves for them.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `/releases/spotify/${albumId}`);
    return NextResponse.redirect(login);
  }

  // Imports hit Spotify — same ceiling as /api/catalog/ensure. On trip
  // we bounce to search rather than showing a raw 429.
  const limited = await rateLimit(`catalog-ensure:${user.id}`, 10, 60_000);
  if (limited) {
    return NextResponse.redirect(new URL("/search", request.url));
  }

  try {
    const release = await ensureRelease("spotify", albumId);
    return NextResponse.redirect(
      new URL(`/releases/${release.slug}`, request.url)
    );
  } catch (err) {
    // Album pulled from Spotify, a bad id, an API hiccup — nothing to
    // show, so hand them the search page instead of an error screen.
    console.error("releases/spotify resolve failed —", err);
    return NextResponse.redirect(new URL("/search", request.url));
  }
}
