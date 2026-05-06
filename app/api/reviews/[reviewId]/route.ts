import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { updateReview, deleteReview } from "@/lib/db/reviews";
import { getReleaseById } from "@/lib/db/releases";
import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/types/database";

async function getReviewById(reviewId: string): Promise<Review | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*")
    .eq("id", reviewId)
    .single();

  if (error || !data) return null;
  return data as Review;
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reviewId } = await params;

  // Verify ownership
  const existing = await getReviewById(reviewId);
  if (!existing) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      release_id,
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

    // Resolve release_id. The body may either omit it (preserve existing),
    // pass null to clear, or pass a real id to attach. Validate when set.
    let releaseIdValue: string | null = existing.release_id ?? null;
    if (release_id === null) {
      releaseIdValue = null;
    } else if (typeof release_id === "string" && release_id.length > 0) {
      const release = await getReleaseById(release_id);
      if (!release) {
        return NextResponse.json(
          { error: "Release not found" },
          { status: 400 }
        );
      }
      releaseIdValue = release.id;
    }

    const review = await updateReview(reviewId, {
      slug: slug || existing.slug,
      title: title.trim(),
      artist: artist.trim(),
      rating,
      genre: genre || null,
      release_type: release_type || null,
      release_date: release_date || null,
      review_date: review_date || existing.review_date,
      cover_image: cover_image || null,
      snippet: snippet || null,
      summary: summary || null,
      standout_tracks: standout_tracks || [],
      is_published: is_published ?? existing.is_published,
      release_id: releaseIdValue,
    });

    if (!review) {
      return NextResponse.json(
        { error: "Failed to update review." },
        { status: 500 }
      );
    }

    return NextResponse.json(review);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ reviewId: string }> }
) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { reviewId } = await params;

  // Verify ownership
  const existing = await getReviewById(reviewId);
  if (!existing) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }

  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const success = await deleteReview(reviewId);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to delete review." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
