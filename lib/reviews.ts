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
 * 6. Release date
 * 7. Summary (100-200 words)
 * 8. Top 3 standout tracks with Spotify links
 *
 * Claude will generate the review entry and update this file.
 * Review date is set to the current date automatically.
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
  releaseDate: string;
  reviewDate: string;
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
    releaseDate: "2026-02-27",
    reviewDate: "2026-03-01",
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
];

/* --- Helper Functions --- */

export function getAllReviews(): Review[] {
  return [...reviews].sort(
    (a, b) => new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime()
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
  if (rating >= 9) return "text-emerald-400 border-emerald-400";
  if (rating >= 8) return "text-green-400 border-green-400";
  if (rating >= 7) return "text-lime-400 border-lime-400";
  if (rating >= 6) return "text-yellow-400 border-yellow-400";
  if (rating >= 5) return "text-amber-400 border-amber-400";
  if (rating >= 4) return "text-orange-400 border-orange-400";
  if (rating >= 3) return "text-red-400 border-red-400";
  if (rating >= 2) return "text-red-500 border-red-500";
  return "text-red-600 border-red-600";
}
