/**
 * UpcomingDrops — home page "DROPPING SOON" module.
 *
 * Sits right below the community feed: every catalog release whose
 * date is still ahead, soonest first, each cover wearing a LIVE
 * ticking countdown (LiveCountdown, DD HH:MM:SS to midnight UTC of
 * release day). Below the shelf, UpcomingDropBox — paste an upcoming
 * album's Spotify link and its page + live room open on the spot.
 *
 * The shelf hides when empty, but the paste box always renders —
 * it's how the first upcoming album gets here.
 */

import Link from "next/link";
import { listUpcomingReleases } from "@/lib/db/releases";
import { formatDropDate } from "@/lib/upcoming";
import { smallCover } from "@/lib/images";
import LiveCountdown from "@/components/releases/LiveCountdown";
import UpcomingDropBox from "@/components/home/UpcomingDropBox";

export default async function UpcomingDrops() {
  const upcoming = await listUpcomingReleases(8);

  return (
    <section className="space-y-4">
      {/* Section header — same broadcast style as ON AIR */}
      <div className="flex items-center gap-3">
        <span className="glow-orb" />
        <span className="vhs-label text-sm">DROPPING SOON</span>
        <div className="flex-1 divider-glow" />
      </div>

      {/* Countdown shelf */}
      {upcoming.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {upcoming.map((release) => (
            <Link
              key={release.id}
              href={`/releases/${release.slug}`}
              className="group space-y-1.5"
              title={`${release.title} — ${release.artists?.name ?? ""}`}
            >
              <span className="poster">
                {release.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={smallCover(release.cover_image)}
                    alt={`${release.title} cover`}
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-4xl">
                    💿
                  </span>
                )}
                {/* The ticking clock IS the badge */}
                <span className="absolute bottom-1.5 left-1.5 pixel-text text-[11px] text-osd-amber bg-black/80 border border-osd-amber/50 rounded px-1.5 py-0.5 tracking-widest">
                  <LiveCountdown releaseDate={release.release_date ?? ""} />
                </span>
              </span>
              <span className="block">
                <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)] group-hover:text-osd-amber transition-colors">
                  {release.title}
                </span>
                <span className="block text-xs text-text-secondary truncate">
                  {release.artists?.name ?? ""}
                  {release.release_date
                    ? ` · ${formatDropDate(release.release_date)}`
                    : ""}
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}

      {/* The add slot — Spotify album links only, future drops only */}
      <div className="panel-xbox p-4 sm:p-5 space-y-3 border-osd-amber/30">
        <p className="text-xs text-text-secondary">
          Know an album that&apos;s coming? Paste its Spotify link and the
          countdown page + live room open before the album does.
        </p>
        <UpcomingDropBox />
      </div>
    </section>
  );
}
