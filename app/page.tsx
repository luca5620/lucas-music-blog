/**
 * Home — two different shows depending on who's watching.
 *
 * Logged OUT → the test-card splash: what Peak Music Reviews is, why you'd join.
 * Logged IN  → the social dashboard: what's ON AIR right now,
 *              fresh drops, lists, and the community review wall.
 *              Dense and poster-first, Letterboxd-style. (Friends'
 *              activity lives in the Friends tab, not here.)
 *
 * Server component: auth is checked with the cookie-aware Supabase
 * client so there's no loading flash.
 */

import Link from "next/link";
import { smallCover } from "@/lib/images";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { getReleaseDiscoveryFeed } from "@/lib/db/releases";
import ReleasesFeed from "@/components/feed/ReleasesFeed";
import QuickAccessStrip from "@/components/home/QuickAccessStrip";
import UpcomingDrops from "@/components/home/UpcomingDrops";
import Reveal from "@/components/home/Reveal";
import RatedWall from "@/components/home/RatedWall";
import HowItWorks from "@/components/home/HowItWorks";
import LiveRooms from "@/components/home/LiveRooms";
import Unreleased from "@/components/home/Unreleased";
import MakeItYours from "@/components/home/MakeItYours";
import ClosingCta from "@/components/home/ClosingCta";
import ListsRail from "@/components/feed/ListsRail";
import DiscoveryFeed from "@/components/reviews/DiscoveryFeed";
import PostsFeed from "@/components/posts/PostsFeed";
import LiveBadge from "@/components/rooms/LiveBadge";
import ChromeDisc from "@/components/ui/ChromeDisc";
import LiquidAtmosphere from "@/components/ui/LiquidAtmosphere";
import { BreadcrumbSchema } from "@/app/schema";
/* App Store link for the web-only download badge in the HOME band —
   shared constant in lib/app-store.ts (also used by the SEO landing
   pages). The listing goes live the moment Apple approves the app. */
import { APP_STORE_URL } from "@/lib/app-store";

// The dashboard is per-viewer and realtime-ish — always render fresh.
export const dynamic = "force-dynamic";

/** The bitten apple (Font Awesome path, CC BY 4.0) + the classic
    two-line badge text. Web-only via .app-hide — if you can see the
    app shell you already have the app. */
function AppStoreBadge() {
  return (
    <a
      href={APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="app-hide inline-flex items-center justify-center sm:justify-start gap-2.5 rounded-xl border border-white/25 bg-black/60 px-4 py-2 transition-colors hover:border-white/50 hover:bg-black/80"
    >
      <svg
        viewBox="0 0 384 512"
        className="w-5 h-5 fill-current text-text-primary"
        aria-hidden="true"
      >
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.9-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      <span className="text-left leading-tight">
        <span className="block text-[9px] uppercase tracking-widest text-text-muted">
          Download on the
        </span>
        <span className="block text-sm font-bold text-text-primary">
          App Store
        </span>
      </span>
    </a>
  );
}

/** App-only mirror of the web-only App Store badge: a quiet
    end-of-scroll plug for the website (Luca 2026-08-26 — the big
    screen is where the proper sit-down reviews get written, and
    nudging app users there builds the community). .app-only keeps
    it invisible on web. Deliberately not a link: the shell IS the
    site, so tapping would just reload this page — people carry the
    address to a computer instead. */
function WebsitePlug() {
  return (
    <div className="app-only">
      <section className="panel-xbox p-5 text-center space-y-1.5 relative overflow-hidden">
        <p className="osd-text text-sm">
          For a better experience, check out our website
        </p>
        <p className="text-xs text-text-secondary">
          <span className="text-text-primary font-bold">
            peakmusicreviews.com
          </span>{" "}
          on a computer — the big-screen home for proper sit-down reviews.
        </p>
        <div className="scan-bar" />
      </section>
    </div>
  );
}

export default async function Home() {
  const user = await getUser();

  return (
    <div className="space-y-8 circuit-bg">
      <BreadcrumbSchema items={[{ name: "Home", href: "/" }]} />
      {user ? <Dashboard /> : <Splash />}
    </div>
  );
}

/* ============================================================
   LOGGED OUT — the test-card splash
   ============================================================ */

/* The three VHS feature cards (RATE ANYTHING / LIVE ROOMS & DEBATES /
   A PROFILE THAT'S YOURS) grew into full sections on 2026-09-02:
   Unreleased, LiveRooms, MakeItYours — see components/home. */

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

        <p className="hero-copy max-w-2xl mx-auto leading-relaxed text-xs sm:text-sm">
          The music social network. Rate what you hear, build lists, follow
          people with taste (or terrible taste — more fun to argue with),
          and pile into live rooms when the album of the year drops at
          midnight.
        </p>

        {/* CTAs + the App Store badge on ONE line (Luca 2026-08-24:
            "not under the blue button") — the badge stacks with the
            buttons on phones like everything else, and app-hide keeps
            it web-only. */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-center pt-2">
          <Link href="/signup" className="btn-y2k btn-y2k-primary">
            Create Account
          </Link>
          <Link href="/reviews" className="btn-y2k btn-y2k-outline">
            Browse Reviews
          </Link>
          <AppStoreBadge />
        </div>

        <div className="scan-bar" />
      </section>

      {/* ===== A separate page, not the dashboard (Luca 2026-09-02,
             Resonate-style): no feed modules down here — the
             dashboard's Dropping Soon / reviews / posts / releases
             are for members. This is the pitch, section by section,
             each easing in as it arrives (Reveal) and each wearing
             the same HomeSection header. Hero copy untouched. ===== */}

      {/* The cover ticker — what the community rated */}
      <Reveal>
        <Suspense fallback={null}>
          <RatedWall />
        </Suspense>
      </Reveal>

      <Reveal>
        <HowItWorks />
      </Reveal>

      {/* Live release rooms — their own section (not a club) */}
      <Reveal>
        <Suspense fallback={null}>
          <LiveRooms />
        </Suspense>
      </Reveal>

      {/* Unreleased — the wedge */}
      <Reveal>
        <Suspense fallback={null}>
          <Unreleased />
        </Suspense>
      </Reveal>

      {/* Customization — themes, showcases, the preview player… */}
      <Reveal>
        <MakeItYours />
      </Reveal>

      {/* The close — same glow + liquid as the hero, so the page ends
          the way it opened. */}
      <Reveal>
        <ClosingCta badge={<AppStoreBadge />} />
      </Reveal>

      <WebsitePlug />
    </>
  );
}

