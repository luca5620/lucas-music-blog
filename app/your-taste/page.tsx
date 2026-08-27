/**
 * /your-taste — the "For You" channel.
 *
 * Everything on this page is computed from YOUR data: who you
 * follow (people + artists), what you've followed as releases,
 * and what you've reviewed. No black-box algorithm — each section
 * says exactly why it's showing you something.
 *
 * Sections (Luca 2026-08-20: pager first and it is the ONLY place
 * reviews appear here — the old ON AIR video slot and the "WHO YOU
 * FOLLOW RATED" grid were removed; the video became a post):
 *   1. TUNED TO YOU — the algorithmic pager (lib/taste.ts): reviews,
 *      debates, and releases mixed, 70% taste match / 30% popularity,
 *      most-liked fallback for cold-start users, reason chips only
 *      where one clean signal explains a pick.
 *   2. BECAUSE YOU FOLLOW — releases by artists you follow that
 *      you haven't reviewed yet, ordered by taste affinity.
 *   3. ANTICIPATED — releases you follow, unreleased first then
 *      taste affinity.
 *
 * Server component; auth required (middleware also gates nothing
 * here, so we redirect ourselves via requireAuth).
 */

import Link from "next/link";
import { requireAuth } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import PageHero from "@/components/ui/PageHero";
import ChannelSurf from "@/components/taste/ChannelSurf";
import LiveCountdown from "@/components/releases/LiveCountdown";
import { isUpcoming } from "@/lib/upcoming";
import { getRatingHex, formatRating } from "@/lib/rating";
import { buildTasteProfile, getTunedToYou, affinityFor } from "@/lib/taste";

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
  /** Viewer's taste score for the artist — used only for in-section order. */
  affinity: number;
  /** Community average — attached in one batched query after the
      section lists are built; the poster wears the same AVG/UNRATED
      stamp as /releases. */
  avg_rating?: number | null;
}

/** Only https:// or local /path images (stored-XSS defense). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

export default async function YourTastePage() {
  const user = await requireAuth();
  const supabase = await createClient();

  /* ---- Taste profile (the picks come after the graph loads — they
     want the people-you-follow list for the author boost) ---- */
  const profile = await buildTasteProfile(user.id);

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

  /* ---- The TUNED TO YOU picks ---- */
  const tunedItems = await getTunedToYou(profile, user.id, {
    followedUserIds: peopleIds,
  });

  /* ---- Section 1: releases by artists you follow, unreviewed ---- */
  let becauseYouFollow: PosterRelease[] = [];
  if (artistIds.length > 0) {
    const { data } = await supabase
      .from("releases")
      .select(
        "id, slug, title, cover_image, release_date, is_unreleased, primary_artist_id, artists!releases_primary_artist_id_fkey(name)"
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
      primary_artist_id: string | null;
      artists: { name: string } | { name: string }[] | null;
    };
    becauseYouFollow = ((data ?? []) as unknown as Row[])
      .filter((r) => !reviewedReleaseIds.has(r.id))
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
        affinity: affinityFor(
          profile,
          r.primary_artist_id,
          Array.isArray(r.artists) ? r.artists[0]?.name ?? null : r.artists?.name ?? null
        ),
      }))
      // Taste-ordered (the query already put newest first, and sort() is
      // stable, so equal affinities keep recency order).
      .sort((a, b) => b.affinity - a.affinity)
      .slice(0, 12);
  }

  /* ---- Section 3: releases you follow — unreleased/newest first ---- */
  let anticipated: PosterRelease[] = [];
  if (followedReleaseIds.length > 0) {
    const { data } = await supabase
      .from("releases")
      .select(
        "id, slug, title, cover_image, release_date, is_unreleased, primary_artist_id, artists!releases_primary_artist_id_fkey(name)"
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
      primary_artist_id: string | null;
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
        affinity: affinityFor(
          profile,
          r.primary_artist_id,
          Array.isArray(r.artists) ? r.artists[0]?.name ?? null : r.artists?.name ?? null
        ),
      }))
      // Unreleased first, then taste affinity, then newest release date.
      .sort((a, b) => {
        if (a.is_unreleased !== b.is_unreleased) return a.is_unreleased ? -1 : 1;
        if (a.affinity !== b.affinity) return b.affinity - a.affinity;
        return (b.release_date ?? "") < (a.release_date ?? "") ? -1 : 1;
      })
      .slice(0, 12);
  }

  /* ---- Community averages for every poster below (ONE batched
     query) — the grids wear the same AVG / UNRATED stamps as the
     /releases listings, so you can see how the community rates a
     thing before you review it. ---- */
  const posterIds = [...becauseYouFollow, ...anticipated].map((r) => r.id);
  const avgByRelease = new Map<string, { sum: number; n: number }>();
  if (posterIds.length > 0) {
    const { data } = await supabase
      .from("reviews")
      .select("release_id, rating")
      .eq("is_published", true)
      .in("release_id", posterIds);
    ((data ?? []) as { release_id: string | null; rating: number }[]).forEach(
      (rev) => {
        if (!rev.release_id) return;
        const acc = avgByRelease.get(rev.release_id) ?? { sum: 0, n: 0 };
        acc.sum += rev.rating;
        acc.n += 1;
        avgByRelease.set(rev.release_id, acc);
      }
    );
  }
  const withAvg = (r: PosterRelease): PosterRelease => {
    const acc = avgByRelease.get(r.id);
    return { ...r, avg_rating: acc ? acc.sum / acc.n : null };
  };
  becauseYouFollow = becauseYouFollow.map(withAvg);
  anticipated = anticipated.map(withAvg);

  return (
    <div className="space-y-8 pb-12">
      {/* Header — boxed hero, same as HOME */}
      <PageHero
        title="YOUR TASTE"
        sub="Built from who you follow and what you rate."
      />

      {/* ===== Tuned to you — the channel-surf pager, top of the
             page and the only place reviews appear here. On phones
             it runs FULL-BLEED (the -mx-4 cancels the page padding)
             so the channel reads as the TikTok-style surface it is. ===== */}
      <section className="space-y-3">
        <SectionHeader label="TUNED TO YOU" sub="swipe / arrow through your channel" />
        {tunedItems.length > 0 ? (
          <div className="-mx-4 sm:mx-0">
            <ChannelSurf items={tunedItems} />
          </div>
        ) : (
          <EmptyState
            text="Static, for now. Rate a few releases and follow some people — your channel tunes itself from what you love."
            cta="Browse Releases"
            href="/releases"
          />
        )}
      </section>

      {/* ===== Because you follow =====
          Empty sections don't vanish anymore (Luca picked the
          cold-start treatment 2026-08-26): they say WHY they're
          empty and where to go fix it. */}
      <section className="space-y-3">
        <SectionHeader label="BECAUSE YOU FOLLOW THE ARTIST" sub="unreviewed — go on then" />
        {becauseYouFollow.length > 0 ? (
          <div className="poster-grid">
            {becauseYouFollow.map((r) => (
              <ReleasePoster
                key={r.id}
                release={r}
                reason={r.artist_name ? `you follow ${r.artist_name}` : undefined}
              />
            ))}
          </div>
        ) : artistIds.length === 0 ? (
          <EmptyState
            text="You don't follow any artists yet. Follow one and every drop of theirs you haven't rated lines up right here."
            cta="Browse Artists"
            href="/artists"
          />
        ) : (
          <EmptyState
            text="You've rated everything from the artists you follow — the queue is clear. Follow more artists or dig through the latest drops."
            cta="Latest Drops"
            href="/releases"
          />
        )}
      </section>

      {/* ===== Anticipated ===== */}
      <section className="space-y-3">
        <SectionHeader label="ANTICIPATED" sub="releases you're watching" />
        {anticipated.length > 0 ? (
          <div className="poster-grid">
            {anticipated.map((r) => (
              <ReleasePoster key={r.id} release={r} reason="on your watchlist" />
            ))}
          </div>
        ) : (
          <EmptyState
            text="Follow a release to watch it here — the live room opens before the album does, countdown included."
            cta="Browse Releases"
            href="/releases"
          />
        )}
      </section>
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
      <span className="text-text-secondary text-xs hidden sm:inline">{sub}</span>
      <div className="flex-1 divider-glow" />
    </div>
  );
}

