/**
 * /your-taste — the "For You" channel.
 *
 * Everything on this page is computed from YOUR data: who you
 * follow (people + artists), what you've followed as releases,
 * and what you've reviewed. No black-box algorithm — each section
 * says exactly why it's showing you something.
 *
 * Sections:
 *   1. BECAUSE YOU FOLLOW — releases by artists you follow that
 *      you haven't reviewed yet.
 *   2. YOUR PEOPLE RATED — recent reviews from people you follow.
 *   3. ANTICIPATED — releases you follow, unreleased/newest first.
 *   4. YOUR YEAR — your own quick stats for the current year.
 *
 * Server component; auth required (middleware also gates nothing
 * here, so we redirect ourselves via requireAuth).
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getRatingHex } from "@/lib/rating";

export const metadata = {
  title: "Your Taste",
  robots: { index: false, follow: false },
};

// Per-viewer page — always render fresh.
export const dynamic = "force-dynamic";

/* --- Row shapes for the inline queries --- */

interface PosterRelease {
  id: string;
  slug: string;
  title: string;
  cover_image: string | null;
  release_date: string | null;
  is_unreleased: boolean;
  artist_name: string;
}

interface FriendReview {
  slug: string;
  title: string;
  artist: string;
  rating: number;
  cover_image: string | null;
  username: string;
}

