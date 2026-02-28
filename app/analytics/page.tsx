/**
 * Analytics Page — Real Spotify listening data from stats.fm.
 * Data source: stats.fm/user/luca5620 (lifetime range)
 * 152,266 total streams, 8,088 hours across 3,012 artists.
 */

/* Real data from stats.fm — lifetime listening stats */
const topArtists = [
  { name: "The Weeknd", streams: 13098, hours: 1000 },
  { name: "Kanye West", streams: 8782, hours: 528 },
  { name: "Frank Ocean", streams: 5043, hours: 333 },
  { name: "Travis Scott", streams: 5409, hours: 306 },
  { name: "glaive", streams: 8063, hours: 278 },
  { name: "Drake", streams: 4091, hours: 257 },
  { name: "Steve Lacy", streams: 4217, hours: 245 },
  { name: "Playboi Carti", streams: 5112, hours: 244 },
  { name: "D. Savage", streams: 5043, hours: 216 },
  { name: "Kendrick Lamar", streams: 2765, hours: 177 },
];

const topTracks = [
  { name: "House Of Balloons / Glass Table Girls", artist: "The Weeknd", streams: 1664, hours: 178 },
  { name: "Mercury", artist: "Steve Lacy", streams: 1013, hours: 80 },
  { name: "Devil In A New Dress", artist: "Kanye West", streams: 712, hours: 65 },
  { name: "needy", artist: "Ariana Grande", streams: 1334, hours: 62 },
  { name: "The Knowing", artist: "The Weeknd", streams: 667, hours: 61 },
  { name: "Nights", artist: "Frank Ocean", streams: 698, hours: 58 },
  { name: "Wicked Games", artist: "The Weeknd", streams: 597, hours: 51 },
  { name: "Viva La Vida", artist: "Coldplay", streams: 658, hours: 43 },
  { name: "Reborn", artist: "KIDS SEE GHOSTS", streams: 507, hours: 43 },
  { name: "Real Muthaphuckkin G&apos;s", artist: "Eazy-E", streams: 465, hours: 40 },
];

const topAlbums = [
  { name: "House Of Balloons (Original)", artist: "The Weeknd", hours: 353 },
  { name: "Blonde", artist: "Frank Ocean", hours: 190 },
  { name: "Thursday (Original)", artist: "The Weeknd", hours: 128 },
  { name: "UTOPIA", artist: "Travis Scott", hours: 106 },
  { name: "My Beautiful Dark Twisted Fantasy", artist: "Kanye West", hours: 98 },
];

const genres = [
  { name: "Hip-Hop/Rap", hours: 4719, color: "bg-accent-primary" },
  { name: "R&B/Soul", hours: 1440, color: "bg-accent-rose" },
  { name: "Pop", hours: 925, color: "bg-accent-cyan" },
  { name: "Alternative", hours: 799, color: "bg-text-secondary" },
  { name: "Hyperpop", hours: 494, color: "bg-accent-glow" },
];

const stats = [
  { label: "Total Streams", value: "152,266", sub: "Lifetime" },
  { label: "Hours Listened", value: "8,088", sub: "~337 days" },
  { label: "Unique Artists", value: "3,012", sub: "All time" },
  { label: "Unique Tracks", value: "7,790", sub: "All time" },
];

export default function Analytics() {
  const maxArtistHours = topArtists[0].hours;
  const maxGenreHours = genres[0].hours;

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-heading)] text-4xl font-extrabold text-accent-cyan">
          Listening Analytics
        </h1>
        <p className="text-text-secondary">
          Real data pulled from years of Spotify listening. What I actually play,
          not what I say I play.
        </p>
        <p className="pixel-text text-xs text-text-muted uppercase tracking-widest">
          Data via stats.fm — Lifetime range
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card-y2k p-4 text-center space-y-1">
            <p className="font-[family-name:var(--font-heading)] text-2xl font-extrabold text-accent-primary">
              {stat.value}
            </p>
            <p className="pixel-text text-xs text-text-primary uppercase tracking-widest">
              {stat.label}
            </p>
            <p className="text-xs text-text-muted">{stat.sub}</p>
          </div>
        ))}
      </div>

      {/* Top Artists + Genres — side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top 10 Artists */}
        <div className="card-y2k p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text-primary">
            Top Artists — All Time
          </h2>
          <div className="space-y-3">
            {topArtists.map((artist, i) => (
              <div key={artist.name} className="flex items-center gap-3">
                <span className="pixel-text text-lg text-text-muted w-6 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-[family-name:var(--font-heading)] font-semibold text-text-primary text-sm truncate">
                    {artist.name}
                  </p>
                  <div className="h-1.5 bg-bg-elevated rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-accent-primary rounded-full"
                      style={{ width: `${(artist.hours / maxArtistHours) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-text-primary">{artist.hours.toLocaleString()}h</p>
                  <p className="text-xs text-text-muted">{artist.streams.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Genre Breakdown */}
        <div className="card-y2k p-5 space-y-4">
          <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text-primary">
            Genre Breakdown
          </h2>
          <div className="space-y-3">
            {genres.map((genre) => (
              <div key={genre.name} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-text-primary font-medium">{genre.name}</span>
                  <span className="pixel-text text-text-secondary">{genre.hours.toLocaleString()}h</span>
                </div>
                <div className="h-2.5 bg-bg-elevated rounded-full overflow-hidden">
                  <div
                    className={`h-full ${genre.color} rounded-full`}
                    style={{ width: `${(genre.hours / maxGenreHours) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top Tracks */}
      <div className="card-y2k p-5 space-y-4">
        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text-primary">
          Most Played Tracks — All Time
        </h2>
        <div className="space-y-2">
          {topTracks.map((track, i) => (
            <div key={track.name} className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0">
              <span className="pixel-text text-lg text-text-muted w-6 text-right">{i + 1}</span>
              <div className="w-10 h-10 rounded bg-bg-elevated flex items-center justify-center shrink-0">
                <span className="text-sm">💿</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-[family-name:var(--font-heading)] font-semibold text-text-primary text-sm truncate">
                  {track.name}
                </p>
                <p className="text-xs text-text-secondary truncate">{track.artist}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-accent-primary">{track.hours}h</p>
                <p className="text-xs text-text-muted">{track.streams.toLocaleString()} plays</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Albums */}
      <div className="card-y2k p-5 space-y-4">
        <h2 className="font-[family-name:var(--font-heading)] text-lg font-bold text-text-primary">
          Top Albums
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {topAlbums.map((album, i) => (
            <div key={album.name} className="text-center space-y-2">
              <div className="aspect-square rounded-lg bg-bg-elevated flex items-center justify-center">
                <span className="text-3xl">💿</span>
              </div>
              <div>
                <p className="pixel-text text-xs text-accent-primary">#{i + 1}</p>
                <p className="font-[family-name:var(--font-heading)] font-semibold text-text-primary text-xs leading-tight">
                  {album.name}
                </p>
                <p className="text-xs text-text-secondary">{album.artist}</p>
                <p className="text-xs text-text-muted">{album.hours}h</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* stats.fm link */}
      <div className="text-center py-4">
        <a
          href="https://stats.fm/user/luca5620"
          target="_blank"
          rel="noopener noreferrer"
          className="btn-y2k btn-y2k-outline"
        >
          View Full Stats on stats.fm ↗
        </a>
      </div>
    </div>
  );
}
