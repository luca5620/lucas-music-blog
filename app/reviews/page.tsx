/**
 * Reviews Page — the community review wall.
 * Overhaul v2: fully DB-driven. Every review here was written by a
 * member against a real catalog release. Filters run client-side in
 * ReviewsList (genre chips are derived from the data itself).
 *
 * Pagination (SEO review 2026-10-22): the wall used to stop at the
 * newest 100 with no way further back, so Google had no path to older
 * reviews except through release/profile pages (105 review URLs sat
 * in "Discovered – currently not indexed"). Since 2026-10-27 a page
 * holds 30 (was 100); ?page=2, 3… walk back in time, each with its own
 * canonical. The search box + genre chips filter the page you're on.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import { getAllPublishedReviews, type ReviewWithAuthor } from "@/lib/db/reviews";
import { getViewerBlockedIdSet } from "@/lib/db/moderation";
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
// LANGUAGES: hero copy (messages → reviews.index). Metadata stays English.
import { getTranslations } from "next-intl/server";

/** Reviews per page — 30 keeps the wall quick to scroll; "Older" pages hold the rest. */
const PAGE_SIZE = 30;

interface PageProps {
  searchParams: Promise<{ page?: string }>;
}

function parsePage(raw: string | undefined): number {
  return Math.max(1, parseInt(raw ?? "1", 10) || 1);
}

function pageHref(page: number): string {
  return page > 1 ? `/reviews?page=${page}` : "/reviews";
}

// Each page number is its own canonical — pointing page 2 at page 1
// would tell Google to skip it (the bug /releases had).
export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const page = parsePage((await searchParams).page);
  return {
    title: page > 1 ? `Reviews — page ${page}` : "Reviews",
    description:
      "Community album and track reviews — every one tied to a real release from the Spotify catalog or Genius deep cuts. No pretentious jargon, just honest takes.",
    alternates: {
      canonical: `https://peakmusicreviews.com${pageHref(page)}`,
    },
  };
}

// This page reads live community data — never prerender it statically.
export const dynamic = "force-dynamic";

export default async function Reviews({ searchParams }: PageProps) {
  const page = parsePage((await searchParams).page);

  // Over-fetch by one to know whether an older page exists.
  const [fetched, blocked] = await Promise.all([
    getAllPublishedReviews({
      limit: PAGE_SIZE + 1,
      offset: (page - 1) * PAGE_SIZE,
    }) as Promise<ReviewWithAuthor[]>,
    getViewerBlockedIdSet(),
  ]);
  const hasOlder = fetched.length > PAGE_SIZE;

  // Past the last page → a real 404, not an empty wall Google could
  // index as a thin page.
  if (page > 1 && fetched.length === 0) notFound();

  // Blocked authors never reach the viewer's wall (App Store 1.2).
  const reviews = fetched
    .slice(0, PAGE_SIZE)
    .filter((r) => !blocked.has(r.user_id));
  const t = await getTranslations("reviews.index");

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
        title={t("title")}
        sub={t("sub")}
      />

      {/* App-only: Reviews + Releases share one bottom tab — this
          flips between them. Hidden on web (top nav covers both). */}
      <BrowseSwitch active="reviews" />

      {/* Interactive filter + review list */}
      <ReviewsList reviews={reviews} />

      {/* Pagination — plain links so crawlers can walk the archive */}
      {(page > 1 || hasOlder) && (
        <div className="flex items-center justify-between gap-4 pt-4">
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="btn-y2k btn-y2k-outline">
              {t("newer")}
            </Link>
          ) : (
            <span />
          )}
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            {t("page", { n: page })}
          </span>
          {hasOlder ? (
            <Link href={pageHref(page + 1)} className="btn-y2k btn-y2k-outline">
              {t("older")}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
