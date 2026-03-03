/**
 * Reviews Page — Browsable archive of all reviews.
 * Filterable by genre with functional genre toggle buttons.
 * Data sourced from lib/reviews.ts.
 */

import { getAllReviews } from "@/lib/reviews";
import ReviewsList from "@/components/reviews/ReviewsList";
import {
  BreadcrumbSchema,
  CollectionPageSchema,
  ItemListSchema,
} from "@/app/schema";
import FAQSchema from "@/components/seo/FAQSchema";
import { reviewsFAQs } from "@/lib/faq-data";

export const metadata = {
  title: "Reviews",
  description:
    "Browse honest album reviews across R&B, Hip-Hop, Pop, and Alternative. Every rating backed by real Spotify listening data.",
  alternates: {
    canonical: "https://peakmusicreviews.com/reviews",
  },
};

export default function Reviews() {
  const reviews = getAllReviews();

  return (
    <div className="space-y-8">
      {/* JSON-LD Structured Data */}
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Reviews", href: "/reviews" },
        ]}
      />
      <CollectionPageSchema totalItems={reviews.length} />
      <ItemListSchema reviews={reviews} listName="All Music Reviews" />
      <FAQSchema items={reviewsFAQs} />

      {/* Page Header */}
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold text-accent-primary">
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
