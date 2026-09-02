/**
 * Unreleased — its own section on the logged-out home (Luca
 * 2026-09-02): the wedge. Leaks, loosies, unreleased tracks from the
 * Genius deep catalog, and countdown albums that exist on the platform
 * before they drop. Real unreleased records from the catalog ride
 * along as a poster row when there are any.
 */

import Link from "next/link";
import { listUnreleasedReleases } from "@/lib/db/releases";
import { smallCover } from "@/lib/images";
import HomeSection from "./HomeSection";
import Reveal from "./Reveal";

export default async function Unreleased() {
  const records = await listUnreleasedReleases(8).catch(() => []);

  return (
    <HomeSection
      eyebrow="Unreleased · leaks · loosies"
      title="If it exists, you can rate it."
      sub="Spotify's catalog is the floor, not the ceiling. The Genius deep catalog brings the leaks and the loosies; a pasted Spotify link brings an album onto the platform before it's out, countdown included."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {[
          {
            stamp: "UNRELEASED",
            h: "Rate the leak",
            b: "Genius tracks the songs that never got a release. On Peak they get a page, a rating, and a room like anything else.",
          },
          {
            stamp: "COUNTDOWN",
            h: "Before it drops",
            b: "Paste the Spotify link of an announced album. It lands here with a countdown to midnight Eastern and a room waiting.",
          },
          {
            stamp: "BY HAND",
            h: "Not on Spotify at all?",
            b: "Bandcamp-only, private press, regional catalog — email us the link and it gets added by hand so you can review it.",
          },
        ].map((c, i) => (
          <Reveal key={c.h} delay={i * 110}>
            <div className="panel-xbox p-5 sm:p-6 h-full flex flex-col gap-3 hover-glow relative overflow-hidden">
              <span className="pixel-text text-[10px] text-osd-amber border border-osd-amber/40 rounded px-1.5 py-0.5 self-start">
                {c.stamp}
              </span>
              <span className="vhs-label text-sm">{c.h}</span>
              <p className="text-sm text-text-secondary leading-relaxed">{c.b}</p>
              <div className="scan-bar" style={{ animationDelay: `${i * 0.6}s` }} />
            </div>
          </Reveal>
        ))}
      </div>

      {records.length > 0 && (
        <Reveal>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="glow-orb" />
              <span className="vhs-label text-xs">Unreleased on Peak right now</span>
              <div className="flex-1 divider-glow" />
            </div>
            <div className="poster-grid">
              {records.map((r) => (
                <Link key={r.id} href={`/releases/${r.slug}`} className="poster group" title={`${r.title} — ${r.artist}`}>
                  {r.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={smallCover(r.cover_image)} alt={`${r.title} cover`} loading="lazy" decoding="async" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-3xl">📼</span>
                  )}
                  <span className="poster-unreleased">Unreleased</span>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </HomeSection>
  );
}
