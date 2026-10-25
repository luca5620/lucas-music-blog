/**
 * SongOfDayShowcase — the "SONG OF THE DAY" profile showcase, as an
 * orange-tinted WIDGET since the showcases overhaul (Luca 2026-10-24,
 * round 2 "mix of B and C"; grid + shell in ShowcaseWidgets.tsx).
 *
 * The tile: the small label (with the streak count at its right end),
 * the pick's cover, title and artist · day. Visitors get a half-width
 * tile next to Ratings. The owner gets it wide, because the picker
 * (search + track list) lives inside it and needs the room.
 *
 * Visitors stop seeing it a week after the last pick — a "Sep 15" song
 * of the day on an October profile made the whole page look abandoned
 * (mockup note, 2026-10-24). The owner always sees it, picker and all.
 */

import {
  getLatestSotd,
  getSotdStreak,
  isTodayPacific,
  pacificDate,
} from "@/lib/db/sotd";
import StreakIndicator, {
  type StreakIcon,
} from "@/components/profile/StreakIndicator";
import SotdPicker from "@/components/profile/SotdPicker";
import { Widget } from "@/components/profile/ShowcaseWidgets";
import { getLocale, getTranslations } from "next-intl/server";

interface Props {
  userId: string;
  isOwner: boolean;
  streakIcon: StreakIcon;
}

/** Visitors don't see a pick older than this many days. */
const STALE_AFTER_DAYS = 7;

function dayLabel(
  pickedOn: string,
  locale: string,
  words: { today: string; yesterday: string }
): string {
  if (isTodayPacific(pickedOn)) return words.today;
  if (pickedOn === pacificDate(-1)) return words.yesterday;
  try {
    return new Date(pickedOn + "T00:00:00Z").toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return pickedOn;
  }
}

export default async function SongOfDayShowcase({
  userId,
  isOwner,
  streakIcon,
}: Props) {
  // The table only exists after migration 009 — fail soft until then.
  const [latest, streak] = await Promise.all([
    getLatestSotd(userId).catch(() => null),
    getSotdStreak(userId).catch(() => 0),
  ]);
  // LANGUAGES: messages → profile.sotd; the date reads in the viewer's locale.
  const t = await getTranslations("profile.sotd");
  const locale = await getLocale();

  // Nothing ever picked, or the last pick is over a week old: visitors
  // just don't get the tile. picked_on is a plain YYYY-MM-DD (Pacific),
  // so comparing it to the date a week back as strings is exact.
  if (!isOwner && (!latest || latest.picked_on < pacificDate(-STALE_AFTER_DAYS))) {
    return null;
  }

  const hasToday = !!latest && isTodayPacific(latest.picked_on);

  return (
    <Widget
      tint="sotd"
      wide={isOwner}
      label={t("title")}
      labelExtra={<StreakIndicator streak={streak} icon={streakIcon} size="sm" />}
    >
      {latest ? (
        <div className={isOwner ? "flex items-center gap-3" : "space-y-1.5"}>
          <span className="sc-widget-cover">
            {latest.cover_image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={latest.cover_image} alt="" />
            ) : (
              <span>💿</span>
            )}
          </span>
          <div className="min-w-0 flex-1">
            {latest.track_url ? (
              <a
                href={latest.track_url}
                target={latest.track_url.startsWith("/") ? undefined : "_blank"}
                rel="noopener noreferrer"
                className="sc-widget-title block hover:text-accent-primary transition-colors"
              >
                {latest.track_title} ↗
              </a>
            ) : (
              <p className="sc-widget-title">{latest.track_title}</p>
            )}
            <p className="sc-widget-sub">
              {latest.artist} ·{" "}
              {dayLabel(latest.picked_on, locale, {
                today: t("today"),
                yesterday: t("yesterday"),
              })}
              {!hasToday && isOwner && (
                <span className="text-osd-amber">{t("streakAtRisk")}</span>
              )}
            </p>
          </div>
        </div>
      ) : (
        <p className="sc-widget-sub sc-wrap">{t("firstPick")}</p>
      )}

      {isOwner && (
        <div className="pt-1">
          <SotdPicker hasToday={hasToday} />
        </div>
      )}
    </Widget>
  );
}