/** Empty-section panel — says why there's nothing here and where to
    go fix it, in the site's NO SIGNAL voice. */
function EmptyState({
  text,
  cta,
  href,
}: {
  text: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="panel-xbox p-6 sm:p-8 text-center space-y-4">
      <p className="osd-text text-sm">NO SIGNAL</p>
      <p className="text-sm text-text-secondary max-w-md mx-auto leading-relaxed">
        {text}
      </p>
      <Link href={href} className="btn-y2k btn-y2k-outline inline-block">
        {cta}
      </Link>
    </div>
  );
}

function ReleasePoster({
  release,
  reason,
}: {
  release: PosterRelease;
  /** Why this pick is here — same "one clean signal" chips the
      TUNED TO YOU pager uses, extended to the grids. */
  reason?: string;
}) {
  const cover = safeImage(release.cover_image);
  const upcoming = isUpcoming(release.release_date);
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
        {/* Stamp priority: a future drop gets the live amber clock
            (same badge as the home Dropping Soon posters); other
            unreleased stuff keeps the UNRELEASED stamp; everything
            out in the world wears the /releases AVG / UNRATED
            convention. */}
        {upcoming && release.release_date ? (
          <span className="absolute bottom-1.5 left-1.5 pixel-text text-[11px] text-osd-amber bg-black/80 border border-osd-amber/50 rounded px-1.5 py-0.5 tracking-widest">
            <LiveCountdown releaseDate={release.release_date} />
          </span>
        ) : release.is_unreleased ? (
          <span className="poster-unreleased">UNRELEASED</span>
        ) : typeof release.avg_rating === "number" ? (
          <span
            className="poster-rating"
            style={{ color: getRatingHex(release.avg_rating) }}
          >
            <span className="text-[0.55rem] font-normal text-text-muted mr-1">AVG</span>
            {formatRating(release.avg_rating)}
          </span>
        ) : (
          <span className="poster-rating !text-[0.55rem] !font-normal text-text-muted tracking-wider">
            UNRATED
          </span>
        )}
      </span>
      <span className="block">
        <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] group-hover:text-accent-primary transition-colors">
          {release.title}
        </span>
        <span className="block text-xs text-text-secondary truncate">
          {release.artist_name}
        </span>
        {reason && (
          <span className="block text-[10px] text-accent-primary/80 truncate pt-0.5">
            ◈ {reason}
          </span>
        )}
      </span>
    </Link>
  );
}
