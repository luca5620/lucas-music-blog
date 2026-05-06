/**
 * Listening analytics data — extracted verbatim from app/analytics/page.tsx
 * so it can be reused on the profile page (Phase 1) and later swapped per-user
 * once Spotify connection lands (Phase 2).
 */

export interface TopArtistRow {
  name: string;
  streams: number;
  hours: number;
  spotifyId: string;
  image: string;
}

export interface TopTrackRow {
  name: string;
  artist: string;
  streams: number;
  hours: number;
  spotifyId: string;
  image: string;
}

export interface TopAlbumRow {
  name: string;
  artist: string;
  hours: number;
  spotifyId: string;
  image: string;
}

export interface GenreRow {
  name: string;
  hours: number;
  color: string;
}

export interface LifetimeStat {
  label: string;
  value: string;
  sub: string;
}

export interface ListeningData {
  stats: LifetimeStat[];
  topArtists: TopArtistRow[];
  topTracks: TopTrackRow[];
  topAlbums: TopAlbumRow[];
  genres: GenreRow[];
}

/* Real data from stats.fm — lifetime listening stats */
const topArtists: TopArtistRow[] = [
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

const topTracks: TopTrackRow[] = [
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

const topAlbums: TopAlbumRow[] = [
  { name: "House Of Balloons - Original", artist: "The Weeknd", hours: 338, spotifyId: "2ye9iWj5V4g6k6HFeTTAKa", image: "/analytics/albums/house-of-balloons.png" },
  { name: "Blonde", artist: "Frank Ocean", hours: 196, spotifyId: "7eqoqGkKwgOaWNNHx90uEZ", image: "/analytics/albums/blonde.png" },
  { name: "UTOPIA", artist: "Travis Scott", hours: 117, spotifyId: "3KCNiDi9Pza6ZD8FggNoaw", image: "/analytics/albums/utopia.png" },
  { name: "My Beautiful Dark Twisted Fantasy", artist: "Kanye West", hours: 105, spotifyId: "2gZUPNdnz5Y45eiGxpHGSc", image: "/analytics/albums/my-beautiful-dark-twisted-fantasy.png" },
  { name: "Thursday - Original", artist: "The Weeknd", hours: 99, spotifyId: "5JpSjNcjuP8L9QrYmv3xcn", image: "/analytics/albums/thursday.png" },
];

const genres: GenreRow[] = [
  { name: "Hip-Hop/Rap", hours: 4719, color: "bg-accent-primary" },
  { name: "R&B/Soul", hours: 1440, color: "bg-accent-rose" },
  { name: "Pop", hours: 925, color: "bg-accent-cyan" },
  { name: "Alternative", hours: 799, color: "bg-text-secondary" },
  { name: "Hyperpop", hours: 494, color: "bg-accent-glow" },
];

const stats: LifetimeStat[] = [
  { label: "Total Streams", value: "169,574", sub: "Lifetime" },
  { label: "Hours Listened", value: "8,688", sub: "~362 days" },
  { label: "Unique Artists", value: "4,186", sub: "All time" },
  { label: "Unique Tracks", value: "13,739", sub: "All time" },
];

export const lucasListeningData: ListeningData = {
  stats,
  topArtists,
  topTracks,
  topAlbums,
  genres,
};
