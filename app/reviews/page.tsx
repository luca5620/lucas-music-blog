/**
 * Reviews Page — the community review wall.
 * Overhaul v2: fully DB-driven. Every review here was written by a
 * member against a real catalog release. Filters run client-side in
 * ReviewsList (genre chips are derived from the data itself).
 */

import { getAllPublishedReviews, type ReviewWithAuthor } from "@/lib/db/reviews";
import ReviewsList from "@/components/reviews/ReviewsList";
import {
  BreadcrumbSchema,
  CollectionPageSchema,
  ItemListSchema,
} from "@/app/schema";
import FAQSchema from "@/components/seo/FAQSchema";
import PageHero from "@/components/ui/PageHero";
import BrowseSwitch from "@/components/ui/BrowseSwitch";
import BackToHome from "@/components/ui/BackToHome";
import { reviewsFAQs } from "@/lib/faq-data";

export const metadata = {
  title: "Reviews",
  description:
    "Community album and track reviews — every one tied to a real release from the Spotify catalog or Genius deep cuts. No pretentious jargon, just honest takes.",
  alternates: {
    canonical: "https://peakmusicreviews.com/reviews",
  },
};

// This page reads live community data — never prerender it statically.
export const dynamic = "force-dynamic";

export default async function Reviews() {
  const reviews = (await getAllPublishedReviews({
    limit: 100,
  })) as ReviewWithAuthor[];

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
      <ItemListSchema
        reviews={reviews.map((r) => ({
          slug: r.slug,
          title: r.title,
          artist: r.artist,
          rating: r.rating,
          authorName: r.profiles?.display_name ?? r.profiles?.username ?? "Peak Music Reviews member",
          authorUsername: r.profiles?.username ?? null,
          datePublished: r.review_date ?? r.created_at ?? null,
        }))}
        listName="Community Music Reviews"
      />
      <FAQSchema items={reviewsFAQs} />

      {/* App-only way back to the home page (this page has no tab) */}
      <BackToHome />

      {/* Page Header — boxed hero, same as HOME */}
      <PageHero
        title="REVIEWS"
        sub="Honest takes from the whole community. Every review is tied to a real release — no filler, no fake entries."
      />

      {/* App-only: Reviews + Releases share one bottom tab — this
          flips between them. Hidden on web (top nav covers both). */}
      <BrowseSwitch active="reviews" />

      {/* Interactive filter + review list */}
      <ReviewsList reviews={reviews} />
    </div>
  );
}