/** Only https:// or local /path images (stored-XSS defense). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

export default async function YourTastePage() {
  const user = await requireAuth();
  const supabase = await createClient();

  /* ---- Gather the viewer's graph in parallel ---- */
  const [artistFollowsRes, releaseFollowsRes, peopleFollowsRes, myReviewsRes] =
    await Promise.all([
      supabase
        .from("artist_follows")
        .select("artist_id")
        .eq("follower_id", user.id),
      supabase
        .from("release_follows")
        .select("release_id")
        .eq("follower_id", user.id),
      supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", user.id),
      supabase
        .from("reviews")
        .select("release_id, artist, rating, created_at")
        .eq("user_id", user.id),
    ]);

  const artistIds = (artistFollowsRes.data ?? []).map(
    (r) => (r as { artist_id: string }).artist_id
  );
  const followedReleaseIds = (releaseFollowsRes.data ?? []).map(
    (r) => (r as { release_id: string }).release_id
  );
  const peopleIds = (peopleFollowsRes.data ?? []).map(
    (r) => (r as { following_id: string }).following_id
  );
  const myReviews = (myReviewsRes.data ?? []) as {
    release_id: string | null;
    artist: string;
    rating: number;
    created_at: string;
  }[];
  const reviewedReleaseIds = new Set(
    myReviews.map((r) => r.release_id).filter(Boolean) as string[]
  );

  /* ---- Section 1: releases by artists you follow, unreviewed ---- */
  let becauseYouFollow: PosterRelease[] = [];
  if (artistIds.length > 0) {
    const { data } = await supabase
      .from("releases")
      .select(
        "id, slug, title, cover_image, release_date, is_unreleased, artists!releases_primary_artist_id_fkey(name)"
      )
      .in("primary_artist_id", artistIds)
      .order("release_date", { ascending: false, nullsFirst: false })
      .limit(24);

    type Row = {
      id: string;
      slug: string;
      title: string;
      cover_image: string | null;
      release_date: string | null;
      is_unreleased: boolean;
      artists: { name: string } | { name: string }[] | null;
    };
    becauseYouFollow = ((data ?? []) as unknown as Row[])
      .filter((r) => !reviewedReleaseIds.has(r.id))
      .slice(0, 12)
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        cover_image: r.cover_image,
        release_date: r.release_date,
        is_unreleased: r.is_unreleased ?? false,
        artist_name: Array.isArray(r.artists)
          ? r.artists[0]?.name ?? ""
          : r.artists?.name ?? "",
      }));
  }

  /* ---- Section 2: recent reviews from people you follow ---- */
  let friendReviews: FriendReview[] = [];
  if (peopleIds.length > 0) {
    const { data } = await supabase
      .from("reviews")
      .select(
        "slug, title, artist, rating, cover_image, profiles!inner(username)"
      )
      .in("user_id", peopleIds)
      .eq("is_published", true)
      .order("created_at", { ascending: false })
      .limit(12);

    type Row = {
      slug: string;
      title: string;
      artist: string;
      rating: number;
      cover_image: string | null;
      profiles: { username: string } | { username: string }[] | null;
    };
    friendReviews = ((data ?? []) as unknown as Row[]).map((r) => ({
      slug: r.slug,
      title: r.title,
      artist: r.artist,
      rating: Number(r.rating),
      cover_image: r.cover_image,
      username: Array.isArray(r.profiles)
        ? r.profiles[0]?.username ?? ""
        : r.profiles?.username ?? "",
    }));
  }

  /* ---- Section 3: releases you follow — unreleased/newest first ---- */
  let anticipated: PosterRelease[] = [];
  if (followedReleaseIds.length > 0) {
    const { data } = await supabase
      .from("releases")
      .select(
        "id, slug, title, cover_image, release_date, is_unreleased, artists!releases_primary_artist_id_fkey(name)"
      )
      .in("id", followedReleaseIds)
      .limit(24);

    type Row = {
      id: string;
      slug: string;
      title: string;
      cover_image: string | null;
      release_date: string | null;
      is_unreleased: boolean;
      artists: { name: string } | { name: string }[] | null;
    };
    anticipated = ((data ?? []) as unknown as Row[])
      .map((r) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        cover_image: r.cover_image,
        release_date: r.release_date,
        is_unreleased: r.is_unreleased ?? false,
        artist_name: Array.isArray(r.artists)
          ? r.artists[0]?.name ?? ""
          : r.artists?.name ?? "",
      }))
      // Unreleased first, then newest release date.
      .sort((a, b) => {
        if (a.is_unreleased !== b.is_unreleased) return a.is_unreleased ? -1 : 1;
        return (b.release_date ?? "") < (a.release_date ?? "") ? -1 : 1;
      })
      .slice(0, 12);
  }

  /* ---- Section 4: your year, computed from your own reviews ---- */
  const thisYear = new Date().getFullYear();
  const yearReviews = myReviews.filter(
    (r) => new Date(r.created_at).getFullYear() === thisYear
  );
  const avgRating =
    yearReviews.length > 0
      ? Math.round(
          (yearReviews.reduce((sum, r) => sum + Number(r.rating), 0) /
            yearReviews.length) *
            10
        ) / 10
      : null;
  // Most-reviewed artist this year (simple count by name).
  const artistCounts = new Map<string, number>();
  for (const r of yearReviews) {
    artistCounts.set(r.artist, (artistCounts.get(r.artist) ?? 0) + 1);
  }
  const topArtist =
    [...artistCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  const hasAnySignal =
    becauseYouFollow.length > 0 ||
    friendReviews.length > 0 ||
    anticipated.length > 0;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="crt-title text-3xl sm:text-4xl">YOUR TASTE</h1>
        <p className="osd-text text-sm">▸ a channel tuned to exactly one viewer</p>
      </div>

      {/* ===== Your year — quick stats strip ===== */}
      <section className="grid grid-cols-3 gap-3">
        <StatTile value={String(yearReviews.length)} label={`reviews in ${thisYear}`} />
        <StatTile value={avgRating !== null ? avgRating.toFixed(1) : "—"} label="avg rating" />
        <StatTile value={topArtist ?? "—"} label="most reviewed" small={!!topArtist} />
      </section>

      {/* ===== No signal at all? Help them tune in. ===== */}
      {!hasAnySignal && (
        <div className="panel-xbox-glow p-10 text-center space-y-4">
          <p className="pixel-text text-2xl text-accent-glow">NO SIGNAL</p>
          <p className="text-sm text-text-secondary max-w-md mx-auto">
            This channel builds itself from who and what you follow. Follow
            a few artists, releases, and people, and it starts broadcasting.
          </p>
          <div className="flex flex-wrap justify-center gap-3 pt-2">
            <Link href="/releases" className="btn-y2k btn-y2k-primary">
              Browse Releases
            </Link>
            <Link href="/friends" className="btn-y2k btn-y2k-outline">
              Find People
            </Link>
          </div>
        </div>
      )}

      {/* ===== Because you follow ===== */}
      {becauseYouFollow.length > 0 && (
        <section className="space-y-3">
          <SectionHeader label="BECAUSE YOU FOLLOW THE ARTIST" sub="unreviewed — go on then" />
          <div className="poster-grid">
            {becauseYouFollow.map((r) => (
              <ReleasePoster key={r.id} release={r} />
            ))}
          </div>
        </section>
      )}

      {/* ===== Your people rated ===== */}
      {friendReviews.length > 0 && (
        <section className="space-y-3">
          <SectionHeader label="YOUR PEOPLE RATED" sub="fresh takes from your follows" />
          <div className="poster-grid">
            {friendReviews.map((r) => {
              const cover = safeImage(r.cover_image);
              return (
                <Link
                  key={r.slug}
                  href={`/reviews/${r.slug}`}
                  className="group space-y-1.5"
                  title={`${r.title} — ${r.artist} (${r.rating}/10 by @${r.username})`}
                >
                  <span className="poster">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={cover} alt={`${r.title} cover`} />
                    ) : (
                      <span className="w-full h-full flex items-center justify-center text-4xl">💿</span>
                    )}
                    <span
                      className="poster-rating"
                      style={{ color: getRatingHex(r.rating) }}
                    >
                      {r.rating.toFixed(1)}
                    </span>
                  </span>
                  <span className="block">
                    <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] group-hover:text-accent-primary transition-colors">
                      {r.title}
                    </span>
                    <span className="block text-xs text-text-secondary truncate">
                      @{r.username}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== Anticipated ===== */}
      {anticipated.length > 0 && (
        <section className="space-y-3">
          <SectionHeader label="ANTICIPATED" sub="releases you're watching" />
          <div className="poster-grid">
            {anticipated.map((r) => (
              <ReleasePoster key={r.id} release={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ============================================================
   Small presentational helpers
   ============================================================ */

function SectionHeader({ label, sub }: { label: string; sub: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="vhs-label text-sm">{label}</span>
      <span className="osd-text text-xs hidden sm:inline">▸ {sub}</span>
      <div className="flex-1 divider-glow" />
    </div>
  );
}

function StatTile({
  value,
  label,
  small = false,
}: {
  value: string;
  label: string;
  small?: boolean;
}) {
  return (
    <div className="panel-xbox p-4 text-center space-y-1">
      <p
        className={`font-[family-name:var(--font-heading)] font-extrabold text-accent-primary truncate ${
          small ? "text-lg" : "text-2xl sm:text-3xl"
        }`}
        title={value}
      >
        {value}
      </p>
      <p className="text-[10px] uppercase tracking-widest text-text-muted">{label}</p>
    </div>
  );
}

function ReleasePoster({ release }: { release: PosterRelease }) {
  const cover = safeImage(release.cover_image);
  return (
    <Link
      href={`/releases/${release.slug}`}
      className="group space-y-1.5"
      title={`${release.title} — ${release.artist_name}`}
    >
      <span className="poster">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={`${release.title} cover`} />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-4xl">💿</span>
        )}
        {release.is_unreleased && (
          <span className="poster-unreleased">UNRELEASED</span>
        )}
      </span>
      <span className="block">
        <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] group-hover:text-accent-primary transition-colors">
          {release.title}
        </span>
        <span className="block text-xs text-text-secondary truncate">
          {release.artist_name}
        </span>
      </span>
    </Link>
  );
}
