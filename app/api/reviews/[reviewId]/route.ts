import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { updateReview, deleteReview } from "@/lib/db/reviews";
import { getReleaseById } from "@/lib/db/releases";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import type { Review } from "@/lib/types/database";
import { isOptionalText, parseRating } from "@/lib/validate";
import { notifyFollowers } from "@/lib/db/notifications";
import { checkContent } from "@/lib/content-filter";

/**
 * PUT /api/reviews/[reviewId]
 *
 * Overhaul v2: the attached release is FIXED for the life of a
 * review — you can't retarget a review at a different album, and
 * you can't hand-edit title/artist/cover (those always mirror the
 * catalog). Only the user-authored parts are mutable:
 *   rating, summary, snippet, standout_tracks, is_published.
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

  const limited = await rateLimit(`reviews-edit:${user.id}`, 20, 300_000);
  if (limited) return limited;

  const { reviewId } = await params;

  // Verify ownership before reading the body — cheapest check first.
  const existing = await getReviewById(reviewId);
  if (!existing) {
    return NextResponse.json({ error: "Review not found." }, { status: 404 });
  }
  if (existing.user_id !== user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { rating, summary, snippet, standout_tracks, is_published } = body;

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

    // Zero-tolerance filter (App Store 1.2) — slurs never hit the DB.
    const dirty = checkContent(snippet, summary);
    if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

    const parsedTracks = parseTrackPicks(standout_tracks);
    if (parsedTracks === null) {
      return NextResponse.json(
        { error: "Invalid favorite tracks." },
        { status: 400 }
      );
    }

    // Standout picks must still belong to the attached release.
    if (existing.release_id && parsedTracks.length > 0) {
      const release = await getReleaseById(existing.release_id);
      const titles = new Set((release?.tracks ?? []).map((t) => t.title));
      if (parsedTracks.some((t) => !titles.has(t.title))) {
        return NextResponse.json(
          { error: "Personal favorites must come from the release's track list." },
          { status: 400 }
        );
      }
    }

    const review = await updateReview(reviewId, {
      rating: parsedRating,
      snippet: snippet || null,
      summary: summary || null,
      standout_tracks: parsedTracks,
      is_published: is_published ?? existing.is_published,
    });

    if (!review) {
      return NextResponse.json(
        { error: "Failed to update review." },
        { status: 500 }
      );
    }

    // A draft going live is the first moment followers should hear
    // about it. notifyFollowers dedups on (actor, type, href), so an
    // unpublish/republish loop can't refill anyone's bell.
    if (!existing.is_published && is_published === true) {
      await notifyFollowers({
        actorId: user.id,
        type: "new_review",
        href: `/reviews/${existing.slug}`,
        title: existing.title,
      });
    }

    return NextResponse.json(review);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
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
