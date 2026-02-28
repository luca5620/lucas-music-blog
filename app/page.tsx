/**
 * Home Page — Xbox Dashboard Edition
 * Frosted glass panels, glowing borders, circuit-board aesthetic.
 * Inspired by the original Xbox dashboard UI with Xbox 360 blue accents.
 */

import NowPlaying from "@/components/ui/NowPlaying";

/* Essential playlists — real data from Spotify profile */
const playlists = [
  {
    name: "Peak music",
    description: "The greatest playlist ever made",
    tracks: 1022,
    url: "https://open.spotify.com/playlist/1yHHtRgm1jCoMgd3A6B7gt",
  },
  {
    name: "Beautiful music",
    description: "Shorter version of peak music",
    tracks: 330,
    url: "https://open.spotify.com/playlist/1HMNf7Zj7RFaMSjjkCD1l2",
  },
];

/* Latest reviews data */
const reviews = [
  {
    title: "CHROMAKOPIA",
    artist: "Tyler, The Creator",
    rating: "8.7",
    genre: "Hip-Hop",
  },
  {
    title: "GNX",
    artist: "Kendrick Lamar",
    rating: "9.2",
    genre: "Hip-Hop",
  },
  {
    title: "Brat",
    artist: "Charli XCX",
    rating: "8.4",
    genre: "Pop",
  },
];

export default function Home() {
  return (
    <div className="space-y-6 circuit-bg">
      {/* ========== HERO PANEL — Main feature panel with glow ========== */}
      <section className="panel-xbox-glow p-8 text-center space-y-5 relative">
        {/* Decorative glow orbs */}
        <div className="absolute top-4 left-4 glow-orb" />
        <div className="absolute top-4 right-4 glow-orb" style={{ animationDelay: "1.5s" }} />

        <div className="label-xbox mx-auto w-fit">
          <span className="glow-orb" style={{ width: 5, height: 5 }} />
          System Online
        </div>

        <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl font-extrabold text-accent-primary tracking-tight drop-shadow-[0_0_30px_rgba(30,144,255,0.3)]">
          Peak Music Reviews
        </h1>

        <p className="pixel-text text-xl md:text-2xl text-accent-glow">
          honest reviews. real data. no pretentious jargon.
        </p>

        <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed text-sm">
          Music opinions where liking something for a dumb reason is just as valid
          as a technical breakdown. Powered by years of Spotify listening data
          and a stubborn refusal to be Pitchfork.
        </p>

        <div className="flex gap-4 justify-center pt-2">
          <a href="/reviews" className="btn-y2k btn-y2k-primary">
            Read Reviews
          </a>
          <a href="/analytics" className="btn-y2k btn-y2k-outline">
            Listening Data
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
            <span className="label-xbox">Now Playing</span>
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
              { value: "152,266", label: "Total Streams" },
              { value: "8,088", label: "Hours Played" },
              { value: "3,012", label: "Artists" },
            ].map((stat) => (
              <div key={stat.label} className="flex justify-between items-baseline">
                <span className="font-[family-name:var(--font-heading)] text-2xl font-bold text-accent-primary">
                  {stat.value}
                </span>
                <span className="text-xs text-text-muted uppercase tracking-wider">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
          <a
            href="/analytics"
            className="mt-4 block text-center text-xs text-accent-glow hover:text-accent-primary transition-colors uppercase tracking-widest"
          >
            View Full Data →
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
              className="panel-xbox p-5 flex gap-5 group cursor-pointer hover-glow relative"
            >
              {/* Playlist icon with glow */}
              <div className="w-16 h-16 rounded-lg bg-[rgba(30,144,255,0.08)] border border-[rgba(30,144,255,0.2)] flex items-center justify-center shrink-0 group-hover:border-accent-primary/50 group-hover:bg-[rgba(30,144,255,0.12)] transition-all">
                <span className="text-2xl group-hover:scale-110 transition-transform">🎶</span>
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {reviews.map((review) => (
            <div
              key={review.title}
              className="panel-xbox p-5 space-y-4 group cursor-pointer hover-glow relative"
            >
              {/* Album art placeholder with glow */}
              <div className="aspect-square rounded-lg bg-[rgba(30,144,255,0.05)] border border-[rgba(30,144,255,0.15)] flex items-center justify-center relative overflow-hidden group-hover:border-accent-primary/40 transition-all">
                <span className="text-5xl group-hover:scale-110 transition-transform">💿</span>
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-[rgba(0,0,0,0.4)] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              <div className="flex items-center justify-between">
                <span className="label-xbox text-[0.6rem]">
                  {review.genre}
                </span>
                <div className="w-12 h-12 rounded-lg border border-[rgba(30,144,255,0.3)] bg-[rgba(30,144,255,0.08)] flex items-center justify-center font-[family-name:var(--font-heading)] font-extrabold text-lg text-accent-primary group-hover:border-accent-primary/60 group-hover:shadow-[0_0_15px_rgba(30,144,255,0.2)] transition-all">
                  {review.rating}
                </div>
              </div>

              <div>
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                  {review.title}
                </h3>
                <p className="text-sm text-text-secondary">{review.artist}</p>
              </div>

              {/* Scan bar at bottom */}
              <div className="scan-bar" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
