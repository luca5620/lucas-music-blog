/**
 * Public Artist Detail Page — Y2K hero / banner / sections layout.
 * Mirrors the profile page visual structure: blurred cover banner,
 * circular avatar header, bio, stats, releases grid, fans grid.
 */

import Link from "next/link";
import BackLink from "@/components/ui/BackLink";
import { redirectMergedOr404 } from "@/lib/db/redirects";
import type { Metadata } from "next";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { getTranslations } from "next-intl/server";
import {
  getArtistBySlug,
  getArtistFollowers,
  getArtistReleases,
  getArtistStats,
  isFollowingArtist,
} from "@/lib/db/artists";
import { getReleaseStats } from "@/lib/db/releases";
import { getRatingHex, formatRating } from "@/lib/rating";
import { getUser } from "@/lib/auth";
import FollowEntityButton from "@/components/follow/FollowEntityButton";
import ReleaseCard from "@/components/releases/ReleaseCard";
import FansGrid from "@/components/artists/FansGrid";
import { ArtistSchema, BreadcrumbSchema } from "@/app/schema";
import type { Release } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/** Alpha mask for the banner's edge fade — sibling of the profile
    page's BANNER_FADE_MASK. Bottom halves match; the top stays a
    TIGHT fade here on purpose (the long mirrored top dissolve is
    profiles-only, Luca 2026-08-24). */
const BANNER_FADE_MASK =
  "linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.6) 6%, rgba(0,0,0,0.92) 12%, black 18%, black 66%, rgba(0,0,0,0.9) 76%, rgba(0,0,0,0.65) 85%, rgba(0,0,0,0.34) 93%, transparent 100%)";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);

  // Not here → maybe merged into another page (066), else a real 404.
  if (!artist) return redirectMergedOr404("artist", slug);

  const description =
    artist.bio?.replace(/\s+/g, " ").trim().slice(0, 160) ??
    `${artist.name} on Peak Music Reviews — albums ranked by the community, reviews, and followers.`;

  return {
    title: `${artist.name} — Albums & Reviews`,
    description,
    alternates: {
      canonical: `https://peakmusicreviews.com/artists/${slug}`,
    },
    openGraph: {
      type: "profile",
      url: `https://peakmusicreviews.com/artists/${slug}`,
      title: `${artist.name} — Peak Music Reviews`,
      description,
      ...(artist.image_url && {
        images: [{ url: artist.image_url, alt: artist.name }],
      }),
    },
  };
}

