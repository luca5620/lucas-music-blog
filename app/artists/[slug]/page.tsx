/**
 * Public Artist Detail Page — Y2K hero / banner / sections layout.
 * Mirrors the profile page visual structure: blurred cover banner,
 * circular avatar header, bio, stats, releases grid, fans grid.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getArtistBySlug,
  getArtistFollowers,
  getArtistReleases,
  getArtistStats,
  isFollowingArtist,
} from "@/lib/db/artists";
import { getReleaseStats } from "@/lib/db/releases";
import { getUser } from "@/lib/auth";
import FollowEntityButton from "@/components/follow/FollowEntityButton";
import ReleaseCard from "@/components/releases/ReleaseCard";
import FansGrid from "@/components/artists/FansGrid";
import type { Release } from "@/lib/types/database";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);

  if (!artist) {
    return { title: "Artist Not Found" };
  }

  return {
    title: artist.name,
    description:
      artist.bio ??
      `${artist.name} on Peak Music Reviews — releases, reviews, and followers.`,
    alternates: {
      canonical: `https://peakmusicreviews.com/artists/${slug}`,
    },
  };
}

export default async function ArtistPage({ params }: PageProps) {
  const { slug } = await params;
  const artist = await getArtistBySlug(slug);

  if (!artist) {
    notFound();
  }

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
      // 2rem/1.75rem sm+) — same overflow fix as the profile page.
      className="space-y-6 -mx-4 -mt-4 -mb-8 sm:-mx-8 sm:-mt-7"
      style={
        {
          "--profile-accent": accentColor,
          "--profile-glow": `${accentColor}40`,
          "--profile-glow-strong": `${accentColor}80`,
        } as React.CSSProperties
      }
    >
      {/* ========== BANNER ========== */}
      <div className="relative h-48 sm:h-64 w-full overflow-hidden">
        <div className="absolute inset-0" style={bannerStyle} />
        {/* Gradient fade to page bg */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0c]" />

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
            { label: "Releases", value: stats.release_count },
            { label: "Followers", value: stats.follower_count },
            { label: "Reviews", value: stats.review_count },
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

      {/* ========== RELEASES ========== */}
      <div className="px-4 sm:px-8 space-y-4">
        <div className="flex items-center gap-3">
          <span className="label-xbox">Releases</span>
          <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[#e8e6e3]">
            Discography
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
            {releases.length} {releases.length === 1 ? "Release" : "Releases"}
          </span>
        </div>

        {releaseStats.length === 0 ? (
          <div className="panel-xbox p-8 text-center">
            <p className="font-[family-name:var(--font-vt323)] text-lg text-[#5a5a60]">
              No releases yet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {releaseStats.map(({ release, stats: rs }) => (
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

      {/* ========== FOLLOWERS ========== */}
      {followers.length > 0 && (
        <div className="px-4 sm:px-8 space-y-4">
          <div className="flex items-center gap-3">
            <span className="label-xbox">Followers</span>
            <h2 className="font-[family-name:var(--font-space-grotesk)] text-xl font-bold text-[#e8e6e3]">
              Fans
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
              + {stats.follower_count - followers.length} more
            </p>
          )}
        </div>
      )}

      {/* ========== BROWSE LINK ========== */}
      <div className="px-4 sm:px-8 pb-8">
        <Link
          href="/artists"
          className="pixel-text text-sm text-text-muted hover:text-accent-primary transition-colors"
        >
          ← Back to Artists
        </Link>
      </div>
    </div>
  );
}
