/**
 * Home Page — Phase 1
 * Xbox 360 blue primary, CRT frame, PS1-era rating badges,
 * essential playlists, and Now Playing section.
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

export default function Home() {
  return (
    <div className="space-y-10">
      {/* Hero Section */}
      <section className="text-center space-y-5 pt-4">
        <h1 className="font-[family-name:var(--font-heading)] text-5xl md:text-6xl font-extrabold text-accent-primary tracking-tight">
          Peak Music Reviews
        </h1>
        <p className="pixel-text text-2xl text-accent-glow">
          honest reviews. real data. no pretentious jargon.
        </p>
        <p className="text-text-secondary max-w-2xl mx-auto leading-relaxed text-base">
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
      </section>

      {/* Divider */}
      <div className="border-t border-border-subtle" />

      {/* Now Playing / Last Played — live Spotify data */}
      <NowPlaying />

      {/* Essential Playlists */}
      <section className="space-y-5">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary">
          Essential Playlists
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {playlists.map((playlist) => (
            <a
              key={playlist.name}
              href={playlist.url}
              target="_blank"
              rel="noopener noreferrer"
              className="card-y2k p-5 flex gap-5 group cursor-pointer"
            >
              {/* Playlist art placeholder */}
              <div className="w-20 h-20 rounded-lg bg-bg-elevated flex items-center justify-center shrink-0 border border-border-medium group-hover:border-accent-primary transition-colors">
                <span className="text-3xl group-hover:scale-110 transition-transform">🎶</span>
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
            </a>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-border-subtle" />

      {/* Latest Reviews */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="font-[family-name:var(--font-heading)] text-2xl font-bold text-text-primary">
            Latest Reviews
          </h2>
          <span className="pixel-text text-sm text-text-muted uppercase">
            3 reviews
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            {
              title: "CHROMAKOPIA",
              artist: "Tyler, The Creator",
              rating: "8.7",
              genre: "Hip-Hop",
              accentClass: "text-accent-primary",
              badgeBorder: "border-accent-primary",
            },
            {
              title: "GNX",
              artist: "Kendrick Lamar",
              rating: "9.2",
              genre: "Hip-Hop",
              accentClass: "text-accent-rose",
              badgeBorder: "border-accent-rose",
            },
            {
              title: "Brat",
              artist: "Charli XCX",
              rating: "8.4",
              genre: "Pop",
              accentClass: "text-accent-cyan",
              badgeBorder: "border-accent-cyan",
            },
          ].map((review) => (
            <div key={review.title} className="card-y2k p-5 space-y-4 group cursor-pointer">
              <div className="aspect-square rounded-lg bg-bg-elevated flex items-center justify-center relative overflow-hidden">
                <span className="text-5xl group-hover:scale-110 transition-transform">💿</span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`pixel-text text-xs ${review.accentClass} uppercase tracking-widest`}>
                  {review.genre}
                </span>
                <div className={`rating-badge ${review.badgeBorder}`}>
                  <span className={review.accentClass}>{review.rating}</span>
                </div>
              </div>

              <div>
                <h3 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text-primary group-hover:text-accent-primary transition-colors">
                  {review.title}
                </h3>
                <p className="text-sm text-text-secondary">{review.artist}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
