/**
 * SpotlightShelf — the Community Spotlight on the logged-in home page
 * (Luca 2026-10-30 picked look A, "the sleeve"): the week's album as a
 * big sleeve with its record sliding out behind it, the title, Luca's
 * one line on why, who's rated it so far, and two ways in.
 *
 * Sits right under the HOME band (and the Rewind card in season),
 * above ON AIR. Renders nothing between weeks, so the home page just
 * closes up. Server component — the page already fetched everything.
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { smallCover } from "@/lib/images";
import type { CurrentSpotlight } from "@/lib/db/spotlight";

export default async function SpotlightShelf({
  spotlight,
  daysLeft,
  viewerRated,
}: {
  spotlight: CurrentSpotlight;
  daysLeft: number;
  /** Already rated it → the main button becomes "See how you compare". */
  viewerRated: boolean;
}) {
  const t = await getTranslations("spotlight");
  const { release } = spotlight;
  const href = `/releases/${release.slug}`;
  const year = release.release_date?.slice(0, 4);
  const meta = [
    release.artistName,
    year,
    release.trackCount > 1 ? t("songs", { n: release.trackCount }) : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const b = (chunks: React.ReactNode) => <b className="text-text-primary">{chunks}</b>;

  return (
    <section className="space-y-5" aria-labelledby="spotlight-heading">
      {/* Header row — same shape as ON AIR, in the spotlight's orange. */}
      <div className="flex items-center gap-3">
        <span className="spotlight-orb" aria-hidden="true" />
        <h2 id="spotlight-heading" className="vhs-label text-sm">
          {t("label", { n: spotlight.weekNumber })}
        </h2>
        <div className="flex-1 spotlight-divider" />
        <span className="spotlight-osd">
          {daysLeft <= 1 ? t("lastDay") : t("daysLeft", { n: daysLeft })}
        </span>
      </div>

      {/* The sleeve: cover in front, the record slid out behind it.
          The record's centre label is the cover art itself. */}
      <Link href={href} className="spotlight-home-sleeve" aria-label={t("openAlbum", { title: release.title })}>
        <span className="spotlight-home-disc" aria-hidden="true">
          {release.cover_image && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={smallCover(release.cover_image)} alt="" />
          )}
        </span>
        <span className="spotlight-home-jacket">
          {release.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={release.cover_image} alt="" />
          ) : (
            <span className="review-sleeve-blank">💿</span>
          )}
        </span>
      </Link>

      <div className="space-y-1 text-center">
        <h3 className="crt-title text-3xl">
          <Link href={href}>{release.title}</Link>
        </h3>
        {meta && <p className="text-sm text-text-secondary">{meta}</p>}
        {spotlight.note && (
          <p className="text-sm text-text-primary/85 italic pt-1.5 max-w-md mx-auto">
            “{spotlight.note}”
          </p>
        )}
      </div>

      {/* Who's in so far — up to four faces + the count. */}
      <div className="flex items-center justify-center gap-2.5">
        {spotlight.recentRaters.length > 0 && (
          <span className="flex" aria-hidden="true">
            {spotlight.recentRaters.map((p, i) => (
              <span key={p.username} className="spotlight-face" style={{ marginLeft: i ? -8 : 0 }}>
                {p.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.avatar_url} alt="" loading="lazy" />
                ) : (
                  (p.display_name ?? p.username).slice(0, 1).toUpperCase()
                )}
              </span>
            ))}
          </span>
        )}
        <span className="text-sm text-text-secondary">
          {t.rich("ratedHome", { n: spotlight.ratedThisWeek, b })}
        </span>
      </div>

      <div className="flex flex-wrap gap-3 justify-center">
        <Link
          href={viewerRated ? href : `/reviews/new?release_id=${release.id}`}
          className="btn-y2k btn-y2k-primary"
        >
          {viewerRated ? t("seeCompare") : t("rateIt")}
        </Link>
        <Link href={`${href}#room`} className="btn-y2k btn-y2k-outline">
          <span className="spotlight-live-dot" aria-hidden="true" />
          {t("joinRoom")}
        </Link>
      </div>
    </section>
  );
}
