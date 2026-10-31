/**
 * SpotlightPulse — the album page's score section while the record is
 * the Community Spotlight. It stands in for the usual "community
 * average + spread" block (release-pulse), between the same hairlines.
 *
 * Before you rate: no score at all — just how many members rated it
 * this week and the two things to do (rate it / join the room). The
 * members' score stays a ?.? on the record label until you've added
 * yours (Luca 2026-10-30 picked the reveal).
 *
 * After you rate: how far you are from the members, then the usual
 * spread of scores with a ▼ over the bar your score falls in.
 *
 * "Join the room" is a plain #room link: on phones ReleaseRoomChat
 * opens its sheet when the hash says #room; on desktop the chat column
 * carries id="room", so the browser scrolls to it.
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getRatingHex } from "@/lib/rating";

export default async function SpotlightPulse({
  ratings,
  members,
  you,
  ratedThisWeek,
  daysLeft,
  rateHref,
}: {
  /** Every published score of this record — drives the spread. */
  ratings: number[];
  members: number | null;
  you: number | null;
  ratedThisWeek: number;
  daysLeft: number;
  rateHref: string;
}) {
  const t = await getTranslations("spotlight");
  const left = daysLeft <= 1 ? t("lastDay") : t("daysLeft", { n: daysLeft });
  const b = (chunks: React.ReactNode) => <b className="text-text-primary">{chunks}</b>;

  // Not rated yet (or signed out): no numbers, just the invitation.
  if (you === null || members === null) {
    return (
      <div className="release-pulse space-y-4">
        <p className="text-sm text-text-secondary">
          {t.rich("hiddenLine", { n: ratedThisWeek, b })}
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Link href={rateHref} className="btn-y2k btn-y2k-primary justify-center">
            {t("rateIt")}
          </Link>
          <a href="#room" className="btn-y2k btn-y2k-outline justify-center">
            <span className="spotlight-live-dot" aria-hidden="true" />
            {t("joinRoom")}
          </a>
        </div>
        <p className="spotlight-osd text-center">{t("endsSunday", { left })}</p>
      </div>
    );
  }

  // Rated: you vs the members, then the spread with your bar marked.
  const diff = Math.round((you - members) * 10) / 10;
  const compare =
    diff === 0
      ? t.rich("compareSame", { b })
      : diff < 0
        ? t.rich("compareBelow", { d: Math.abs(diff).toFixed(1), b })
        : t.rich("compareAbove", { d: diff.toFixed(1), b });

  const bins = Array.from({ length: 11 }, () => 0);
  for (const r of ratings) bins[Math.min(10, Math.max(0, Math.round(r)))]++;
  const max = Math.max(...bins, 1);
  const yourBin = Math.min(10, Math.max(0, Math.round(you)));

  return (
    <div className="release-pulse space-y-4">
      <p className="text-sm text-text-secondary">
        {compare} · {t("ratedThisWeek", { n: ratedThisWeek })}
      </p>
      <div className="space-y-1">
        {/* The ▼ row sits on the same 11-column grid as the bars. */}
        <div className="flex gap-[3px] h-3.5 items-end" aria-hidden="true">
          {bins.map((_, score) => (
            <span key={score} className="flex-1 text-center text-[10px] leading-none text-accent-glow">
              {score === yourBin ? "▼" : ""}
            </span>
          ))}
        </div>
        <div className="flex items-end gap-[3px] h-14">
          {bins.map((count, score) => (
            <div
              key={score}
              title={t("histogramBar", { score, n: count })}
              className={`flex-1 rounded-t-sm${score === yourBin ? " spotlight-your-bar" : ""}`}
              style={
                count === 0
                  ? { height: "3px", background: "rgba(255,255,255,0.08)" }
                  : {
                      height: `${Math.max(10, (count / max) * 100)}%`,
                      background: getRatingHex(score),
                      opacity: 0.9,
                    }
              }
            />
          ))}
        </div>
        <div className="flex justify-between">
          <span className="pixel-text text-[0.65rem] text-text-muted">0</span>
          <span className="pixel-text text-[0.65rem] text-text-muted uppercase tracking-widest">
            {t("spreadLabel")}
          </span>
          <span className="pixel-text text-[0.65rem] text-text-muted">10</span>
        </div>
      </div>
      <a href="#room" className="btn-y2k btn-y2k-primary w-full justify-center">
        <span className="spotlight-live-dot" aria-hidden="true" />
        {t("joinRoom")}
      </a>
      <p className="spotlight-osd text-center">{t("endsSunday", { left })}</p>
    </div>
  );
}
