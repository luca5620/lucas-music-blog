import { requireAuth } from "@/lib/auth";
import ReviewForm from "@/components/reviews/ReviewForm";
import { getReleaseById } from "@/lib/db/releases";
import { getArtistById } from "@/lib/db/artists";
import type { Release } from "@/lib/types/database";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Write a Review",
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * /reviews/new — optionally pre-loaded with a release.
 *
 * Release pages link here as /reviews/new?release_id=<uuid> ("Be the
 * first to review this"), so the record you were just looking at is
 * already locked in — no searching for it a second time. Without the
 * param (nav "Review" button) the form starts with the search box.
 */
export default async function NewReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ release_id?: string }>;
}) {
  await requireAuth();

  const { release_id } = await searchParams;

  // Pre-load the release when a valid id was handed over. Any problem
  // (bad id, deleted release) just falls back to the search flow —
  // never an error page for a stale link.
  let release: Release | null = null;
  let artistName = "";
  if (release_id && UUID_RE.test(release_id)) {
    release = await getReleaseById(release_id);
    if (release) {
      const artist = await getArtistById(release.primary_artist_id);
      artistName = artist?.name ?? "";
    }
  }

  return (
    <ReviewForm
      mode="create"
      release={release}
      artistName={artistName || undefined}
    />
  );
}
