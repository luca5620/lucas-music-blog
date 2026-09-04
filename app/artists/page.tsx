/**
 * Artists List Page — paginated, sortable browse.
 * Server component reading optional searchParams: ?sort=&page=
 */

import Link from "next/link";
import type { Metadata } from "next";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";
import { listArtists } from "@/lib/db/artists";
import ArtistCard from "@/components/artists/ArtistCard";

export const metadata: Metadata = {
  title: "Artists",
  description:
    "Browse artists on Peak Music Reviews — sort by popularity, recency, or alphabetically.",
  alternates: {
    canonical: "https://peakmusicreviews.com/artists",
  },
};

type SortKey = "popularity" | "recent" | "alpha";

// Labels live in messages (artists.index.sort.<key>).
const SORT_TABS: SortKey[] = ["popularity", "recent", "alpha"];

const PAGE_SIZE = 24;

interface PageProps {
  searchParams: Promise<{ sort?: string; page?: string }>;
}

function parseSort(raw: string | undefined): SortKey {
  if (raw === "recent" || raw === "alpha" || raw === "popularity") return raw;
  return "popularity";
}

function parsePage(raw: string | undefined): number {
  const n = Number(raw ?? "1");
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function buildHref(sort: SortKey, page: number): string {
  const params = new URLSearchParams();
  if (sort !== "popularity") params.set("sort", sort);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `/artists?${qs}` : "/artists";
}

export default async function ArtistsPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const t = await getTranslations("artists.index");
  const sort = parseSort(params.sort);
  const page = parsePage(params.page);
  const offset = (page - 1) * PAGE_SIZE;

  // Over-fetch by 1 to detect "has more"
  const fetched = await listArtists({
    sort,
    limit: PAGE_SIZE + 1,
    offset,
  });
  const hasMore = fetched.length > PAGE_SIZE;
  const artists = hasMore ? fetched.slice(0, PAGE_SIZE) : fetched;

  return (
    <div className="space-y-6">
      {/* ========== HEADER ========== */}
      <div className="space-y-3">
        <h1 className="crt-title text-3xl sm:text-4xl">{t("title")}</h1>
        <p className="text-text-secondary text-sm">
          {t("sub")}
        </p>
        <div className="divider-glow" />
      </div>

      {/* ========== SORT TABS ========== */}
      <div className="flex flex-wrap items-center gap-2">
        {SORT_TABS.map((key) => {
          const active = key === sort;
          return (
            <Link
              key={key}
              href={buildHref(key, 1)}
              className={
                active
                  ? "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider font-[family-name:var(--font-space-grotesk)] bg-accent-primary/15 text-accent-primary border border-accent-primary/30"
                  : "px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider font-[family-name:var(--font-space-grotesk)] text-text-muted border border-border-subtle hover:text-accent-primary hover:border-accent-primary/30 transition-colors"
              }
            >
              {t(`sort.${key}`)}
            </Link>
          );
        })}
      </div>

      {/* ========== GRID ========== */}
      {artists.length === 0 ? (
        <div className="panel-xbox p-8 text-center">
          <p className="font-[family-name:var(--font-vt323)] text-lg text-text-muted">
            {t("empty")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {artists.map((artist) => (
            <ArtistCard key={artist.id} artist={artist} />
          ))}
        </div>
      )}

      {/* ========== PAGINATION ========== */}
      {(page > 1 || hasMore) && (
        <div className="flex items-center justify-between pt-4">
          {page > 1 ? (
            <Link
              href={buildHref(sort, page - 1)}
              className="btn-y2k btn-y2k-outline"
            >
              {t("prev")}
            </Link>
          ) : (
            <span />
          )}

          <span className="pixel-text text-sm text-text-muted">
            {t("page", { n: page })}
          </span>

          {hasMore ? (
            <Link
              href={buildHref(sort, page + 1)}
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
