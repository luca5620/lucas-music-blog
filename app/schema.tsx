/**
 * JSON-LD Structured Data — Peak Music Reviews
 *
 * Reusable schema components that output <script type="application/ld+json"> tags.
 * Follows Google's structured data guidelines for rich results.
 *
 * Components:
 *  - WebSiteSchema        — Site-wide sitelinks searchbox & identity
 *  - PersonSchema         — Author (Luca) as Person entity
 *  - BreadcrumbSchema     — Breadcrumb navigation trail
 *  - ReviewSchema         — Individual album/track review (MusicAlbum + Review)
 *  - CollectionPageSchema — Reviews listing page
 *  - ItemListSchema       — List of review items (for home + reviews pages)
 *  - ProfilePageSchema    — About page author profile
 */

import type { Review } from "@/lib/reviews";

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SITE_URL = "https://peakmusicreviews.com";
const SITE_NAME = "Peak Music Reviews";
const AUTHOR_NAME = "Luca";
const AUTHOR_URL = `${SITE_URL}/about`;
const LOGO_URL = `${SITE_URL}/penguin-logo.png`;

/* ------------------------------------------------------------------ */
/*  Helper: render a JSON-LD script tag                                */
/* ------------------------------------------------------------------ */

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/* ------------------------------------------------------------------ */
/*  WebSite Schema — used in root layout for site-wide identity        */
/* ------------------------------------------------------------------ */

export function WebSiteSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: SITE_URL,
    description:
      "Honest music reviews and Spotify listening analytics. No pretentious jargon — just real opinions.",
    publisher: {
      "@type": "Person",
      name: AUTHOR_NAME,
      url: AUTHOR_URL,
    },
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/reviews?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };

  return <JsonLd data={schema} />;
}

/* ------------------------------------------------------------------ */
/*  Person Schema — the author, used in root layout                    */
/* ------------------------------------------------------------------ */

export function PersonSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "Person",
    name: AUTHOR_NAME,
    url: AUTHOR_URL,
    image: LOGO_URL,
    description:
      "Music listener, opinion haver, data nerd. Creator of Peak Music Reviews.",
    sameAs: [
      "https://open.spotify.com/user/lucapivard5620",
      "https://soundcloud.com/dope-oasis",
      "https://stats.fm/user/luca5620",
    ],
    knowsAbout: [
      "Music Reviews",
      "Hip-Hop",
      "R&B",
      "Pop",
      "Alternative",
      "Spotify Analytics",
    ],
  };

  return <JsonLd data={schema} />;
}

/* ------------------------------------------------------------------ */
/*  Breadcrumb Schema — navigation trail                               */
/* ------------------------------------------------------------------ */

interface BreadcrumbItem {
  name: string;
  href: string;
}

export function BreadcrumbSchema({ items }: { items: BreadcrumbItem[] }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: `${SITE_URL}${item.href}`,
    })),
  };

  return <JsonLd data={schema} />;
}

/* ------------------------------------------------------------------ */
/*  Review Schema — MusicAlbum + Review for individual review pages    */
/*  Converts 1-10 rating scale to schema.org Rating format             */
/* ------------------------------------------------------------------ */

