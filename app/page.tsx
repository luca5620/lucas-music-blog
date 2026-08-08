/**
 * Home Page — Xbox Dashboard Edition
 * Frosted glass panels, glowing borders, circuit-board aesthetic.
 * Inspired by the original Xbox dashboard UI with Xbox 360 blue accents.
 */

import NowPlaying from "@/components/ui/NowPlaying";
import Link from "next/link";
import { getLatestReviews, getRatingHex } from "@/lib/reviews";
import { BreadcrumbSchema, ItemListSchema } from "@/app/schema";
import DiscoveryFeed from "@/components/reviews/DiscoveryFeed";
import ReleasesFeed from "@/components/feed/ReleasesFeed";
import ListsRail from "@/components/feed/ListsRail";
import { Suspense } from "react";

/* Essential playlists — real data from Spotify profile */
const playlists = [
  {
    name: "Peak music",
    description: "The greatest playlist ever made",
    tracks: 1022,
    url: "https://open.spotify.com/playlist/1yHHtRgm1jCoMgd3A6B7gt",
    coverImage: "/playlists/peak-music.png",
  },
  {
    name: "Beautiful music",
    description: "Shorter version of peak music",
    tracks: 330,
    url: "https://open.spotify.com/playlist/1HMNf7Zj7RFaMSjjkCD1l2",
    coverImage: "/playlists/beautiful-music.png",
  },
];

