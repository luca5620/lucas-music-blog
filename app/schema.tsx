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
 *  - SoftwareApplicationSchema — The product itself (free music app, web + iOS)
 *  - BreadcrumbSchema     — Breadcrumb navigation trail
 *  - ReviewSchema         — Individual review (MusicAlbum + Review)
 *  - ReleaseSchema        — Release page (MusicAlbum + aggregateRating + reviews)
 *  - ArtistSchema         — Artist page (MusicGroup + discography)
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
/*  SoftwareApplication Schema — the product, for AI + app answers     */
/* ------------------------------------------------------------------ */

/**
 * Describes Peak Music Reviews as an APPLICATION, not just a website
 * (Luca 2026-09-02: "how to rank highly if someone asks ChatGPT or
 * Claude about music reviewing apps"). Search engines and the AI
 * assistants that read their indexes use this to answer "is it an
 * app, on what, does it cost anything, what does it do" without
 * guessing — the same facts public/llms.txt spells out in prose.
 * Rendered site-wide from the root layout next to WebSiteSchema.
 */
export function SoftwareApplicationSchema({
  appStoreUrl,
}: {
  appStoreUrl: string;
}) {
  const schema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE_NAME,
    alternateName: "Peak Music",
    url: SITE_URL,
    applicationCategory: "MusicApplication",
    applicationSubCategory: "Music reviews and ratings social network",
    operatingSystem: "Web, iOS",
    downloadUrl: appStoreUrl,
    installUrl: appStoreUrl,
    sameAs: [appStoreUrl],
    isAccessibleForFree: true,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    description:
      "Free music social network and review app: rate albums and songs 0–10, write reviews, build lists, join live release-night rooms and two-sided debates. Every release on Spotify plus Genius's deep library — unreleased music included.",
    featureList: [
      "Rate albums and songs from 0 to 10.0 with decimal precision",
      "Write and share reviews with a community average per release",
      "Build lists and import Spotify playlists",
      "Live release-night chat rooms",
      "Two-sided debates with live voting",
      "Rate unreleased and leaked songs (metadata only)",
      "Customizable profile themes, showcases and badges",
    ],
    publisher: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: LOGO_URL,
    },
    image: LOGO_URL,
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

/** Map our release_type to schema.org MusicAlbumProductionType */
function toAlbumProductionType(releaseType: string | null): string {
  switch (releaseType) {
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
}

/** Map our release_type to schema.org MusicAlbumReleaseType */
function toAlbumReleaseType(releaseType: string | null): string {
  switch (releaseType) {
    case "single":
      return "SingleRelease";
    case "EP":
      return "EPRelease";
    default:
      return "AlbumRelease";
  }
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
  const albumProductionType = toAlbumProductionType(review.release_type);
  const albumReleaseType = toAlbumReleaseType(review.release_type);

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
/*  Release Schema — MusicAlbum + aggregateRating for release pages.  */
/*  This is the star-snippet play: Google shows rating stars for      */
/*  MusicAlbum pages that carry aggregateRating + Review objects.     */
/* ------------------------------------------------------------------ */

export interface ReleaseSchemaTrack {
  position: number;
  title: string;
  spotify_id: string | null;
}

export interface ReleaseSchemaReview {
  slug: string;
  rating: number;
  summary: string | null;
  snippet: string | null;
  created_at: string;
  authorName: string;
  authorUsername: string | null;
}

export function ReleaseSchema({
  release,
  artistName,
  artistSlug,
  stats,
  reviews,
}: {
  release: {
    slug: string;
    title: string;
    release_type: string | null;
    release_date: string | null;
    cover_image: string | null;
    description: string | null;
  };
  artistName: string;
  artistSlug?: string;
  stats: { review_count: number; avg_rating: number | null };
  reviews: ReleaseSchemaReview[];
}) {
  const releaseUrl = `${SITE_URL}/releases/${release.slug}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "MusicAlbum",
    name: release.title,
    url: releaseUrl,
    ...(release.cover_image && { image: release.cover_image }),
    ...(release.release_date && { datePublished: release.release_date }),
    ...(release.description && { description: release.description }),
    albumProductionType: `https://schema.org/${toAlbumProductionType(release.release_type)}`,
    albumReleaseType: `https://schema.org/${toAlbumReleaseType(release.release_type)}`,
    byArtist: {
      "@type": "MusicGroup",
      name: artistName,
      ...(artistSlug && { url: `${SITE_URL}/artists/${artistSlug}` }),
    },
    // Google requires aggregateRating or review for rating rich results;
    // emit them only when real community activity exists.
    ...(stats.review_count > 0 &&
      stats.avg_rating !== null && {
        aggregateRating: {
          "@type": "AggregateRating",
          ratingValue: Math.round(stats.avg_rating * 10) / 10,
          reviewCount: stats.review_count,
          bestRating: 10,
          worstRating: 0,
        },
      }),
    ...(reviews.length > 0 && {
      review: reviews.slice(0, 5).map((r) => ({
        "@type": "Review",
        url: `${SITE_URL}/reviews/${r.slug}`,
        datePublished: r.created_at.slice(0, 10),
        ...((r.summary || r.snippet) && {
          reviewBody: (r.summary ?? r.snippet ?? "").slice(0, 500),
        }),
        author: {
          "@type": "Person",
          name: r.authorName,
          ...(r.authorUsername && {
            url: `${SITE_URL}/profile/${r.authorUsername}`,
          }),
        },
        reviewRating: {
          "@type": "Rating",
          ratingValue: r.rating,
          bestRating: 10,
          worstRating: 0,
        },
      })),
    }),
  };

  return <JsonLd data={schema} />;
}

/* ------------------------------------------------------------------ */
/*  Artist Schema — MusicGroup + discography for artist pages          */
/* ------------------------------------------------------------------ */

export function ArtistSchema({
  artist,
  releases,
}: {
  artist: {
    slug: string;
    name: string;
    bio: string | null;
    image_url: string | null;
    genres: string[] | null;
  };
  releases: { slug: string; title: string }[];
}) {
  const artistUrl = `${SITE_URL}/artists/${artist.slug}`;

  const schema = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: artist.name,
    url: artistUrl,
    ...(artist.image_url && { image: artist.image_url }),
    ...(artist.bio && { description: artist.bio }),
    ...(artist.genres &&
      artist.genres.length > 0 && { genre: artist.genres }),
    ...(releases.length > 0 && {
      album: releases.map((r) => ({
        "@type": "MusicAlbum",
        name: r.title,
        url: `${SITE_URL}/releases/${r.slug}`,
      })),
    }),
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
  /** Google REQUIRES an author on every Review for rich results —
      omitting it flags the whole page's items as invalid in GSC. */
  authorName: string;
  authorUsername: string | null;
  datePublished: string | null;
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
        author: {
          "@type": "Person",
          name: review.authorName,
          ...(review.authorUsername && {
            url: `${SITE_URL}/profile/${review.authorUsername}`,
          }),
        },
        ...(review.datePublished && {
          datePublished: review.datePublished.slice(0, 10),
        }),
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