/* ============================================================
   LOGGED IN — the dashboard
   ============================================================ */

async function Dashboard() {
  // ON AIR candidates — degrades to an empty array on any error.
  const feed = await getReleaseDiscoveryFeed(12).catch(() => []);

  // "On air" = releases whose live room saw activity in the last 24h.
  // Dashboard is an async SERVER component rendered once per request,
  // so reading the clock here is the intended behaviour — there's no
  // hydration pass to disagree with it and no re-render to make it
  // drift. The rule can't tell a server render from a client one.
  // eslint-disable-next-line react-hooks/purity
  const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const onAir = feed
    .filter(
      (r) =>
        r.last_activity_at && new Date(r.last_activity_at).getTime() > dayAgo
    )
    .slice(0, 4);

  return (
    <>
      {/* ===== App-only quick access strip: FIRST thing on the page,
             right below the site header, above the HOME band (Luca
             2026-08-22). Locks flush to the screen top on scroll.
             These four buttons replaced the Reviews/Debates bottom
             tabs. Web hides it (nav strip covers it). ===== */}
      <QuickAccessStrip />

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
          {/* Badge rides the same line as the buttons (Luca 2026-08-24:
              "not under the blue button"); app-hide keeps it web-only —
              the shell already IS the app. */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-center sm:justify-start">
            <Link href="/reviews/new" className="btn-y2k btn-y2k-primary">
              ✚ Write a Review
            </Link>
            <Link href="/debates/new" className="btn-y2k btn-y2k-outline">
              ⚔ Start a Debate
            </Link>
            <AppStoreBadge />
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
                    <img src={smallCover(r.cover_image)} alt={`${r.title} cover`} loading="lazy" decoding="async" />
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

      {/* WHO YOU FOLLOW ticker removed (Luca 2026-08-25) — the
          Friends tab already has the richer full-size version. */}

      <div className="divider-glow" />

      {/* ===== Community reviews / posts / new releases / lists =====
          Reviews lead — people land on takes, not just covers.
          Posts between the takes and the release wall (Luca
          2026-08-22: posts were unfindable outside profiles and
          Your Taste). */}
      <Suspense fallback={null}>
        <DiscoveryFeed />
      </Suspense>

      {/* DROPPING SOON — countdown shelf + paste-a-Spotify-link slot,
          right below the community feed (Luca 2026-08-26). */}
      <Suspense fallback={null}>
        <UpcomingDrops />
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

      {/* ===== Your Taste teaser ===== Web only (app-hide): the app
          has the Your Taste tab right in the bottom bar, and with the
          website plug below, two end-of-scroll modules crowded the
          shell (Luca 2026-08-26). */}
      <section className="app-hide panel-xbox p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
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

      {/* About Us moved to the universal SiteFooter (Luca 2026-08-22:
          the blue pill duplicated it once the footer link shipped). */}

      <WebsitePlug />
    </>
  );
}
