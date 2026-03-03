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
  // --- Bulk entries — review pending ---
  {
    slug: "channel-orange-frank-ocean",
    title: "Channel Orange",
    artist: "Frank Ocean",
    rating: 9.8,
    genre: "R&B",
    releaseType: "album",
    releaseDate: "2012-07-10",
    reviewDate: "",
    summary: "",
    snippet: "9.8/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "thursday-the-weeknd",
    title: "Thursday",
    artist: "The Weeknd",
    rating: 9.7,
    genre: "R&B",
    releaseType: "mixtape",
    releaseDate: "2011-08-18",
    reviewDate: "",
    summary: "",
    snippet: "9.7/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "blonde-frank-ocean",
    title: "Blonde",
    artist: "Frank Ocean",
    rating: 9.4,
    genre: "R&B",
    releaseType: "album",
    releaseDate: "2016-08-20",
    reviewDate: "",
    summary: "",
    snippet: "9.4/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "echoes-of-silence-the-weeknd",
    title: "Echoes of Silence",
    artist: "The Weeknd",
    rating: 9.2,
    genre: "R&B",
    releaseType: "mixtape",
    releaseDate: "2011-12-21",
    reviewDate: "",
    summary: "",
    snippet: "9.2/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "after-hours-the-weeknd",
    title: "After Hours",
    artist: "The Weeknd",
    rating: 9.0,
    genre: "R&B",
    releaseType: "album",
    releaseDate: "2020-03-20",
    reviewDate: "",
    summary: "",
    snippet: "9.0/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "in-rainbows-radiohead",
    title: "In Rainbows",
    artist: "Radiohead",
    rating: 9.0,
    genre: "Alternative",
    releaseType: "album",
    releaseDate: "2007-10-10",
    reviewDate: "",
    summary: "",
    snippet: "9.0/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "playboi-carti-playboi-carti",
    title: "Playboi Carti",
    artist: "Playboi Carti",
    rating: 8.8,
    genre: "Hip-Hop",
    releaseType: "mixtape",
    releaseDate: "2017-04-14",
    reviewDate: "",
    summary: "",
    snippet: "8.8/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "get-up-newjeans",
    title: "Get Up",
    artist: "NewJeans",
    rating: 8.8,
    genre: "Pop",
    releaseType: "EP",
    releaseDate: "2023-07-21",
    reviewDate: "",
    summary: "",
    snippet: "8.8/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "rodeo-travis-scott",
    title: "Rodeo",
    artist: "Travis Scott",
    rating: 8.7,
    genre: "Hip-Hop",
    releaseType: "album",
    releaseDate: "2015-09-04",
    reviewDate: "",
    summary: "",
    snippet: "8.7/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "who-really-cares-tv-girl",
    title: "Who Really Cares",
    artist: "TV Girl",
    rating: 8.7,
    genre: "Alternative",
    releaseType: "album",
    releaseDate: "2016-03-04",
    reviewDate: "",
    summary: "",
    snippet: "8.7/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
  {
    slug: "die-lit-playboi-carti",
    title: "Die Lit",
    artist: "Playboi Carti",
    rating: 8.3,
    genre: "Hip-Hop",
    releaseType: "album",
    releaseDate: "2018-05-11",
    reviewDate: "",
    summary: "",
    snippet: "8.3/10 — Full review coming soon.",
    coverImage: "",
    standoutTracks: [],
  },
];

/* --- Helper Functions --- */

export function getAllReviews(): Review[] {
  return [...reviews].sort((a, b) => {
    // Reviewed entries first (sorted by reviewDate desc), then unreviewed (sorted by rating desc)
    if (a.reviewDate && !b.reviewDate) return -1;
    if (!a.reviewDate && b.reviewDate) return 1;
    if (a.reviewDate && b.reviewDate)
      return new Date(b.reviewDate).getTime() - new Date(a.reviewDate).getTime();
    return b.rating - a.rating;
  });
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
