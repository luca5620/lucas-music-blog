import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureRelease } from "@/lib/catalog";
import { rateLimit } from "@/lib/rate-limit";
import { pingIndexNow } from "@/lib/indexnow";

/**
 * GET /catalog/open/[source]/[id] — "open the page for this record",
 * creating it on the spot if PMR doesn't have it yet.
 *
 * Luca 2026-10-22: "when people search it should still find whatever
 * album or music in general that they want, meaning that the page will
 * get generated on the spot for the users convenience instead of doing
 * the workaround through write a review." The /search page now lists
 * Spotify + Genius results next to PMR's own; tapping one that isn't
 * here yet lands on this route, which imports it (the same on-demand
 * import the review picker uses) and redirects to the real release
 * page. Same idea as /releases/spotify/[albumId] (playlist items), for
 * every source.
 *
 * A redirect rather than a rendered page on purpose: /releases/[slug]
 * stays the single canonical URL, so a shared link, a refresh, and the
 * back button all land somewhere real.
 *
 * Signed out: importing writes to the catalog (catalog_import_release
 * is granted to members only), so a visitor is sent to log in and comes
 * straight back here. Links to this route carry rel="nofollow", and a
 * crawler that follows one anyway only ever reaches the login page.
 */

const SOURCES = ["spotify", "spotify_track", "genius"] as const;
type Source = (typeof SOURCES)[number];

const VALID_ID: Record<Source, (id: string) => boolean> = {
  spotify: (id) => /^[A-Za-z0-9]{10,30}$/.test(id),
  spotify_track: (id) => /^[A-Za-z0-9]{10,30}$/.test(id),
  genius: (id) => /^[0-9]{1,12}$/.test(id),
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ source: string; id: string }> }
) {
  const { source, id } = await params;
  const back = new URL("/search", request.url);

  if (!(SOURCES as readonly string[]).includes(source) || !VALID_ID[source as Source](id)) {
    return NextResponse.redirect(back);
  }

  const supabase = await createClient();

  // 1. Already in the catalog? Anyone — signed in or not — goes
  //    straight through. Common case after the first person opens it.
  const column = source === "genius" ? "genius_id" : "spotify_id";
  const value = source === "genius" ? `song:${id}` : id;
  const { data: existing } = await supabase
    .from("releases")
    .select("slug")
    .eq(column, value)
    .maybeSingle();
  if (existing) {
    return NextResponse.redirect(
      new URL(`/releases/${(existing as { slug: string }).slug}`, request.url)
    );
  }

  // 2. Not here yet — members only (see header).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", `/catalog/open/${source}/${id}`);
    return NextResponse.redirect(login);
  }

  // Imports hit Spotify/Genius — same lane + ceiling as
  // /api/catalog/ensure. On a trip, back to search, not a raw 429.
  const limited = await rateLimit(`catalog-ensure:${user.id}`, 10, 60_000);
  if (limited) return NextResponse.redirect(back);

  try {
    const release = await ensureRelease(source as Source, id);
    // A brand-new page — tell Bing now rather than at the next crawl.
    void pingIndexNow([`/releases/${release.slug}`]);
    return NextResponse.redirect(new URL(`/releases/${release.slug}`, request.url));
  } catch (err) {
    console.error("catalog/open failed —", err);
    return NextResponse.redirect(back);
  }
}
