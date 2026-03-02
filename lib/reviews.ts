/**
 * Review Data — Peak Music Reviews
 *
 * TEMPLATE WORKFLOW:
 * To add a new review, tell Claude "bring up the template" and provide:
 * 1. Cover image (drop the file — goes in public/reviews/)
 * 2. Release type (single / EP / album / mixtape)
 * 3. Title & Artist
 * 4. Rating (1.0 - 10.0)
 * 5. Genre (Hip-Hop / Pop / Alternative / R&B)
 * 6. Summary (100-200 words)
 * 7. Top 3 standout tracks with Spotify links
 *
 * Claude will generate the review entry and update this file.
 */

export type ReleaseType = "single" | "EP" | "album" | "mixtape";

export type Genre = "Hip-Hop" | "Pop" | "Alternative" | "R&B";

export interface StandoutTrack {
  title: string;
  spotifyUrl: string;
}

export interface Review {
  slug: string;
  title: string;
  artist: string;
  rating: number;
  genre: Genre;
  releaseType: ReleaseType;
  date: string;
  summary: string;
  snippet: string;
  coverImage: string;
  standoutTracks: StandoutTrack[];
}

export const reviews: Review[] = [
  {
    slug: "the-romantic-bruno-mars",
    title: "The Romantic",
    artist: "Bruno Mars",
    rating: 8.1,
    genre: "Pop",
    releaseType: "album",
    date: "2026-02-27",
    summary:
      "After nearly 10 years, Bruno Mars comes back with a short solo album, with many Latin influences. The album sounds familiar as the formula many have learned to fall in love with over the years continues to win over hearts, especially with standout tracks such as \"Risk It All\", \"Why You Wanna Fight?\", and \"On My Soul\" being my personal favorites. This fantastic album was all killer no filler but personally after such a long wait I wish we could have had a bit more, although Bruno Mars is not known for lengthy solo albums, for the wait it would have been a nice touch. The production and story of the album is great with a few low-lights in my opinion such as \"God Was Showing Off\", and \"Something Serious\", dropping my rating slightly but still putting this album in elite territory for 2026 releases, going with a strong 8.1/10.",
    snippet:
      "After nearly 10 years, Bruno Mars comes back with a short solo album. All killer no filler — elite territory for 2026.",
    coverImage: "/reviews/the-romantic-bruno-mars.png",
    standoutTracks: [
      {
        title: "Risk It All",
        spotifyUrl: "https://open.spotify.com/track/5y2ijHECwFYWqcAHKTZgzD",
      },
      {
        title: "Why You Wanna Fight?",
        spotifyUrl: "https://open.spotify.com/track/3Ac4AjYkqsvop2ydbSAhTX",
      },
      {
        title: "On My Soul",
        spotifyUrl: "https://open.spotify.com/track/4i4BVY2JiH4mDSLIBdNGKD",
      },
    ],
  },
  {
    slug: "gnx-kendrick-lamar",
    title: "GNX",
    artist: "Kendrick Lamar",
    rating: 9.2,
    genre: "Hip-Hop",
    releaseType: "album",
    date: "2025-11-22",
    summary:
      "Kendrick dropped this out of nowhere and it might be his most complete project yet. The production is layered but never cluttered, and every track feels intentional. He's rapping with a precision that makes you rewind bars just to catch everything. The features are minimal but perfectly placed. This is Kendrick at his most confident — no filler, no wasted moments.",
    snippet:
      "Kendrick dropped this out of nowhere and it might be his most complete project yet.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "chromakopia-tyler-the-creator",
    title: "CHROMAKOPIA",
    artist: "Tyler, The Creator",
    rating: 8.7,
    genre: "Hip-Hop",
    releaseType: "album",
    date: "2025-10-28",
    summary:
      "Tyler keeps evolving. This one feels more introspective without losing the energy. The beats are lush and unpredictable — you never know where a track is going to take you. Some of the arrangements are genuinely stunning. It's not his most accessible work, but it might be his most rewarding if you sit with it.",
    snippet:
      "Tyler keeps evolving. This one feels more introspective without losing the energy.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "wacky-sensations-jean-dawson",
    title: "Wacky Sensations",
    artist: "Jean Dawson",
    rating: 8.8,
    genre: "Alternative",
    releaseType: "album",
    date: "2025-08-15",
    summary:
      "Genre-bending chaos in the best way. Punk, hip-hop, shoegaze all crashing into each other. Jean Dawson refuses to pick a lane and it works because the songwriting holds everything together. The energy is infectious, the hooks are massive, and the whole thing feels like a controlled explosion. One of the most exciting albums of the year.",
    snippet:
      "Genre-bending chaos in the best way. Punk, hip-hop, shoegaze all crashing into each other.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "brat-charli-xcx",
    title: "Brat",
    artist: "Charli XCX",
    rating: 8.4,
    genre: "Pop",
    releaseType: "album",
    date: "2025-06-07",
    summary:
      "Messy, chaotic, self-aware pop. The kind of album you blast at 1am with the windows down. Charli leans into the chaos and comes out the other side with something that feels genuinely unfiltered. The production is abrasive in the best way — distorted synths, pounding kicks, and hooks that refuse to leave your head.",
    snippet:
      "Messy, chaotic, self-aware pop. The kind of album you blast at 1am with the windows down.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "hit-me-hard-and-soft-billie-eilish",
    title: "Hit Me Hard and Soft",
    artist: "Billie Eilish",
    rating: 7.9,
    genre: "Alternative",
    releaseType: "album",
    date: "2025-05-17",
    summary:
      "Billie going for a more cohesive, less single-driven album. Respect the vision even if some tracks drag. The highs are really high — when Billie and Finneas lock in on a vibe, nobody does it better. But a few tracks feel like they're reaching for something they don't quite grab. Still, the ambition is admirable.",
    snippet:
      "Billie going for a more cohesive, less single-driven album. Respect the vision even if some tracks drag.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "the-great-impersonator-halsey",
    title: "The Great Impersonator",
    artist: "Halsey",
    rating: 7.5,
    genre: "Pop",
    releaseType: "album",
    date: "2025-10-25",
    summary:
      "Genre-hopping concept album that sometimes works brilliantly and sometimes loses the thread. When Halsey commits fully to a style, the results are impressive. But the constant shifting can feel more like a showcase than a cohesive album. The personal lyrics anchor it though, and there are genuine moments of brilliance scattered throughout.",
    snippet:
      "Genre-hopping concept album that sometimes works brilliantly and sometimes loses the thread.",
    coverImage: "",
    standoutTracks: [],
  },
];

/* --- Helper Functions --- */

export function getAllReviews(): Review[] {
  return [...reviews].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

export function getReviewBySlug(slug: string): Review | undefined {
  return reviews.find((r) => r.slug === slug);
}

export function getLatestReviews(count: number): Review[] {
  return getAllReviews().slice(0, count);
}

export function getReviewsByGenre(genre: Genre): Review[] {
  return getAllReviews().filter((r) => r.genre === genre);
}

/* --- Color Utilities --- */

export function getGenreColor(genre: string) {
  switch (genre) {
    case "Hip-Hop":
      return "text-accent-primary";
    case "Pop":
      return "text-accent-cyan";
    case "Alternative":
      return "text-accent-rose";
    case "R&B":
      return "text-accent-glow";
    default:
      return "text-accent-primary";
  }
}

export function getRatingColor(rating: number) {
  if (rating >= 9) return "text-accent-primary border-accent-primary";
  if (rating >= 8) return "text-accent-cyan border-accent-cyan";
  return "text-text-secondary border-border-bright";
}
