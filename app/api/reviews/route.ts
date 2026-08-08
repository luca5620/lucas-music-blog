import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createReview } from "@/lib/db/reviews";
import { getReleaseById } from "@/lib/db/releases";
import { rateLimit } from "@/lib/rate-limit";
import {
  isSafeSlug,
  isText,
  isOptionalText,
  isOptionalSafeUrl,
  isUuid,
  parseRating,
  parseStandoutTracks,
} from "@/lib/validate";

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

    const {
      title,
      artist,
      slug,
      rating,
      genre,
      release_type,
      release_date,
      cover_image,
      snippet,
      summary,
      standout_tracks,
      is_published,
      review_date,
      release_id,
    } = body;

    // --- Validate every field. Nothing from the request body is trusted. ---
    if (!isText(title, 200) || !isText(artist, 200)) {
      return NextResponse.json(
        { error: "Title and artist are required (max 200 characters)." },
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

    if (!isSafeSlug(slug)) {
      return NextResponse.json(
        { error: "Could not generate slug. Check title and artist." },
        { status: 400 }
      );
    }

    if (!isOptionalText(genre, 60) || !isOptionalText(snippet, 500) || !isOptionalText(summary, 20000)) {
      return NextResponse.json(
        { error: "A field exceeds its maximum length." },
        { status: 400 }
      );
    }

    // cover_image is rendered as <img src>, so it must be https or a local path.
    if (!isOptionalSafeUrl(cover_image)) {
      return NextResponse.json(
        { error: "Cover image must be an https URL." },
        { status: 400 }
      );
    }

    // standout_tracks are rendered as links — enforce Spotify https URLs only.
    const parsedTracks = parseStandoutTracks(standout_tracks);
    if (parsedTracks === null) {
      return NextResponse.json(
        { error: "Invalid standout tracks." },
        { status: 400 }
      );
    }

    const allowedReleaseTypes = ["single", "EP", "album", "mixtape"];
    if (release_type != null && !allowedReleaseTypes.includes(release_type)) {
      return NextResponse.json(
        { error: "Invalid release type." },
        { status: 400 }
      );
    }

    // Validate release_id (if provided) refers to a real release
    let releaseIdValue: string | null = null;
    if (release_id) {
      if (!isUuid(release_id)) {
        return NextResponse.json({ error: "Invalid release id" }, { status: 400 });
      }
      const release = await getReleaseById(release_id);
      if (!release) {
        return NextResponse.json(
          { error: "Release not found" },
          { status: 400 }
        );
      }
      releaseIdValue = release.id;
    }

    const review = await createReview({
      user_id: user.id,
      slug,
      title: title.trim(),
      artist: artist.trim(),
      rating: parsedRating,
      genre: genre || null,
      release_type: release_type || null,
      release_date: release_date || null,
      review_date: review_date || new Date().toISOString().split("T")[0],
      cover_image: cover_image || null,
      snippet: snippet || null,
      summary: summary || null,
      standout_tracks: parsedTracks,
      is_published: is_published ?? false,
      release_id: releaseIdValue,
    });

    if (!review) {
      return NextResponse.json(
        { error: "Failed to create review. The slug may already exist." },
        { status: 500 }
      );
    }

    return NextResponse.json(review, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
