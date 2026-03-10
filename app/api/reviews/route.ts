import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createReview } from "@/lib/db/reviews";

export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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
    } = body;

    // Validate required fields
    if (!title?.trim() || !artist?.trim()) {
      return NextResponse.json(
        { error: "Title and artist are required." },
        { status: 400 }
      );
    }

    if (rating === undefined || rating < 0 || rating > 10) {
      return NextResponse.json(
        { error: "Rating must be between 0 and 10." },
        { status: 400 }
      );
    }

    if (!slug?.trim()) {
      return NextResponse.json(
        { error: "Could not generate slug. Check title and artist." },
        { status: 400 }
      );
    }

    const review = await createReview({
      user_id: user.id,
      slug,
      title: title.trim(),
      artist: artist.trim(),
      rating,
      genre: genre || null,
      release_type: release_type || null,
      release_date: release_date || null,
      review_date: review_date || new Date().toISOString().split("T")[0],
      cover_image: cover_image || null,
      snippet: snippet || null,
      summary: summary || null,
      standout_tracks: standout_tracks || [],
      is_published: is_published ?? false,
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
