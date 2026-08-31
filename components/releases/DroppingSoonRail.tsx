/**
 * DroppingSoonRail — the "albums about to drop" shelf on /releases.
 *
 * Server component. Shows every catalog release with a FUTURE
 * release_date (the countdown albums people added by pasting a
 * Spotify link into catalog search), soonest first, as a horizontal
 * scroll of covers with a big day-countdown stamp. Each card links
 * to the release page, where the live room is already open — the
 * whole point is that the chatroom exists BEFORE the album does.
 *
 * Renders nothing when no upcoming releases exist, so the /releases
 * page looks exactly like before until someone adds one.
 */

import Link from "next/link";
import { listUpcomingReleases } from "@/lib/db/releases";
import { formatDropDate } from "@/lib/upcoming";
import { smallCover } from "@/lib/images";
import LiveCountdown from "@/components/releases/LiveCountdown";

export default async function DroppingSoonRail() {
  const upcoming = await listUpcomingReleases(12);
  if (upcoming.length === 0) return null;

  return (
    <section className="panel-xbox p-4 sm:p-5 space-y-4 relative overflow-hidden border-osd-amber/30">
      {/* Header — OSD-style, amber like the UNRELEASED badge family */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox text-osd-amber">Dropping Soon</span>
        </div>
        <span className="pixel-text text-[10px] text-text-muted uppercase tracking-widest">
          The room opens before the album does
        </span>
      </div>

      {/* Horizontal shelf of countdown covers */}
      <div className="flex gap-4 overflow-x-auto pb-2 -mx-1 px-1">
        {upcoming.map((release) => {
          const dropDate = formatDropDate(release.release_date);
          return (
            <Link
              key={release.id}
              href={`/releases/${release.slug}`}
              className="release-art group shrink-0 w-36 sm:w-44 space-y-2"
            >
              <div className="relative aspect-square rounded-lg overflow-hidden border border-osd-amber/30 group-hover:border-osd-amber/70 transition-colors bg-bg-elevated">
                {release.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={smallCover(release.cover_image)}
                    alt={`${release.title} cover`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-4xl text-text-muted">
                    {"//"}
                  </span>
                )}
                {/* Big countdown stamp — live-ticking, the decorative
                    gesture IS the info */}
                {release.release_date && (
                  <span className="absolute bottom-2 left-2 pixel-text text-[11px] text-osd-amber bg-black/80 border border-osd-amber/50 rounded px-1.5 py-0.5 tracking-widest">
                    <LiveCountdown releaseDate={release.release_date} />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-text-primary truncate group-hover:text-osd-amber transition-colors">
                  {release.title}
                </p>
                <p className="text-xs text-text-secondary truncate">
                  {release.artists?.name ?? ""}
                  {dropDate ? ` · ${dropDate}` : ""}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="scan-bar" />
    </section>
  );
}
