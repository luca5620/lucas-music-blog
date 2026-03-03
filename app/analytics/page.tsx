/**
 * Analytics Page — Real data from Spotify Extended Streaming History.
 * 169,574 total streams, 8,688 hours across 4,186 artists.
 * Processed from official Spotify data export (2018-2026).
 */

import { BreadcrumbSchema } from "@/app/schema";

export const metadata = {
  title: "Listening Analytics",
  description:
    "Real Spotify listening data from 2018-2026. 169,574 streams, 8,688 hours, 4,186 artists. See what Luca actually listens to.",
  alternates: {
    canonical: "https://peakmusicreviews.com/analytics",
  },
};

/* Real data from stats.fm — lifetime listening stats */
const topArtists = [
  { name: "The Weeknd", streams: 13607, hours: 1010, spotifyId: "2r7BPog74oaTG5shNYiUnV", image: "/analytics/artists/the-weeknd.png" },
  { name: "Kanye West", streams: 7797, hours: 473, spotifyId: "1UGD3lW3tDmgZfAVDh6w7r", image: "/analytics/artists/kanye-west.png" },
  { name: "Frank Ocean", streams: 4820, hours: 316, spotifyId: "7eqoqGkKwgOaWNNHx90uEZ", image: "/analytics/artists/frank-ocean.png" },
  { name: "Travis Scott", streams: 4808, hours: 283, spotifyId: "1i9lZvlaDdWDPyXEE95aiq", image: "/analytics/artists/travis-scott.png" },
  { name: "glaive", streams: 7496, hours: 262, spotifyId: "4DOvwcmqmeJXcomd7xhleR", image: "/analytics/artists/glaive.png" },
  { name: "Steve Lacy", streams: 4313, hours: 248, spotifyId: "3ixe45hov7EBKXm8tYBmvX", image: "/analytics/artists/steve-lacy.png" },
  { name: "Drake", streams: 4043, hours: 227, spotifyId: "2HSmyk2qMN8WQjuGhaQgCk", image: "/analytics/artists/drake.png" },
  { name: "D. Savage", streams: 5031, hours: 215, spotifyId: "4tqbLV1qI50CFh5zkvNEPY", image: "/analytics/artists/d-savage.png" },
  { name: "Playboi Carti", streams: 4568, hours: 198, spotifyId: "3yk7PJnryiJ8mAPqsrujzf", image: "/analytics/artists/playboi-carti.png" },
  { name: "Coldplay", streams: 2922, hours: 172, spotifyId: "1mea3bSkSGXuIRvnydlB5b", image: "/analytics/artists/coldplay.png" },
];

const topTracks = [
  { name: "House Of Balloons / Glass Table Girls", artist: "The Weeknd", streams: 1800, hours: 185, spotifyId: "2r7BPog74oaTG5shNYiUnV", image: "/analytics/tracks/house-of-balloons-glass-table-girls.png" },
  { name: "needy", artist: "Ariana Grande", streams: 1367, hours: 63, spotifyId: "1TEL6MlSSVLSdhOSddidlJ", image: "/analytics/tracks/needy.png" },
  { name: "Mercury", artist: "Steve Lacy", streams: 1056, hours: 82, spotifyId: "3ixe45hov7EBKXm8tYBmvX", image: "/analytics/tracks/mercury.png" },
  { name: "Ain't Bout Nun", artist: "RealYungPhil", streams: 893, hours: 25, spotifyId: "0HGUqBuwVsTh5vN8kM7YOC", image: "/analytics/tracks/ain-t-bout-nun.png" },
  { name: "JOKER, PT. 2", artist: "D. Savage", streams: 836, hours: 34, spotifyId: "4tqbLV1qI50CFh5zkvNEPY", image: "/analytics/tracks/joker-pt-2.png" },
  { name: "Space Boy (feat. Lucki)", artist: "Manny Laurenko", streams: 821, hours: 36, spotifyId: "5VxBLZn5wWP6adTZNOakY5", image: "/analytics/tracks/space-boy.png" },
  { name: "Butterfly", artist: "Pi'erre Bourne", streams: 778, hours: 40, spotifyId: "0Jttv4sD1ofTqPGkNQAqOh", image: "/analytics/tracks/butterfly.png" },
  { name: "Them > You (Gotta Go!)", artist: "Autumn!", streams: 755, hours: 33, spotifyId: "169jVgHjxiHouzm0nWmIDY", image: "/analytics/tracks/them-you-gotta-go.png" },
  { name: "Devil In A New Dress", artist: "Kanye West", streams: 754, hours: 68, spotifyId: "1UGD3lW3tDmgZfAVDh6w7r", image: "/analytics/tracks/devil-in-a-new-dress.png" },
  { name: "HONEST", artist: "Baby Keem", streams: 753, hours: 35, spotifyId: "58k32my5lKofeZRtIvBDg9", image: "/analytics/tracks/honest.png" },
];

