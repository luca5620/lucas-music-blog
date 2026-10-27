"use client";

/**
 * DropBanner — the big OSD-amber "⏳ DROPS IN 02:14:09" strip on top
 * of an upcoming release page.
 *
 * It used to be drawn on the server, which meant it froze whatever the
 * drop-check said at load time: "Out later today" never went away
 * without a refresh, and a clock left running across midnight said
 * OUT NOW for a record that wasn't on Spotify yet. Now it watches the
 * drop facts live (lib/useLiveDrop) and, the moment the record is
 * really out, refreshes the page's server parts once — the banner
 * disappears, "Drops" turns into "Released", rating opens up — no
 * reload needed (fixed 2026-10-27).
 */

import { useTranslations } from "next-intl";
import LiveCountdown from "@/components/releases/LiveCountdown";
import { useLiveDrop } from "@/lib/useLiveDrop";
import { isUpcoming, isWaitingForDrop, type DropInfo } from "@/lib/upcoming";

export default function DropBanner({
  releaseId,
  releaseDate,
  drop: dropFromPage,
  dateLabel,
}: {
  releaseId: string;
  /** YYYY-MM-DD release date. */
  releaseDate: string;
  /** The row's drop facts when the page loaded (migration 064). */
  drop: DropInfo;
  /** "Oct 31, 2026" — already formatted by the page, or null. */
  dateLabel: string | null;
}) {
  const t = useTranslations("releases.page");
  // refreshOnDrop: when it's really out, let the server re-draw the
  // page (this banner is the only thing on the page that does that).
  const drop = useLiveDrop(releaseId, releaseDate, dropFromPage, { refreshOnDrop: true });

  // Out (the server refresh is on its way) → nothing to announce.
  if (!isUpcoming(releaseDate, drop)) return null;

  // Past midnight Eastern, not out yet, and NO exact time to count
  // down to → "Out later today" instead of a clock stuck on zero. With
  // Spotify's exact time (drops_at) the banner just keeps ticking.
  const waitingForDrop = !drop?.drops_at && isWaitingForDrop(releaseDate, drop);

  return (
    <div className="mb-5 sm:mb-6 border border-osd-amber/50 rounded-lg bg-osd-amber/5 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
      {waitingForDrop ? (
        <span className="pixel-text text-xs sm:text-sm text-osd-amber uppercase tracking-widest animate-pulse">
          {t("dropsLater")}
        </span>
      ) : (
        <span className="pixel-text text-xs sm:text-sm text-osd-amber uppercase tracking-widest">
          {t("dropsIn")}{" "}
          {/* No releaseId here: this banner already watches the drop
              and hands the fresh facts down. */}
          <LiveCountdown releaseDate={releaseDate} drop={drop} className="animate-pulse" />
          {dateLabel ? ` — ${dateLabel}` : ""}
        </span>
      )}
    </div>
  );
}