export function ReviewSchema({ review }: { review: Review }) {
  // Map releaseType to schema.org MusicAlbumProductionType
  const albumProductionType = (() => {
    switch (review.releaseType) {
      case "album":
        return "StudioAlbum";
      case "EP":
        return "EP";
      case "mixtape":
        return "MixtapeAlbum";
      case "single":
        return "SingleRelease";
      default:
        return "StudioAlbum";
    }
  })();

  // Map releaseType to schema.org MusicAlbumReleaseType
  const albumReleaseType = (() => {
    switch (review.releaseType) {
      case "single":
        return "SingleRelease";
      case "EP":
        return "EPRelease";
      case "album":
        return "AlbumRelease";
      case "mixtape":
        return "AlbumRelease";
      default:
        return "AlbumRelease";
    }
  })();

  const reviewUrl = `${SITE_URL}/reviews/${review.slug}`;
  const coverImageUrl = review.coverImage
    ? `${SITE_URL}${review.coverImage}`
    : undefined;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Review",
    name: `${review.title} by ${review.artist} — Review`,
    url: reviewUrl,
    description: review.snippet || review.summary,
    ...(review.reviewDate && { datePublished: review.reviewDate }),
    author: {
      "@type": "Person",
      name: AUTHOR_NAME,
      url: AUTHOR_URL,
    },
    publisher: {
      "@type": "Person",
      name: AUTHOR_NAME,
      url: AUTHOR_URL,
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 10,
      worstRating: 1,
    },
    itemReviewed: {
      "@type": "MusicAlbum",
      name: review.title,
      ...(coverImageUrl && { image: coverImageUrl }),
      datePublished: review.releaseDate,
      genre: review.genre,
      albumProductionType: `https://schema.org/${albumProductionType}`,
      albumReleaseType: `https://schema.org/${albumReleaseType}`,
      byArtist: {
        "@type": "MusicGroup",
        name: review.artist,
      },
      ...(review.standoutTracks.length > 0 && {
        track: {
          "@type": "ItemList",
          numberOfItems: review.standoutTracks.length,
          itemListElement: review.standoutTracks.map((track, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "MusicRecording",
              name: track.title,
              url: track.spotifyUrl,
            },
          })),
        },
      }),
    },
  };

  return <JsonLd data={schema} />;
}

/* ------------------------------------------------------------------ */
/*  CollectionPage Schema — for the /reviews listing page              */
/* ------------------------------------------------------------------ */

export function CollectionPageSchema({
  totalItems,
}: {
  totalItems: number;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Music Reviews — Peak Music Reviews",
    description:
      "Honest takes on albums and tracks. No filler, no pretentious breakdowns.",
    url: `${SITE_URL}/reviews`,
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
    about: {
      "@type": "Thing",
      name: "Music Reviews",
    },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: totalItems,
    },
  };

  return <JsonLd data={schema} />;
}

/* ------------------------------------------------------------------ */
/*  ItemList Schema — for review lists (home latest + reviews page)    */
/* ------------------------------------------------------------------ */

export function ItemListSchema({
  reviews,
  listName,
}: {
  reviews: Review[];
  listName: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    numberOfItems: reviews.length,
    itemListElement: reviews.map((review, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: `${SITE_URL}/reviews/${review.slug}`,
      name: `${review.title} by ${review.artist}`,
      item: {
        "@type": "Review",
        name: `${review.title} by ${review.artist} — Review`,
        url: `${SITE_URL}/reviews/${review.slug}`,
        author: {
          "@type": "Person",
          name: AUTHOR_NAME,
        },
        reviewRating: {
          "@type": "Rating",
          ratingValue: review.rating,
          bestRating: 10,
          worstRating: 1,
        },
        itemReviewed: {
          "@type": "MusicAlbum",
          name: review.title,
          byArtist: {
            "@type": "MusicGroup",
            name: review.artist,
          },
        },
      },
    })),
  };

  return <JsonLd data={schema} />;
}

/* ------------------------------------------------------------------ */
/*  ProfilePage Schema — for the /about author page                    */
/* ------------------------------------------------------------------ */

export function ProfilePageSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: "About Luca — Peak Music Reviews",
    description:
      "Music listener, opinion haver, data nerd. The person behind Peak Music Reviews.",
    url: `${SITE_URL}/about`,
    mainEntity: {
      "@type": "Person",
      name: AUTHOR_NAME,
      alternateName: "lu-cuh",
      url: AUTHOR_URL,
      image: LOGO_URL,
      description:
        "Music listener, opinion haver, data nerd. Creator of Peak Music Reviews.",
      sameAs: [
        "https://open.spotify.com/user/lucapivard5620",
        "https://soundcloud.com/dope-oasis",
        "https://stats.fm/user/luca5620",
      ],
      knowsAbout: [
        "Music Reviews",
        "Hip-Hop",
        "R&B",
        "Pop",
        "Alternative",
        "Spotify Analytics",
      ],
    },
    isPartOf: {
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };

  return <JsonLd data={schema} />;
}
