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
    slug: "house-of-balloons-the-weeknd",
    title: "House of Balloons",
    artist: "The Weeknd",
    rating: 10,
    genre: "R&B",
    releaseType: "mixtape",
    releaseDate: "2011-03-21",
    reviewDate: "2026-03-01",
    summary:
      "As my first 10/10 rating I have what I say is the \"Greatest Album of All Time\" which is the debut mixtape/album by The Weeknd, who I also think is the greatest artist of all time. I have never heard an album before that has put me in such a vivid experience that I can see and feel, more than this mixtape. House of Balloons is a life-changing album that is so dark and eerie, that makes you want to open a window and breath as you are surrounded by girls, drinks, and drugs all around you in the most drug-induced experience ever. With this explanation I am referring to my favorite track of this mixtape as well as my favorite song of all time, \"House Of Balloons / Glass Table Girls\". I truly do not believe any song on this album is bad, even the bonus song \"Twenty Eight\" being great as well. To round out my top 3 songs however I would say \"The Knowing\" and \"Wicked Games\" are truly fantastic songs and overall this album would be my personal recommendation for anyone in music to give a listen and see if they agree with this 10/10 review of mine.",
    snippet:
      "The \"Greatest Album of All Time\" — a life-changing, dark, and eerie experience. The first and only 10/10.",
    coverImage: "/reviews/house-of-balloons-the-weeknd.png",
    standoutTracks: [
      {
        title: "House of Balloons / Glass Table Girls",
        spotifyUrl: "https://open.spotify.com/track/2r7BPog74oaTG5shNYiUnV",
      },
      {
        title: "The Knowing",
        spotifyUrl: "https://open.spotify.com/track/6tjsbysvZh8Pq8DZA5ldrn",
      },
      {
        title: "Wicked Games",
        spotifyUrl: "https://open.spotify.com/track/00aqkszH1FdUiJJWvX6iEl",
      },
    ],
  },
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
  if (rating === 10) return "rating-perfect text-[#1e90ff] border-[#1e90ff]";
  if (rating >= 9) return "text-purple-400 border-purple-400";
  if (rating >= 8) return "text-[#2563eb] border-[#2563eb]";
  if (rating >= 7) return "text-[#06b6d4] border-[#06b6d4]";
  if (rating >= 6) return "text-[#166534] border-[#166534]";
  if (rating >= 5) return "text-[#84cc16] border-[#84cc16]";
  if (rating >= 4) return "text-yellow-400 border-yellow-400";
  if (rating >= 3) return "text-orange-400 border-orange-400";
  if (rating >= 2) return "text-red-500 border-red-500";
  return "text-neutral-900 border-neutral-900";
}
