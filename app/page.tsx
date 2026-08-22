/**
 * Home — two different shows depending on who's watching.
 *
 * Logged OUT → the test-card splash: what Peak Music Reviews is, why you'd join.
 * Logged IN  → the social dashboard: what's ON AIR right now,
 *              friends' activity, fresh drops, lists, and the
 *              community review wall. Dense and poster-first,
 *              Letterboxd-style.
 *
 * Server component: auth is checked with the cookie-aware Supabase
 * client so there's no loading flash.
 */

import Link from "next/link";
import { formatRating } from "@/lib/rating";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { getReleaseDiscoveryFeed } from "@/lib/db/releases";
import { getFriendActivity, type ActivityItem } from "@/lib/db/activity";
import ReleasesFeed from "@/components/feed/ReleasesFeed";
import ListsRail from "@/components/feed/ListsRail";
import DiscoveryFeed from "@/components/reviews/DiscoveryFeed";
import PostsFeed from "@/components/posts/PostsFeed";
import LiveBadge from "@/components/rooms/LiveBadge";
import ChromeDisc from "@/components/ui/ChromeDisc";
import LiquidAtmosphere from "@/components/ui/LiquidAtmosphere";
import { BreadcrumbSchema } from "@/app/schema";

// The dashboard is per-viewer and realtime-ish — always render fresh.
export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getUser();

  return (
    <div className="space-y-8 circuit-bg">
      <BreadcrumbSchema items={[{ name: "Home", href: "/" }]} />
      {user ? <Dashboard userId={user.id} /> : <Splash />}
    </div>
  );
}

/* ============================================================
   LOGGED OUT — the test-card splash
   ============================================================ */

/** One VHS-labeled feature card on the splash. */
const FEATURES = [
  {
    label: "RATE ANYTHING",
    body: "Every album and single on Spotify, plus the Genius deep catalog — unreleased tracks, leaks, and loosies included. If it exists, you can rate it.",
    emoji: "📼",
  },
  {
    label: "LIVE ROOMS & DEBATES",
    body: "Release-night chat rooms with track-by-track reactions, and two-sided debates where you pick a side and argue it out.",
    emoji: "📺",
  },
  {
    label: "A PROFILE THAT'S YOURS",
    body: "CRT themes, four-favorites shelf, showcases you arrange yourself, verified badges. Your taste, your channel.",
    emoji: "🖥️",
  },
];

function Splash() {
  return (
    <>
      {/* ===== Hero — the chrome disc floating on liquid light,
             then the big title, tagline, CTAs ===== */}
      <section className="panel-xbox-glow p-6 sm:p-12 text-center space-y-5 relative isolate overflow-hidden">
        {/* Molten iridescent atmosphere drifting behind everything */}
        <LiquidAtmosphere />

        {/* The chrome disc floats BEHIND the text — big, centered
            high. The scrim gradient darkens it progressively where
            the title, tagline, and gray copy sit, so nothing gets
            washed out against the chrome. */}
        <div
          className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          {/* Phone size w-72 (was w-[26rem] — WIDER than the screen on
              a 390px phone, Luca 2026-08-22: "way too big" in the app).
              Desktop keeps the big chrome. */}
          <ChromeDisc className="absolute left-1/2 -translate-x-1/2 -top-16 sm:-top-36 w-72 sm:w-[38rem] opacity-60" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.3)_28%,rgba(0,0,0,0.68)_52%,rgba(0,0,0,0.82)_100%)]" />
        </div>

        <div className="absolute top-4 left-4 glow-orb" />
        <div className="absolute top-4 right-4 glow-orb" style={{ animationDelay: "1.5s" }} />

        {/* Breathing room so the title sits below the disc's center */}
        <div className="h-16 sm:h-40" />

        <h1 className="crt-title text-4xl sm:text-6xl tracking-tight uppercase">Peak Music Reviews</h1>

        <p className="pixel-text text-lg sm:text-2xl text-accent-glow">
          every album. every leak. every argument.
        </p>

        <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed text-xs sm:text-sm">
          The music social network. Rate what you hear, build lists, follow
          people with taste (or terrible taste — more fun to argue with),
          and pile into live rooms when the album of the year drops at
          midnight.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2">
          <Link href="/signup" className="btn-y2k btn-y2k-primary">
            Create Account
          </Link>
          <Link href="/reviews" className="btn-y2k btn-y2k-outline">
            Browse Reviews
          </Link>
        </div>

        <div className="scan-bar" />
      </section>

      {/* ===== Feature cards ===== */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {FEATURES.map((f, i) => (
          <div key={f.label} className="panel-xbox p-5 space-y-3 hover-glow relative overflow-hidden">
            <div className="flex items-center gap-3">
              <span className="text-2xl" aria-hidden="true">{f.emoji}</span>
              <span className="vhs-label text-sm">{f.label}</span>
            </div>
            <p className="text-sm text-text-secondary leading-relaxed">{f.body}</p>
            <div className="scan-bar" style={{ animationDelay: `${i * 0.8}s` }} />
          </div>
        ))}
      </section>

      <div className="divider-glow" />

      {/* Even logged out, show the community pulse so the site feels
          alive — reviews FIRST (Luca: greet people with the takes),
          then posts, then the release wall */}
      <Suspense fallback={null}>
        <DiscoveryFeed />
      </Suspense>
      <Suspense fallback={null}>
        <PostsFeed />
      </Suspense>
      <Suspense fallback={null}>
        <ReleasesFeed />
      </Suspense>
    </>
  );
}

