import { requireAuth } from "@/lib/auth";
import { getReviewBySlug } from "@/lib/db/reviews";
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

  return <ReviewForm mode="edit" review={review} />;
}
