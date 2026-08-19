/**
 * JSON-LD Structured Data — Peak Music Reviews
 *
 * Reusable schema components that output <script type="application/ld+json"> tags.
 * Follows Google's structured data guidelines for rich results.
 *
 * Overhaul v2: Peak Music Reviews is a community platform now, not a one-person
 * blog — so the site publishes as an Organization and every review
 * credits its actual community author.
 *
 * Components:
 *  - WebSiteSchema        — Site-wide sitelinks searchbox & identity
 *  - BreadcrumbSchema     — Breadcrumb navigation trail
 *  - ReviewSchema         — Individual review (MusicAlbum + Review)
 *  - CollectionPageSchema — Reviews listing page
 *  - ItemListSchema       — List of review items (for home + reviews pages)
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SITE_URL = "https://peakmusicreviews.com";
const SITE_NAME = "Peak Music Reviews";
const LOGO_URL = `${SITE_URL}/penguin-logo.png`;

/* ------------------------------------------------------------------ */
/*  Helper: render a JSON-LD script tag                                */
/* ------------------------------------------------------------------ */

function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // JSON.stringify does NOT escape "</script>", so a review title
      // containing it could break out of this tag and become stored XSS.
      // Escaping < > & as \uXXXX keeps the JSON valid and inert.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data)
          .replace(/</g, "\\u003c")
          .replace(/>/g, "\\u003e")
          .replace(/&/g, "\\u0026"),
      }}
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
      "The music social network: rate albums, build lists, join live release rooms and debates.",
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: LOGO_URL,
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
/*  Takes the DB row shape (snake_case) + the community author.        */
/* ------------------------------------------------------------------ */

export interface ReviewSchemaInput {
  slug: string;
  title: string;
  artist: string;
  rating: number;
  genre: string | null;
  release_type: string | null;
  release_date: string | null;
  review_date: string | null;
  snippet: string | null;
  summary: string | null;
  cover_image: string | null;
  standout_tracks: { title: string; spotifyUrl: string }[];
}

export function ReviewSchema({
  review,
  authorName,
  authorUrl,
}: {
  review: ReviewSchemaInput;
  authorName: string;
  authorUrl: string;
}) {
  // Map release_type to schema.org MusicAlbumProductionType
  const albumProductionType = (() => {
    switch (review.release_type) {
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

  const albumReleaseType = (() => {
    switch (review.release_type) {
      case "single":
        return "SingleRelease";
      case "EP":
        return "EPRelease";
      default:
        return "AlbumRelease";
    }
  })();

  const reviewUrl = `${SITE_URL}/reviews/${review.slug}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "Review",
    name: `${review.title} by ${review.artist} — Review`,
    url: reviewUrl,
    description: review.snippet || review.summary || undefined,
    ...(review.review_date && { datePublished: review.review_date }),
    author: {
      "@type": "Person",
      name: authorName,
      url: authorUrl,
    },
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    reviewRating: {
      "@type": "Rating",
      ratingValue: review.rating,
      bestRating: 10,
      worstRating: 0,
    },
    itemReviewed: {
      "@type": "MusicAlbum",
      name: review.title,
      ...(review.cover_image && { image: review.cover_image }),
      ...(review.release_date && { datePublished: review.release_date }),
      ...(review.genre && { genre: review.genre }),
      albumProductionType: `https://schema.org/${albumProductionType}`,
      albumReleaseType: `https://schema.org/${albumReleaseType}`,
      byArtist: {
        "@type": "MusicGroup",
        name: review.artist,
      },
      ...(review.standout_tracks.length > 0 && {
        track: {
          "@type": "ItemList",
          numberOfItems: review.standout_tracks.length,
          itemListElement: review.standout_tracks.map((track, index) => ({
            "@type": "ListItem",
            position: index + 1,
            item: {
              "@type": "MusicRecording",
              name: track.title,
              ...(track.spotifyUrl && { url: track.spotifyUrl }),
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

export function CollectionPageSchema({ totalItems }: { totalItems: number }) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Community Music Reviews — Peak Music Reviews",
    description:
      "Honest takes from the whole community. Every review is tied to a real release.",
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
/*  Takes a minimal shape so both static + DB callers can use it.      */
/* ------------------------------------------------------------------ */

export interface ItemListReview {
  slug: string;
  title: string;
  artist: string;
  rating: number;
}

export function ItemListSchema({
  reviews,
  listName,
}: {
  reviews: ItemListReview[];
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
        reviewRating: {
          "@type": "Rating",
          ratingValue: review.rating,
          bestRating: 10,
          worstRating: 0,
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
