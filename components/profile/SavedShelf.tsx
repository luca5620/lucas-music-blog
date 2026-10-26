import Link from "next/link";
import { smallCover } from "@/lib/images";
import { isUpcoming, todayEastern } from "@/lib/upcoming";
import type { SavedRelease } from "@/lib/db/releases";

/**
 * SavedShelf — the profile's Saved tab (Luca 2026-10-25, "save for
 * later" from the UX list). A plain cover grid: records saved and not
 * rated yet. Still-coming ones carry their drop date ("Drops Nov 7"),
 * the ones out today say so; everything else is just the cover, title
 * and artist. The list arrives already sorted (getSavedReleases).
 *
 * Labels come in from the page (it already has the translator), so
 * this stays a plain server component.
 */
export default function SavedShelf({
  items,
  locale,
  labels,
}: {
  items: SavedRelease[];
  locale: string;
  labels: { drops: (date: string) => string; outToday: string };
}) {
  const today = todayEastern();
  return (
    <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-x-3 gap-y-5">
      {items.map((r) => {
        const day = r.release_date?.slice(0, 10) ?? null;
        const coming = isUpcoming(day);
        const outToday = !coming && day === today;
        const dropDate =
          coming && day
            ? new Date(`${day}T00:00:00Z`).toLocaleDateString(locale, {
                month: "short",
                day: "numeric",
                timeZone: "UTC",
              })
            : null;
        return (
          <li key={r.id} className="min-w-0">
            <Link href={`/releases/${r.slug}`} className="group block space-y-1.5">
              <div className="relative aspect-square overflow-hidden rounded-md bg-black/40 ring-1 ring-white/10">
                {r.cover_image && (
                  // eslint-disable-next-line @next/next/no-img-element -- covers come from Spotify/Genius CDNs, same as every other cover on the site
                  <img
                    src={smallCover(r.cover_image)}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                )}
                {(dropDate || outToday) && (
                  <span className="absolute left-1.5 bottom-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[0.62rem] font-semibold text-white backdrop-blur-sm">
                    {dropDate ? labels.drops(dropDate) : labels.outToday}
                  </span>
                )}
              </div>
              <p className="text-xs font-semibold text-text-primary line-clamp-1">{r.title}</p>
              {r.artistName && (
                <p className="text-[0.7rem] text-text-muted line-clamp-1 -mt-1">{r.artistName}</p>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