/* ============================================================
   LOGGED IN — the dashboard
   ============================================================ */

async function Dashboard({ userId }: { userId: string }) {
  // Fetch the ON AIR candidates and friend activity in parallel —
  // both degrade to empty arrays on any error.
  const [feed, activity] = await Promise.all([
    getReleaseDiscoveryFeed(12).catch(() => []),
    getFriendActivity(userId, { limit: 6 }).catch(() => [] as ActivityItem[]),
  ]);

  // "On air" = releases whose live room saw activity in the last 24h.
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const onAir = feed
    .filter(
      (r) =>
        r.last_activity_at && new Date(r.last_activity_at).getTime() > dayAgo
    )
    .slice(0, 4);

  return (
    <>
      {/* ===== Hero band — HOME + actions on liquid light, with the
             chrome disc spinning on the right ===== */}
      <section className="panel-xbox-glow p-6 sm:p-8 relative isolate overflow-hidden">
        <LiquidAtmosphere />
        {/* The disc spins behind the right side of the band — compact
            on phones, bigger on desktop, scrimmed so text crossing
            the chrome stays readable */}
        <div
          className="absolute inset-0 -z-10 overflow-hidden pointer-events-none"
          aria-hidden="true"
        >
          <ChromeDisc className="absolute w-36 left-1/2 -translate-x-1/2 -top-10 sm:left-auto sm:translate-x-0 sm:w-56 sm:-right-16 sm:-top-14 md:w-72 md:-right-10 opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/35 to-black/10" />
        </div>
        <div className="space-y-4 text-center sm:text-left">
          <h1 className="crt-title text-3xl sm:text-4xl">HOME</h1>
          <div className="flex flex-col sm:flex-row gap-3 justify-center sm:justify-start">
            <Link href="/reviews/new" className="btn-y2k btn-y2k-primary">
              ✚ Write a Review
            </Link>
            <Link href="/debates/new" className="btn-y2k btn-y2k-outline">
              ⚔ Start a Debate
            </Link>
          </div>
        </div>
        <div className="scan-bar" />
      </section>

      {/* ===== ON AIR — rooms with a pulse right now ===== */}
      {onAir.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="glow-orb" />
            <span className="vhs-label text-sm">ON AIR</span>
            <div className="flex-1 divider-glow" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {onAir.map((r) => (
              <Link
                key={r.id}
                href={`/releases/${r.slug}`}
                className="group space-y-1.5"
                title={`${r.title} — ${r.primary_artist.name}`}
              >
                <span className="poster">
                  {r.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.cover_image} alt={`${r.title} cover`} />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-4xl">💿</span>
                  )}
                  <span className="absolute top-1.5 left-1.5">
                    <LiveBadge lastActivityAt={r.last_activity_at} />
                  </span>
                </span>
                <span className="block">
                  <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] group-hover:text-accent-primary transition-colors">
                    {r.title}
                  </span>
                  <span className="block text-xs text-text-secondary truncate">
                    {r.primary_artist.name}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ===== Friends' recent activity — compact ticker ===== */}
      {activity.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="vhs-label text-sm">WHO YOU FOLLOW</span>
            <div className="flex-1 divider-glow" />
            <Link
              href="/friends"
              className="pixel-text text-sm text-accent-glow hover:text-accent-primary transition-colors uppercase tracking-widest"
            >
              Full feed →
            </Link>
          </div>
          <div className="panel-xbox divide-y divide-white/5">
            {activity.map((item, i) => (
              <CompactActivityRow key={`${item.type}-${item.created_at}-${i}`} item={item} />
            ))}
          </div>
        </section>
      )}

      <div className="divider-glow" />

      {/* ===== Community reviews / posts / new releases / lists =====
          Reviews lead — people land on takes, not just covers.
          Posts between the takes and the release wall (Luca
          2026-08-22: posts were unfindable outside profiles and
          Your Taste). */}
      <Suspense fallback={null}>
        <DiscoveryFeed />
      </Suspense>

      <Suspense fallback={null}>
        <PostsFeed />
      </Suspense>

      <Suspense fallback={null}>
        <ReleasesFeed />
      </Suspense>

      <Suspense fallback={null}>
        <ListsRail />
      </Suspense>

      {/* ===== Your Taste teaser ===== */}
      <section className="panel-xbox p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
        <div>
          <p className="pixel-text text-lg text-accent-glow">
            Want a channel tuned to just you?
          </p>
          <p className="text-xs text-text-secondary mt-1">
            Your Taste builds a feed from who you follow and what you rate.
          </p>
        </div>
        <Link href="/your-taste" className="btn-y2k btn-y2k-outline shrink-0">
          Tune In →
        </Link>
      </section>

      {/* ===== About Us — the story behind the station ===== */}
      <section className="flex justify-center pt-2">
        <Link
          href="/about"
          className="px-6 py-2.5 rounded-full text-sm font-bold tracking-wide uppercase bg-accent-primary/15 text-accent-primary border border-accent-primary/30 hover:bg-accent-primary/25 hover:border-accent-primary/50 transition-all font-[family-name:var(--font-heading)]"
        >
          About Us
        </Link>
      </section>
    </>
  );
}