export default function Home() {
  // Poster-wall density: show more covers, Letterboxd style.
  const reviews = getLatestReviews(6);

  return (
    <div className="space-y-6 circuit-bg">
      {/* JSON-LD Structured Data */}
      <BreadcrumbSchema items={[{ name: "Home", href: "/" }]} />
      <ItemListSchema reviews={reviews} listName="Latest Reviews" />

      {/* ========== HERO PANEL — Main feature panel with glow ========== */}
      <section className="panel-xbox-glow p-4 sm:p-8 text-center space-y-4 sm:space-y-5 relative overflow-hidden">
        {/* Decorative glow orbs */}
        <div className="absolute top-4 left-4 glow-orb" />
        <div className="absolute top-4 right-4 glow-orb" style={{ animationDelay: "1.5s" }} />

        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-5xl md:text-6xl font-extrabold text-accent-primary tracking-tight drop-shadow-[0_0_30px_rgba(30,144,255,0.3)]">
          Peak Music Reviews
        </h1>

        <p className="pixel-text text-base sm:text-xl md:text-2xl text-accent-glow">
          honest reviews. real data. no pretentious jargon.
        </p>

        <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed text-xs sm:text-sm">
          Music opinions where liking something for a dumb reason is just as valid
          as a technical breakdown. Powered by years of Spotify listening data
          and not falling for bullshit reviews by Pitchfork.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2">
          <a href="/reviews" className="btn-y2k btn-y2k-primary">
            Read Reviews
          </a>
          <a href="/profile/lucas" className="btn-y2k btn-y2k-outline">
            View My Profile
          </a>
        </div>

        {/* Scan bar at bottom of hero */}
        <div className="scan-bar" />
      </section>

      {/* Glowing divider */}
      <div className="divider-glow" />

      {/* ========== NOW PLAYING + STATS — Side-by-side dashboard row ========== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Now Playing — takes 2 columns */}
        <div className="md:col-span-2 panel-xbox p-5 hover-glow relative">
          <div className="flex items-center gap-2 mb-3">
            <span className="glow-orb" />
            <span className="label-xbox">Currently Listening</span>
          </div>
          <NowPlaying />
        </div>

        {/* Quick Stats panel */}
        <div className="panel-xbox p-5 hover-glow relative">
          <div className="flex items-center gap-2 mb-4">
            <span className="glow-orb" style={{ animationDelay: "0.7s" }} />
            <span className="label-xbox">Lifetime Stats</span>
          </div>
          <div className="space-y-3">
            {[
              { value: "169,574", label: "Total Streams" },
              { value: "8,688", label: "Hours Played" },
              { value: "4,186", label: "Artists" },
            ].map((stat) => (
              <div key={stat.label} className="flex justify-between items-baseline">
                <span className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-bold text-accent-primary">
                  {stat.value}
                </span>
                <span className="text-xs text-text-muted uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
          <a
            href="/profile/lucas#listening"
            className="mt-4 block text-center text-xs text-accent-glow hover:text-accent-primary transition-colors uppercase tracking-widest"
          >
            View Full Profile →
          </a>
          <div className="scan-bar" />
        </div>
      </div>

      {/* ========== ESSENTIAL PLAYLISTS — Dashboard panels ========== */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="glow-orb" style={{ animationDelay: "1s" }} />
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary">
            Essential Playlists
          </h2>
          <div className="flex-1 divider-glow" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {playlists.map((playlist) => (
            <a
              key={playlist.name}
              href={playlist.url}
              target="_blank"
              rel="noopener noreferrer"
              className="panel-xbox p-4 sm:p-5 flex gap-4 sm:gap-5 group cursor-pointer hover-glow relative overflow-hidden"
            >
              {/* Playlist cover art */}
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg overflow-hidden border border-[rgba(30,144,255,0.2)] shrink-0 group-hover:border-accent-primary/50 transition-all">
                <img
                  src={playlist.coverImage}
                  alt={`${playlist.name} playlist cover`}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform"
                />
              </div>
              <div className="space-y-2 flex-1">
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                  {playlist.name}
                </h3>
                <p className="text-sm text-text-secondary italic">
                  &ldquo;{playlist.description}&rdquo;
                </p>
                <div className="flex items-center gap-3">
                  <span className="pixel-text text-xs text-accent-primary uppercase tracking-widest">
                    {playlist.tracks} tracks
                  </span>
                  <span className="text-xs text-text-muted">Spotify ↗</span>
                </div>
              </div>

              {/* Scan bar */}
              <div className="scan-bar" />
            </a>
          ))}
        </div>
      </section>

      {/* Glowing divider */}
      <div className="divider-glow" />

      {/* ========== LATEST REVIEWS — Xbox-style grid panels ========== */}
      <section className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="glow-orb" style={{ animationDelay: "2s" }} />
          <h2 className="font-[family-name:var(--font-heading)] text-xl font-bold text-text-primary">
            Latest Reviews
          </h2>
          <div className="flex-1 divider-glow" />
          <span className="label-xbox">{reviews.length} Reviews</span>
        </div>

        {/* Letterboxd-style poster wall: dense grid of covers with a
            rating chip pinned to each corner. Title/artist on hover
            (title attr) and below on small screens. */}
        <div className="poster-grid">
          {reviews.map((review) => (
            <Link
              key={review.slug}
              href={`/reviews/${review.slug}`}
              className="group space-y-1.5"
              title={`${review.title} — ${review.artist} (${review.rating}/10)`}
              style={{ "--rating-color": getRatingHex(review.rating) } as React.CSSProperties}
            >
              <span className="poster">
                {review.coverImage ? (
                  <img src={review.coverImage} alt={`${review.title} cover`} />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-4xl">💿</span>
                )}
                <span className="poster-rating">{review.rating}</span>
              </span>
              <span className="block">
                <span className={`block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] rating-title-hover${review.rating >= 9.5 ? " rating-title-glow-elite" : ""}`}>
                  {review.title}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  {review.artist}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Glowing divider */}
      <div className="divider-glow" />

      {/* ========== FRESH LISTS — community album lists ========== */}
      <Suspense fallback={null}>
        <ListsRail />
      </Suspense>

      {/* ========== NEW RELEASES — release-first discovery ========== */}
      <Suspense fallback={null}>
        <ReleasesFeed />
      </Suspense>

      {/* ========== COMMUNITY FEED — Recent reviews from all users ========== */}
      <Suspense fallback={null}>
        <DiscoveryFeed />
      </Suspense>
    </div>
  );
}
