import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createReview, reviewSlugTaken } from "@/lib/db/reviews";
import { getReleaseById } from "@/lib/db/releases";
import { getArtistById } from "@/lib/db/artists";
import { rateLimit } from "@/lib/rate-limit";
import { isOptionalText, isUuid, parseRating } from "@/lib/validate";

/**
 * POST /api/reviews
 *
 * Overhaul v2 contract: a review can ONLY be written against a real
 * catalog release. The client sends
 *   { release_id, rating, summary?, snippet?, standout_tracks?, is_published? }
 * and everything descriptive (title, artist, cover, release type/date,
 * genre) is derived HERE from the release row. The client never gets
 * to invent metadata — that's what killed the old form.
 */

/**
 * standout_tracks arrive as picks from the release's own track list:
 * [{ title, spotifyUrl? }]. Titles are what we render; spotifyUrl is
 * optional but when present must be a real Spotify link because it's
 * rendered as an <a href> (anything else risks javascript: XSS).
 */
function parseTrackPicks(
  value: unknown
): { title: string; spotifyUrl: string }[] | null {
  if (value == null) return [];
  if (!Array.isArray(value) || value.length > 30) return null;
  const out: { title: string; spotifyUrl: string }[] = [];
  for (const item of value) {
    if (typeof item !== "object" || item === null) return null;
    const title = (item as { title?: unknown }).title;
    const url = (item as { spotifyUrl?: unknown }).spotifyUrl ?? "";
    if (typeof title !== "string" || title.length === 0 || title.length > 200) {
      return null;
    }
    if (typeof url !== "string") return null;
    if (url !== "" && !url.startsWith("https://open.spotify.com/")) return null;
    out.push({ title, spotifyUrl: url });
  }
  return out;
}

/** Build `base-by-username`, adding -2, -3… until the slug is free. */
async function uniqueReviewSlug(
  releaseSlug: string,
  username: string
): Promise<string | null> {
  const safeUser = username.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const base = `${releaseSlug}-by-${safeUser}`.slice(0, 140);
  if (!(await reviewSlugTaken(base))) return base;
  for (let n = 2; n <= 20; n++) {
    const candidate = `${base}-${n}`;
    if (!(await reviewSlugTaken(candidate))) return candidate;
  }
  return null; // 20 collisions means something is wrong — bail.
}

export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Max 5 new reviews per user per 5 minutes.
  const limited = rateLimit(`reviews:${user.id}`, 5, 300_000);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { release_id, rating, summary, snippet, standout_tracks, is_published } =
      body;

    // --- Validate. Nothing in the body is trusted. ---
    if (!isUuid(release_id)) {
      return NextResponse.json(
        { error: "Pick a release from the catalog first." },
        { status: 400 }
      );
    }

    const parsedRating = parseRating(rating);
    if (parsedRating === null) {
      return NextResponse.json(
        { error: "Rating must be between 0 and 10." },
        { status: 400 }
      );
    }

    if (!isOptionalText(snippet, 500) || !isOptionalText(summary, 20000)) {
      return NextResponse.json(
        { error: "A field exceeds its maximum length." },
        { status: 400 }
      );
    }

    const parsedTracks = parseTrackPicks(standout_tracks);
    if (parsedTracks === null) {
      return NextResponse.json(
        { error: "Invalid standout tracks." },
        { status: 400 }
      );
    }

    // --- Load the release; it is the single source of truth. ---
    const release = await getReleaseById(release_id);
    if (!release) {
      return NextResponse.json({ error: "Release not found." }, { status: 400 });
    }

    // Every standout pick must actually be a track on this release —
    // otherwise the "no free text" rule is just a suggestion.
    const releaseTrackTitles = new Set(
      (release.tracks ?? []).map((t) => t.title)
    );
    if (parsedTracks.some((t) => !releaseTrackTitles.has(t.title))) {
      return NextResponse.json(
        { error: "Standout tracks must come from the release's track list." },
        { status: 400 }
      );
    }

    const artist = await getArtistById(release.primary_artist_id);

    // One review per user per release. The friendly path — catch it
    // here instead of letting the insert fail cryptically.
    const supabase = await createClient();
    const { data: dupe } = await supabase
      .from("reviews")
      .select("slug")
      .eq("user_id", user.id)
      .eq("release_id", release.id)
      .limit(1)
      .maybeSingle();
    if (dupe) {
      return NextResponse.json(
        {
          error: "You already reviewed this release — edit that one instead.",
          existing_slug: (dupe as { slug: string }).slug,
        },
        { status: 409 }
      );
    }

    // Username for the slug.
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();
    const username = (profileRow as { username: string } | null)?.username;
    if (!username) {
      return NextResponse.json({ error: "Profile not found." }, { status: 400 });
    }

    const slug = await uniqueReviewSlug(release.slug, username);
    if (!slug) {
      return NextResponse.json(
        { error: "Couldn't generate a review slug. Try again." },
        { status: 500 }
      );
    }

    const review = await createReview({
      user_id: user.id,
      slug,
      // Derived from the catalog — the client never sends these.
      title: release.title,
      artist: artist?.name ?? "Unknown Artist",
      cover_image: release.cover_image,
      release_type: release.release_type,
      release_date: release.release_date,
      genre: artist?.genres?.[0] ?? null,
      // User-authored content.
      rating: parsedRating,
      snippet: snippet || null,
      summary: summary || null,
      standout_tracks: parsedTracks,
      is_published: is_published ?? false,
      review_date: new Date().toISOString().split("T")[0],
      release_id: release.id,
    });

    if (!review) {
      return NextResponse.json(
        { error: "Failed to create review." },
        { status: 500 }
      );
    }

    return NextResponse.json(review, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
