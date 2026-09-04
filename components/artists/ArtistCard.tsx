/**
 * ArtistCard — Compact card for artist grid listings.
 * Whole card wraps a Link. Image is a circular avatar (or initial fallback).
 * Genre chips below, optional follower count badge.
 * Server component.
 */

import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import type { Artist } from "@/lib/types/database";

interface ArtistCardProps {
  artist: Artist;
  followerCount?: number;
}

export default function ArtistCard({ artist, followerCount }: ArtistCardProps) {
  const t = useTranslations("artists.card");
  const initial = artist.name[0]?.toUpperCase() ?? "?";
  const genres = artist.genres?.slice(0, 3) ?? [];

  return (
    <Link
      href={`/artists/${artist.slug}`}
      className="panel-xbox p-4 sm:p-5 group cursor-pointer hover-glow relative overflow-hidden flex flex-col items-center text-center space-y-3"
    >
      {/* Circular avatar */}
      <div className="aspect-square w-full rounded-full overflow-hidden border border-[rgba(30,144,255,0.2)] bg-[rgba(30,144,255,0.05)] flex items-center justify-center group-hover:border-accent-primary/50 transition-all">
        {artist.image_url ? (
          <img
            src={artist.image_url}
            alt={artist.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
          />
        ) : (
          <span
            className="font-[family-name:var(--font-space-grotesk)] text-5xl font-extrabold text-accent-primary group-hover:scale-110 transition-transform"
            aria-hidden="true"
          >
            {initial}
          </span>
        )}
      </div>

      {/* Name */}
      <div className="space-y-2 w-full">
        <h3 className="font-[family-name:var(--font-space-grotesk)] text-lg font-bold text-text-primary group-hover:text-accent-primary transition-colors truncate">
          {artist.name}
        </h3>

        {/* Genre chips */}
        {genres.length > 0 && (
          <div className="flex flex-wrap gap-1 justify-center">
            {genres.map((genre) => (
              <span
                key={genre}
                className="pixel-text text-[0.65rem] uppercase tracking-wider px-2 py-0.5 rounded border border-[rgba(30,144,255,0.25)] bg-[rgba(30,144,255,0.08)] text-accent-glow"
              >
                {genre}
              </span>
            ))}
          </div>
        )}

        {/* Follower count */}
        {typeof followerCount === "number" && (
          <p className="pixel-text text-xs text-text-muted">
            {t("followers", { n: followerCount })}
          </p>
        )}
      </div>

      <div className="scan-bar" />
    </Link>
  );
}
