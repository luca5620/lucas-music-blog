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

  // Verify ownership (getReviewBySlug already scopes to user, belt+suspenders)
  if (review.user_id !== user.id) {
    redirect("/reviews/mine");
  }

  // The attached release is fixed for the life of a review. Load it so
  // the form can render the locked-in card and the track checkboxes.
  const release = review.release_id
    ? await getReleaseById(review.release_id)
    : null;
  const artist = release
    ? await getArtistById(release.primary_artist_id)
    : null;

  return (
    <ReviewForm
      mode="edit"
      review={review}
      release={release}
      artistName={artist?.name ?? review.artist}
    />
  );
}
