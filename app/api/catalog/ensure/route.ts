import { NextRequest, NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { ensureRelease } from "@/lib/catalog";
import { pingIndexNow } from "@/lib/indexnow";
import { UPCOMING_RELEASES_TAG } from "@/lib/db/releases";
import { hasDropped } from "@/lib/upcoming";

/**
 * POST /api/catalog/ensure  { source: "local"|"spotify"|"genius", id: string }
 *
 * Guarantees a release exists in the local catalog, importing it
 * from Spotify or Genius on first touch. Returns the release row
 * ({ id, slug, title, ... }) so the caller can attach a review or
 * list item to it.
 *
 * Writes go through the insert-only catalog_import_release SQL
 * function — users can seed catalog rows but never modify them.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { source, id } = (body ?? {}) as { source?: string; id?: string };

  // Two rate-limit lanes (2026-10-05). Real imports hit Spotify/Genius,
  // so they keep the low 10-a-minute ceiling. A "local" pick is just a
  // read of a row that's already in our catalog — no external API, no
  // write — and was burning the SAME 10/min bucket, so someone picking
  // records quickly (the first-rating screen's search, the review
  // form's "rate another" loop) hit "Too many requests" on records we
  // already had. It still gets a ceiling (every route does), just a
  // generous one of its own. Checked AFTER parsing the body because
  // the lane depends on the source; a bad body costs nothing anyway.
  const limited =
    source === "local"
      ? await rateLimit(`catalog-ensure-local:${user.id}`, 60, 60_000)
      : await rateLimit(`catalog-ensure:${user.id}`, 10, 60_000);
  if (limited) return limited;

  const validSources = ["local", "spotify", "spotify_track", "genius"];
  if (
    !validSources.includes(source ?? "") ||
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > 64
  ) {
    return NextResponse.json({ error: "Invalid source or id" }, { status: 400 });
  }

  try {
    const release = await ensureRelease(
      source as "local" | "spotify" | "spotify_track" | "genius",
      id
    );
    // A release page that didn't exist a second ago now does — tell
    // Bing (ChatGPT's search) rather than wait for the sitemap crawl.
    // Fire and forget; "local" means it already existed, so no ping.
    if (source !== "local" && release?.slug) {
      void pingIndexNow([`/releases/${release.slug}`]);
    }
    // A pasted link for an album that hasn't dropped yet belongs on
    // the Dropping Soon shelf NOW, on home and /releases alike — not
    // whenever each page's five-minute cache happens to roll over.
    if (source !== "local" && release?.release_date && !hasDropped(release.release_date)) {
      revalidateTag(UPCOMING_RELEASES_TAG, { expire: 0 });
    }
    return NextResponse.json({ release });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Import failed";
    console.error("catalog ensure failed:", msg);
    return NextResponse.json(
      { error: "Couldn't import that release. Try another result." },
      { status: 502 }
    );
  }
}
