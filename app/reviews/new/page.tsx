import { requireAuth } from "@/lib/auth";
import ReviewForm from "@/components/reviews/ReviewForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Write a Review",
};

export default async function NewReviewPage() {
  await requireAuth();

  return <ReviewForm mode="create" />;
}
