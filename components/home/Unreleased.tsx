/**
 * Unreleased — its own section on the logged-out home (Luca
 * 2026-09-02): the wedge. Leaks, loosies, unreleased tracks from the
 * Genius deep catalog, and countdown albums that exist on the platform
 * before they drop. Real unreleased records from the catalog ride
 * along as a poster row when there are any.
 *
 * LANGUAGES: server component → getTranslations("home.unreleased").
 * Record titles/artists come from the catalog and are never translated.
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listUnreleasedReleases } from "@/lib/db/releases";
import { smallCover } from "@/lib/images";
import HomeSection from "./HomeSection";
import Reveal from "./Reveal";

export default async function Unreleased() {
  const t = await getTranslations("home.unreleased");
  const records = await listUnreleasedReleases(8).catch(() => []);

  const cards = [
    { stamp: t("stamp1"), h: t("h1"), b: t("b1") },
    { stamp: t("stamp2"), h: t("h2"), b: t("b2") },
    { stamp: t("stamp3"), h: t("h3"), b: t("b3") },
  ];

  return (
    <HomeSection eyebrow={t("eyebrow")} title={t("title")} sub={t("sub")}>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
        {cards.map((c, i) => (
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
              <span className="vhs-label text-xs">{t("onPeak")}</span>
              <div className="flex-1 divider-glow" />
            </div>
            <div className="poster-grid">
              {records.map((r) => (
                <Link key={r.id} href={`/releases/${r.slug}`} className="poster group" title={`${r.title} — ${r.artist}`}>
                  {r.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={smallCover(r.cover_image)} alt={t("coverAlt", { title: r.title })} loading="lazy" decoding="async" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-3xl">📼</span>
                  )}
                  <span className="poster-unreleased">{t("badge")}</span>
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      )}
    </HomeSection>
  );
}
