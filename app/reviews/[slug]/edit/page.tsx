import { requireAuth } from "@/lib/auth";
import { getReviewBySlug } from "@/lib/db/reviews";
import { getReleaseById } from "@/lib/db/releases";
import { getArtistById } from "@/lib/db/artists";
import ReviewForm from "@/components/reviews/ReviewForm";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Edit Review",
};

export default async function EditReviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireAuth();
  const { slug } = await params;

  const review = await getReviewBySlug(user.id, slug);

  if (!review) {
    notFound();
  }

  // Verify ownership
  if (review.user_id !== user.id) {
    redirect("/reviews/mine");
  }

  // If the review is attached to a canonical release, hydrate the chip.
  let initialRelease:
    | { id: string; title: string; artist_name: string; cover_image: string | null }
    | undefined;
  if (review.release_id) {
    const release = await getReleaseById(review.release_id);
    if (release) {
      const artist = await getArtistById(release.primary_artist_id);
      initialRelease = {
        id: release.id,
        title: release.title,
        artist_name: artist?.name ?? review.artist,
        cover_image: release.cover_image,
      };
    }
  }

  return (
    <ReviewForm mode="edit" review={review} initialRelease={initialRelease} />
  );
}
