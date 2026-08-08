/**
 * FourFavorites — the Letterboxd-style "four favorites" showcase.
 *
 * Server-friendly (no hooks, no handlers): a "Favorites" label-xbox
 * header and a row of up to 4 album posters. Hovering a poster shows
 * a native tooltip with "Title — Artist" (title attribute).
 *
 * Empty slots:
 *  - owner:   dashed placeholder linking to the settings editor
 *  - visitor: hidden (and if there are no favorites at all, the whole
 *             section renders nothing)
 */

import Link from "next/link";
import type { ProfileFavorite } from "@/lib/types/database";

interface FourFavoritesProps {
  favorites: ProfileFavorite[];
  /** Owners get placeholders that link to the settings editor. */
  isOwner?: boolean;
  /** Profile accent color for the header dot. */
  accentColor?: string;
}

/** Only https:// or local /path images — anything else is dropped
 *  (same stored-XSS defense as the rest of the profile page). */
function safeCover(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

export default function FourFavorites({
  favorites,
  isOwner = false,
  accentColor = "#1e90ff",
}: FourFavoritesProps) {
  // A visitor looking at an empty showcase sees nothing at all.
  if (!isOwner && favorites.length === 0) return null;

  // Map each of the 4 slots (positions 1–4) to its favorite, if set.
  const slots: (ProfileFavorite | null)[] = [1, 2, 3, 4].map(
    (pos) => favorites.find((f) => f.position === pos) ?? null
  );

  return (
    <section className="space-y-3">
      {/* Header — matches the other profile section headers */}
      <div className="flex items-center gap-3">
        <span
          className="w-2 h-2 rounded-full"
          style={{
            background: accentColor,
            boxShadow: `0 0 8px ${accentColor}80`,
          }}
        />
        <h2 className="label-xbox">Favorites</h2>
      </div>

      {/* Four posters in a row (2x2 on tiny screens would crowd the
          tooltips, so we keep 4-up and let them shrink). */}
      <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-md">
        {slots.map((fav, i) => {
          if (fav) {
            const cover = safeCover(fav.cover_image);
            return (
              <div
                key={fav.id}
                className="poster"
                // Native tooltip: "Title — Artist"
                title={`${fav.title} — ${fav.artist}`}
              >
                {cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={cover} alt={`${fav.title} by ${fav.artist}`} />
                ) : (
                  // No cover: show the title text on the tile instead.
                  <span className="absolute inset-0 flex items-center justify-center p-1 text-center text-[0.6rem] leading-tight text-[#9a9a9e] font-[family-name:var(--font-heading)] font-bold">
                    {fav.title}
                  </span>
                )}
              </div>
            );
          }

          // Empty slot — owners get a dashed "add one" link.
          if (isOwner) {
            return (
              <Link
                key={`empty-${i}`}
                href="/settings/profile"
                title="Pick a favorite in settings"
                className="aspect-square rounded-md border-2 border-dashed border-[rgba(255,255,255,0.15)] flex items-center justify-center text-2xl text-[#5a5a60] hover:border-[rgba(255,255,255,0.35)] hover:text-[#9a9a9e] transition-colors"
              >
                +
              </Link>
            );
          }

          // Visitor + empty slot: invisible spacer keeps the grid tidy.
          return <div key={`empty-${i}`} aria-hidden />;
        })}
      </div>
    </section>
  );
}
