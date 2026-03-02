/**
 * Reviews Page — Browsable archive of all reviews.
 * Filterable by genre with functional genre toggle buttons.
 * Data sourced from lib/reviews.ts.
 */

import { getAllReviews } from "@/lib/reviews";
import ReviewsList from "@/components/reviews/ReviewsList";

export default function Reviews() {
  const reviews = getAllReviews();

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold text-accent-primary">
          Reviews
        </h1>
        <p className="text-text-secondary">
          Honest takes on albums and tracks. No filler, no pretentious breakdowns.
        </p>
      </div>

      {/* Interactive filter + review list */}
      <ReviewsList reviews={reviews} />
    </div>
  );
}