const topAlbums = [
  { name: "House Of Balloons - Original", artist: "The Weeknd", hours: 338, spotifyId: "2ye9iWj5V4g6k6HFeTTAKa", image: "/analytics/albums/house-of-balloons.png" },
  { name: "Blonde", artist: "Frank Ocean", hours: 196, spotifyId: "7eqoqGkKwgOaWNNHx90uEZ", image: "/analytics/albums/blonde.png" },
  { name: "UTOPIA", artist: "Travis Scott", hours: 117, spotifyId: "3KCNiDi9Pza6ZD8FggNoaw", image: "/analytics/albums/utopia.png" },
  { name: "My Beautiful Dark Twisted Fantasy", artist: "Kanye West", hours: 105, spotifyId: "2gZUPNdnz5Y45eiGxpHGSc", image: "/analytics/albums/my-beautiful-dark-twisted-fantasy.png" },
  { name: "Thursday - Original", artist: "The Weeknd", hours: 99, spotifyId: "5JpSjNcjuP8L9QrYmv3xcn", image: "/analytics/albums/thursday.png" },
];

const genres = [
  { name: "Hip-Hop/Rap", hours: 4719, color: "bg-accent-primary" },
  { name: "R&B/Soul", hours: 1440, color: "bg-accent-rose" },
  { name: "Pop", hours: 925, color: "bg-accent-cyan" },
  { name: "Alternative", hours: 799, color: "bg-text-secondary" },
  { name: "Hyperpop", hours: 494, color: "bg-accent-glow" },
];

const stats = [
  { label: "Total Streams", value: "169,574", sub: "Lifetime" },
  { label: "Hours Listened", value: "8,688", sub: "~362 days" },
  { label: "Unique Artists", value: "4,186", sub: "All time" },
  { label: "Unique Tracks", value: "13,739", sub: "All time" },
];

export default function Analytics() {
  const maxArtistHours = topArtists[0].hours;
  const maxGenreHours = genres[0].hours;

  return (
    <div className="space-y-8">
      {/* JSON-LD Structured Data */}
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Analytics", href: "/analytics" },
        ]}
      />

      {/* Page Header */}
      <div className="space-y-3">
        <h1 className="font-[family-name:var(--font-heading)] text-3xl sm:text-4xl font-extrabold text-accent-cyan">
          Listening Analytics
        </h1>
        <p className="text-text-secondary">
          Real data pulled from years of Spotify listening. What I actually play,
          not what I say I play.
        </p>
        <p className="pixel-text text-xs text-text-muted uppercase tracking-widest">
          Data from Spotify Extended Streaming History — 2018-2026
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <div key={stat.label} className="card-y2k p-3 sm:p-4 text-center space-y-1">
            <p className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-extrabold text-accent-primary">
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
              <a key={artist.name} href={`https://open.spotify.com/artist/${artist.spotifyId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 hover:bg-bg-elevated/50 rounded-lg p-1 -m-1 transition-colors">
                <span className="pixel-text text-lg text-text-muted w-6 text-right">{i + 1}</span>
                <div className="w-9 h-9 rounded-full overflow-hidden bg-bg-elevated shrink-0">
                  <img src={artist.image} alt={artist.name} className="w-full h-full object-cover" />
                </div>
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
              </a>
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
            <a key={track.name} href={`https://open.spotify.com/track/${track.spotifyId}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 py-2 border-b border-border-subtle last:border-0 hover:bg-bg-elevated/50 rounded-lg transition-colors">
              <span className="pixel-text text-lg text-text-muted w-6 text-right">{i + 1}</span>
              <div className="w-10 h-10 rounded overflow-hidden bg-bg-elevated shrink-0">
                <img src={track.image} alt={track.name} className="w-full h-full object-cover" />
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
            </a>
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
            <a key={album.name} href={`https://open.spotify.com/album/${album.spotifyId}`} target="_blank" rel="noopener noreferrer" className="text-center space-y-2 hover:opacity-80 transition-opacity">
              <div className="aspect-square rounded-lg bg-bg-elevated overflow-hidden">
                <img src={album.image} alt={album.name} className="w-full h-full object-cover" />
              </div>
              <div>
                <p className="pixel-text text-xs text-accent-primary">#{i + 1}</p>
                <p className="font-[family-name:var(--font-heading)] font-semibold text-text-primary text-xs leading-tight">
                  {album.name}
                </p>
                <p className="text-xs text-text-secondary">{album.artist}</p>
                <p className="text-xs text-text-muted">{album.hours}h</p>
              </div>
            </a>
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
          View Profile on stats.fm ↗
        </a>
      </div>
    </div>
  );
}
