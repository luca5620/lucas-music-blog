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
// LANGUAGES: messages → releases.index. Metadata stays English.
import { getTranslations } from "next-intl/server";

const PAGE_SIZE = 24;

type SortOption = "recent" | "popularity" | "alpha";

// `value` doubles as the key into messages → releases.index.sort.
const SORT_OPTIONS: SortOption[] = ["recent", "popularity", "alpha"];

interface PageProps {
  searchParams: Promise<{
    sort?: string;
    page?: string;
    /** "1" = only unreleased records (Luca 2026-09-03). */
    unreleased?: string;
  }>;
}

// SEO REVIEW 2026-10-22: every ?page=N used to declare /releases (page
// 1) as its canonical, which tells Google "skip me, I'm a copy" — and
// these pages are the ONLY crawl path to most release pages, so ~275
// of them sat in Search Console as "Discovered – currently not
// indexed". Each page number now canonicalizes to itself. Sort and
// the unreleased filter are dropped so they don't multiply the URLs.
export async function generateMetadata({
  searchParams,
}: PageProps): Promise<Metadata> {
  const sp = await searchParams;
  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  return {
    title: pageNum > 1 ? `Releases — page ${pageNum}` : "Releases",
    description:
      "Browse albums, EPs, mixtapes, and singles. Follow releases to be in the room when they drop.",
    alternates: {
      canonical:
        pageNum > 1
          ? `https://peakmusicreviews.com/releases?page=${pageNum}`
          : "https://peakmusicreviews.com/releases",
    },
  };
}

export default async function ReleasesPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const unreleased = sp.unreleased === "1";
  const rawSort = sp.sort;
  // Unreleased has no community-popularity order (the RPC can't
  // filter), so that tab is hidden while the filter is on and a
  // pasted ?sort=popularity falls back to Recent.
  const sort: SortOption =
    (rawSort === "popularity" && !unreleased) || rawSort === "alpha"
      ? rawSort
      : "recent";

  const pageNum = Math.max(1, parseInt(sp.page ?? "1", 10) || 1);
  const offset = (pageNum - 1) * PAGE_SIZE;

  const releases = await listReleases({
    sort,
    limit: PAGE_SIZE,
    offset,
    unreleased,
  });
  const stats = await getReleaseListStats(releases.map((r) => r.id));

  const hasNextPage = releases.length === PAGE_SIZE;
  const hasPrevPage = pageNum > 1;
  const t = await getTranslations("releases.index");

  function makeHref(s: SortOption, p: number, u: boolean = unreleased) {
    const params = new URLSearchParams();
    if (u) params.set("unreleased", "1");
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
        title={t("title")}
        sub={t("sub")}
      />

      {/* App-only: Reviews + Releases share one bottom tab — this
          flips between them. Hidden on web (top nav covers both). */}
      <BrowseSwitch active="releases" />

      {/* Albums with a future release date — countdown shelf. Only on
          the first page so deep pagination stays clean; renders
          nothing when no upcoming releases exist. */}
      {pageNum === 1 && <DroppingSoonRail />}

      {/* Sort tabs + the UNRELEASED filter. The filter is a toggle
          chip set apart from the sorts: on = only records tagged
          unreleased (leaks, snippets, shelved albums — the wedge);
          off = the full catalog. Sort carries across the toggle. */}
      <div className="flex flex-wrap items-center gap-2">
        {SORT_OPTIONS.filter(
          (opt) => !(unreleased && opt === "popularity")
        ).map((opt) => {
          const active = opt === sort;
          return (
            <Link
              key={opt}
              href={makeHref(opt, 1)}
              className={`btn-y2k ${active ? "btn-y2k-primary" : "btn-y2k-outline"}`}
              aria-current={active ? "page" : undefined}
            >
              {t(`sort.${opt}`)}
            </Link>
          );
        })}
        <span className="w-px h-6 bg-white/15 mx-1" aria-hidden />
        <Link
          href={makeHref(sort, 1, !unreleased)}
          className={`btn-y2k ${unreleased ? "btn-y2k-primary" : "btn-y2k-outline"}`}
          aria-pressed={unreleased}
          title={
            unreleased
              ? t("unreleasedOn")
              : t("unreleasedOff")
          }
        >
          {unreleased ? "● " : "○ "}{t("unreleased")}
        </Link>
      </div>

      {/* Empty state */}
      {releases.length === 0 ? (
        <div className="panel-xbox p-8 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-lg text-text-muted">
            {pageNum > 1
              ? t("noMore")
              : unreleased
                ? t("noUnreleased")
                : t("none")}
          </p>
          {pageNum > 1 && (
            <Link
              href={makeHref(sort, 1)}
              className="btn-y2k btn-y2k-outline mt-4 inline-block"
            >
              {t("backToFirst")}
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
              {t("previous")}
            </Link>
          ) : (
            <span />
          )}
          <span className="pixel-text text-xs text-text-muted uppercase tracking-widest">
            {t("page", { n: pageNum })}
          </span>
          {hasNextPage ? (
            <Link
              href={makeHref(sort, pageNum + 1)}
              className="btn-y2k btn-y2k-outline"
            >
              {t("next")}
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </div>
  );
}
