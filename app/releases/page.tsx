/**
 * Releases List Page — Browsable archive of all releases.
 * Sort by Recent / Popularity / Alpha.
 *
 * Strategy: listReleases resolves the primary artist name, and one
 * batched getReleaseListStats call covers the whole page's community
 * stats (three queries for 24 cards, not 24 RPCs). Before that landed
 * the grid rendered with no stats at all, so every card claimed to be
 * unreviewed (Luca 2026-09-02).
 */

import Link from "next/link";
import type { Metadata } from "next";
import { listReleases, getReleaseListStats } from "@/lib/db/releases";
import ReleasesIndexClient from "@/components/releases/ReleasesIndexClient";
import DroppingSoonRail from "@/components/releases/DroppingSoonRail";
import { BreadcrumbSchema } from "@/app/schema";
import PageHero from "@/components/ui/PageHero";
import BrowseSwitch from "@/components/ui/BrowseSwitch";
import BackToHome from "@/components/ui/BackToHome";

const PAGE_SIZE = 24;

type SortOption = "recent" | "popularity" | "alpha";

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recent" },
  // Popularity = most reviewed by the community (migration 034), not
  // Spotify's popularity score (Luca 2026-09-02).
  { value: "popularity", label: "Popularity" },
  { value: "alpha", label: "A–Z" },
];

export const metadata: Metadata = {
  title: "Releases",
  description:
    "Browse albums, EPs, mixtapes, and singles. Follow releases to be in the room when they drop.",
  alternates: {
    canonical: "https://peakmusicreviews.com/releases",
  },
};

interface PageProps {
  searchParams: Promise<{
    sort?: string;
    page?: string;
  }>;
}

export default async function ReleasesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const rawSort = sp.sort;
  const sort: SortOption =
    rawSort === "popularity" || rawSort === "alpha" ? rawSort : "recent";

  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const releases = await listReleases({
    sort,
    limit: PAGE_SIZE,
    offset,
  });
  const stats = await getReleaseListStats(releases.map((r) => r.id));

  const hasNextPage = releases.length === PAGE_SIZE;
  const hasPrevPage = pageNum > 1;

  function makeHref(s: SortOption, p: number) {
    const params = new URLSearchParams();
    if (s !== "recent") params.set("sort", s);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `/releases?${qs}` : "/releases";
  }

  return (
    <div className="space-y-8">
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Releases", href: "/releases" },
        ]}
      />

      {/* App-only way back to the home page (this page has no tab) */}
      <BackToHome />

      {/* Page header — boxed hero, same as HOME */}
      <PageHero
        title="RELEASES"
        sub="Albums, EPs, mixtapes, and singles. Follow a release to be in the live room when it drops."
      />

      {/* App-only: Reviews + Releases share one bottom tab — this
          flips between them. Hidden on web (top nav covers both). */}
      <BrowseSwitch active="releases" />

      {/* Albums with a future release date — countdown shelf. Only on
          the first page so deep pagination stays clean; renders
          nothing when no upcoming releases exist. */}
      {pageNum === 1 && <DroppingSoonRail />}

      {/* Sort tabs */}
      <div className="flex flex-wrap gap-2">
        {SORT_OPTIONS.map((opt) => {
          const active = opt.value === sort;
          return (
            <Link
              key={opt.value}
              href={makeHref(opt.value, 1)}
              className={`btn-y2k ${active ? "btn-y2k-primary" : "btn-y2k-outline"}`}
              aria-current={active ? "page" : undefined}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      {/* Empty state */}
      {releases.length === 0 ? (
        <div className="panel-xbox p-8 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-lg text-text-muted">
            {pageNum > 1
              ? "No more releases on this page."
              : "No releases yet. Check back soon."}
          </p>
          {pageNum > 1 && (
            <Link
              href={makeHref(sort, 1)}
              className="btn-y2k btn-y2k-outline mt-4 inline-block"
            >
              ← Back to first page
            </Link>
          )}
        </div>
      ) : (
        /* View-switchable listing (detailed/posters/compact) — shares
           the same persisted preference as every other listing. */
        <ReleasesIndexClient
          items={releases.map((release) => {
            const s = stats.get(release.id);
            return {
              id: release.id,
              slug: release.slug,
              title: release.title,
              cover_image: release.cover_image,
              release_type: release.release_type,
              release_date: release.release_date,
              artistName: release.artistName,
              avgRating: s?.avg_rating ?? null,
              reviewCount: s?.review_count ?? 0,
              followerCount: s?.follower_count ?? 0,
              lastActivityAt: s?.last_activity_at ?? null,
            };
          })}
        />
      )}

      {/* Pagination */}
      {(hasPrevPage || hasNextPage) && (
        <div className="flex items-center justify-between gap-4 pt-4">
          {hasPrevPage ? (
            <Link
              href={makeHref(sort, pageNum - 1)}
              className="btn-y2k btn-y2k-outline"
            >
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            Page {pageNum}
          </span>
          {hasNextPage ? (
            <Link
              href={makeHref(sort, pageNum + 1)}
              className="btn-y2k btn-y2k-outline"
            >
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