export default async function ArtistPage({ params }: PageProps) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);

  if (!artist) return redirectMergedOr404("artist", slug);

  const t = await getTranslations("artists.page");
  const [stats, releases, followers, currentUser] = await Promise.all([
    getArtistStats(artist.id),
    getArtistReleases(artist.id),
    getArtistFollowers(artist.id, 12),
    getUser(),
  ]);

  const userFollows = currentUser
    ? await isFollowingArtist(currentUser.id, artist.id)
    : false;

  // Per-release stats (review count + avg rating) for the grid.
  const releaseStats = await Promise.all(
    releases.map(async (r: Release) => {
      const rs = await getReleaseStats(r.id);
      return { release: r, stats: rs };
    })
  );

  /* "<Artist> albums ranked" (Luca 2026-10-25, from the SEO research:
     people search exactly that). The artist's albums, EPs and mixtapes
     that have at least one rating, best community average first; a tie
     goes to the one more people rated. Singles stay out so the heading
     is true. Needs 2+ rated records — a ranking of one isn't one. */
  const ranked = releaseStats
    .filter(
      ({ release, stats: rs }) =>
        !release.is_unreleased &&
        rs.avg_rating !== null &&
        ["album", "EP", "mixtape"].includes(release.release_type)
    )
    .sort(
      (a, b) =>
        (b.stats.avg_rating ?? 0) - (a.stats.avg_rating ?? 0) || b.stats.review_count - a.stats.review_count
    );

  /* "<Artist> unreleased songs" (Luca 2026-10-27, option C of the
     mockups: plain rows like "albums ranked" + an UNRELEASED tag). The
     Genius-only records — leaks, loosies, original versions — get their
     own section instead of hiding in the discography grid. That's the
     wedge (nobody else rates unreleased music) and it's what people
     search for. Metadata and ratings only, never file links. Rated ones
     first (best average first), then the rest newest-added first.
     The discography below is everything else. */
  const unreleased = releaseStats
    .filter(({ release }) => release.is_unreleased)
    .sort(
      (a, b) =>
        (b.stats.avg_rating ?? -1) - (a.stats.avg_rating ?? -1) ||
        b.stats.review_count - a.stats.review_count ||
        b.release.created_at.localeCompare(a.release.created_at)
    );
  const discography = releaseStats.filter(({ release }) => !release.is_unreleased);

  const accentColor = "#1e90ff";
  const initial = artist.name[0]?.toUpperCase() ?? "?";
  const genres = artist.genres ?? [];

  // Banner — blurred cover or accent gradient fallback.
  const bannerStyle: React.CSSProperties = artist.image_url
    ? {
        backgroundImage: `url(${artist.image_url})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
        filter: "blur(20px) brightness(0.4)",
        transform: "scale(1.1)",
      }
    : {
        background: `linear-gradient(135deg, ${accentColor}33 0%, #0a0a0c 50%, ${accentColor}1a 100%)`,
      };

  return (
    <div
      // Must exactly cancel .crt-screen's padding (1rem phones,
      // 2rem/1.75rem sm+, 3.25rem/2rem at 1440px+) — same overflow fix
      // as the profile page.
      className="space-y-6 -mx-4 -mt-4 -mb-8 sm:-mx-8 sm:-mt-7 min-[90rem]:-mx-[3.25rem] min-[90rem]:px-[1.25rem] min-[90rem]:-mt-8"
      style={
        {
          "--profile-accent": accentColor,
          "--profile-glow": `${accentColor}40`,
          "--profile-glow-strong": `${accentColor}80`,
        } as React.CSSProperties
      }
    >
      <BreadcrumbSchema
        items={[
          { name: "Home", href: "/" },
          { name: "Artists", href: "/artists" },
          { name: artist.name, href: `/artists/${artist.slug}` },
        ]}
      />
      <ArtistSchema
        artist={artist}
        releases={releases.map((r: Release) => ({
          slug: r.slug,
          title: r.title,
        }))}
      />

      {/* ========== BANNER ========== */}
      <div className="relative h-48 sm:h-64 w-full overflow-hidden">
        {/* Edge fade is an alpha MASK, not a paint-over — the banner
            dissolves into the liquid/page behind it with no solid
            band or color seam. Twin of BANNER_FADE_MASK on the
            profile page — keep them in step. */}
        <div
          className="absolute inset-0"
          style={{
            ...bannerStyle,
            WebkitMaskImage: BANNER_FADE_MASK,
            maskImage: BANNER_FADE_MASK,
          }}
        />

        {/* Scan bar */}
        <div className="absolute bottom-0 left-0 right-0 h-[1px] overflow-hidden">
          <div
            className="h-full w-1/2 animate-[scan-bar_3s_ease-in-out_infinite]"
            style={{
              background: `linear-gradient(90deg, transparent, ${accentColor}99, transparent)`,
            }}
          />
        </div>
      </div>

      {/* ========== HEADER ========== */}
      <div className="px-4 sm:px-8 -mt-20 relative z-10 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end gap-4 sm:gap-6">
          {/* Avatar */}
          <div
            className="w-28 h-28 sm:w-36 sm:h-36 rounded-full overflow-hidden border-4 shrink-0"
            style={{
              borderColor: accentColor,
              boxShadow: `0 0 24px ${accentColor}60, 0 0 48px ${accentColor}20`,
            }}
          >
            {artist.image_url ? (
              <img
                src={artist.image_url}
                alt={artist.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center text-4xl font-bold"
                style={{ background: `${accentColor}30`, color: accentColor }}
              >
                {initial}
              </div>
            )}
          </div>

          {/* Name + genres */}
          <div className="flex-1 min-w-0 space-y-2">
            <h1 className="font-[family-name:var(--font-space-grotesk)] text-3xl sm:text-5xl font-extrabold text-[#e8e6e3]">
              <span className="truncate">{artist.name}</span>
            </h1>
            {genres.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {genres.slice(0, 5).map((genre) => (
                  <span
                    key={genre}
                    className="pixel-text text-xs uppercase tracking-wider px-2.5 py-0.5 rounded-full"
                    style={{
                      background: `${accentColor}15`,
                      border: `1px solid ${accentColor}30`,
                      color: accentColor,
                    }}
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Follow button */}
          <div className="shrink-0">
            <FollowEntityButton
              kind="artist"
              entityId={artist.id}
              initialFollowing={userFollows}
              accentColor={accentColor}
            />
          </div>
        </div>

        {/* Bio */}
        {artist.bio && (
          <p className="text-[#e8e6e3] text-sm sm:text-base leading-relaxed max-w-2xl">
            {artist.bio}
          </p>
        )}

        {/* Stats row */}
        <div className="flex gap-6">
          {[
            { label: t("stats.releases"), value: stats.release_count },
            { label: t("stats.followers"), value: stats.follower_count },
            { label: t("stats.reviews"), value: stats.review_count },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <p
                className="font-[family-name:var(--font-space-grotesk)] text-xl sm:text-2xl font-bold"
                style={{ color: accentColor }}
              >
                {stat.value}
              </p>
              <p className="font-[family-name:var(--font-vt323)] text-xs text-[#5a5a60] uppercase tracking-wider">
                {stat.label}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Glowing divider */}
      <div className="mx-4 sm:mx-8">
        <div
          className="h-[1px]"
          style={{
            background: `linear-gradient(90deg, transparent 0%, ${accentColor}60 20%, ${accentColor}99 50%, ${accentColor}60 80%, transparent 100%)`,
            boxShadow: `0 0 8px ${accentColor}40`,
          }}
        />
      </div>

      {/* ========== RANKED ========== */}
      {ranked.length >= 2 && (
        <section className="px-4 sm:px-8 space-y-3" aria-labelledby="ranked-h">
          <div className="artist-ranked-head">
            <span className="artist-ranked-eyebrow">{t("rankedEyebrow")}</span>
            <h2 id="ranked-h">{t("rankedTitle", { name: artist.name })}</h2>
          </div>
          <ol className="artist-ranked">
            {ranked.map(({ release, stats: rs }, i) => (
              <li key={release.id}>
                <Link href={`/releases/${release.slug}`} className="artist-ranked-row group">
                  <span className="artist-ranked-n">{i + 1}</span>
                  {release.cover_image ? (
                    <img src={release.cover_image} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="artist-ranked-blank" />
                  )}
                  <span className="artist-ranked-text">
                    <b>{release.title}</b>
                    <small>
                      {[release.release_type === "EP" ? "EP" : release.release_type.charAt(0).toUpperCase() + release.release_type.slice(1), release.release_date?.slice(0, 4)]
                        .filter(Boolean)
                        .join(" · ")}
                    </small>
                  </span>
                  <span className="artist-ranked-score">
                    <b style={{ color: getRatingHex(rs.avg_rating!) }}>{formatRating(rs.avg_rating!)}</b>
                    <small>{t("rankedCount", { n: rs.review_count })}</small>
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* ========== UNRELEASED ==========
          Same open rows as the ranking above, no rank number, an amber
          UNRELEASED tag under the title (the amber family every
          unreleased badge on the site uses). Only when the artist has
          one — most have one or none, so no empty section. The add
          link opens search with the artist's name typed in: Genius
          results there create the page in one tap. */}
      {unreleased.length > 0 && (
        <section className="px-4 sm:px-8 space-y-3" aria-labelledby="unreleased-h">
          <div className="artist-ranked-head">
            <span className="artist-ranked-eyebrow artist-unreleased-eyebrow">{t("unreleasedEyebrow")}</span>
            <h2 id="unreleased-h">{t("unreleasedTitle", { name: artist.name })}</h2>
          </div>
          <ul className="artist-ranked">
            {unreleased.map(({ release, stats: rs }) => (
              <li key={release.id}>
                <Link href={`/releases/${release.slug}`} className="artist-ranked-row artist-unreleased-row group">
                  {release.cover_image ? (
                    <img src={release.cover_image} alt="" loading="lazy" decoding="async" />
                  ) : (
                    <span className="artist-ranked-blank" />
                  )}
                  <span className="artist-ranked-text">
                    <b>{release.title}</b>
                    <span className="artist-unreleased-tag">{t("unreleasedTag")}</span>
                  </span>
                  <span className="artist-ranked-score">
                    {rs.avg_rating !== null ? (
                      <>
                        <b style={{ color: getRatingHex(rs.avg_rating) }}>{formatRating(rs.avg_rating)}</b>
                        <small>{t("rankedCount", { n: rs.review_count })}</small>
                      </>
                    ) : (
                      <>
                        <b className="text-text-muted">—</b>
                        <small>{t("unreleasedNoRatings")}</small>
                      </>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href={`/search?q=${encodeURIComponent(artist.name)}`}
            className="inline-flex items-center gap-1.5 text-sm text-accent-glow hover:text-text-primary transition-colors"
          >
            <span aria-hidden="true">+</span>
            {t("unreleasedAdd", { name: artist.name })}
          </Link>
        </section>
      )}

      {/* ========== RELEASES ========== */}
      {/* Hidden when the artist only has unreleased songs (the section
          above already shows them — no "No releases yet" under it). */}
      {(discography.length > 0 || unreleased.length === 0) && (
      <div className="px-4 sm:px-8 space-y-4">
        <div className="flex items-center gap-3">
          <span className="label-xbox">{t("releases")}</span>
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[#e8e6e3]">
            {t("discography")}
          </h2>
          <div
            className="flex-1 h-[1px]"
            style={{
              background: `linear-gradient(90deg, ${accentColor}40, transparent)`,
            }}
          />
          <span
            className="font-[family-name:var(--font-space-grotesk)] text-xs font-bold uppercase tracking-widest px-3 py-1 rounded"
            style={{
              color: accentColor,
              background: `${accentColor}10`,
              border: `1px solid ${accentColor}30`,
            }}
          >
            {t("releaseCount", { n: discography.length })}
          </span>
        </div>

        {discography.length === 0 ? (
          <div className="panel-xbox p-8 text-center">
            <p className="font-[family-name:var(--font-vt323)] text-lg text-[#5a5a60]">
              {t("noReleases")}
            </p>
          </div>
        ) : (
          // Open tiles (2026-10-25): no card around each record, so the
          // grid can hold more per row.
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-4 gap-y-6 sm:gap-x-5">

            {discography.map(({ release, stats: rs }) => (
              <ReleaseCard
                key={release.id}
                release={release}
                reviewCount={rs.review_count}
                avgRating={rs.avg_rating}
              />
            ))}
          </div>
        )}
      </div>
      )}

      {/* ========== FOLLOWERS ========== */}
      {followers.length > 0 && (
        <div className="px-4 sm:px-8 space-y-4">
          <div className="flex items-center gap-3">
            <span className="label-xbox">{t("followers")}</span>
            <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[#e8e6e3]">
              {t("fans")}
            </h2>
            <div
              className="flex-1 h-[1px]"
              style={{
                background: `linear-gradient(90deg, ${accentColor}40, transparent)`,
              }}
            />
          </div>
          <FansGrid fans={followers} accentColor={accentColor} />
          {stats.follower_count > followers.length && (
            <p className="pixel-text text-xs text-text-muted">
              {t("more", { n: stats.follower_count - followers.length })}
            </p>
          )}
        </div>
      )}

      {/* ========== BROWSE LINK ========== */}
      <div className="px-4 sm:px-8 pb-8">
        <BackLink
          fallback="/artists"
          label={t("back")}
          className="pixel-text text-sm text-text-muted hover:text-accent-primary transition-colors"
        />
      </div>
    </div>
  );
}