/** One-line activity row for the home dashboard (terser than /friends). */
function CompactActivityRow({ item }: { item: ActivityItem }) {
  const name = item.actor.display_name || item.actor.username;

  // Sentence + link target per activity type.
  let verb: string;
  let object: string;
  let href: string;
  switch (item.type) {
    case "review":
      verb = "reviewed";
      object = `${item.payload.title} — ${formatRating(item.payload.rating)}`;
      href = `/reviews/${item.payload.slug}`;
      break;
    case "list":
      verb = "made a list:";
      object = item.payload.title;
      href = `/lists/${item.actor.username}/${item.payload.slug}`;
      break;
    case "like":
      verb = "liked a review of";
      object = item.payload.review_title;
      href = `/reviews/${item.payload.review_slug}`;
      break;
    case "debate":
      verb = "started a debate:";
      object = item.payload.title;
      href = `/debates/${item.payload.slug}`;
      break;
  }

  return (
    <Link href={href} className="flex items-center gap-2 px-4 py-2.5 text-sm hover:bg-bg-elevated transition-colors">
      <span className="font-bold text-text-primary shrink-0">{name}</span>
      <span className="text-text-muted shrink-0">{verb}</span>
      <span className="text-text-secondary truncate">{object}</span>
    </Link>
  );
}
