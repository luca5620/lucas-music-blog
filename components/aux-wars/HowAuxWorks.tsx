/**
 * HowAuxWorks — the five-step "how a war goes" strip on the arena
 * (code review 2026-10-05: with nothing on air, a first-time visitor
 * saw NO SIGNAL and a one-person leaderboard and read the feature as
 * dead). It answers "what IS this?" in five lines and ends on the one
 * thing to do about it: host one.
 *
 * Laid out like the tracks on the back of a tape — numbered rows, a
 * VHS label each, one line of copy — rather than five boxes, so it
 * stays compact on a phone. Server-rendered (no "use client"): it's
 * static copy plus a link, like AuxCard.
 *
 * LANGUAGES: messages/<locale>.json → aux.how. "AUX WARS" itself is a
 * name and is never translated.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";

const STEPS = ["open", "topic", "song", "vote", "champ"] as const;

export default function HowAuxWorks({ offAir = false }: { offAir?: boolean }) {
  const t = useTranslations("aux.how");
  const ti = useTranslations("aux.index");

  return (
    <section
      className={`${offAir ? "panel-xbox-glow" : "panel-xbox"} p-4 sm:p-6 space-y-4 relative overflow-hidden`}
    >
      {/* OFF AIR: nothing live AND no lobby filling up. One tuner line
          on top of the steps instead of a card of its own — on a phone
          a separate card meant three Host buttons in one screen. */}
      {offAir && (
        <div className="space-y-1.5">
          <span className="osd-text text-xs">
            <span className="text-osd-amber">◌</span> {ti("offAir")}
          </span>
          <p className="crt-title text-xl sm:text-2xl leading-tight">{ti("offAirTitle")}</p>
          <p className="text-sm text-text-secondary">{ti("offAirSub")}</p>
          <div className="divider-glow !mt-4" />
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <span className="glow-orb" />
        <h2 className="label-xbox">{t("title")}</h2>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {STEPS.map((key, i) => (
          <li
            key={key}
            className="flex sm:flex-col gap-3 sm:gap-2 rounded-lg border border-border-subtle bg-black/20 p-3"
          >
            {/* The track number — big VT323 numerals, like a deck's
                counter. */}
            <span className="font-[family-name:var(--font-vt323)] text-3xl leading-none text-accent-glow tabular-nums shrink-0 w-9 sm:w-auto">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="min-w-0 space-y-1">
              <span className="block vhs-label text-xs">{t(`${key}Label`)}</span>
              <span className="block text-xs text-text-secondary leading-relaxed">{t(`${key}Body`)}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <Link href="/aux-wars/new" className="btn-y2k btn-y2k-primary">
          {t("cta")}
        </Link>
        <span className="text-xs text-text-muted">{t("ctaHint")}</span>
      </div>
      <div className="scan-bar" />
    </section>
  );
}
