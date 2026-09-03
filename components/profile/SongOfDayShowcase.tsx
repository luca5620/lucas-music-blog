/**
 * SongOfDayShowcase — the "SONG OF THE DAY" profile block.
 *
 * Left: the current pick (cover, track, link) + the owner's picker.
 * Right: the BIG animated streak indicator (flame/vinyl/CD — the
 * user's choice from Settings), centered vertically so the motion
 * is the eye-catcher of the module.
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
import { getLocale, getTranslations } from "next-intl/server";

interface Props {
  userId: string;
  isOwner: boolean;
  streakIcon: StreakIcon;
}

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

  // Nothing ever picked and it's not your profile: skip the section.
  if (!latest && !isOwner) return null;

  const hasToday = !!latest && isTodayPacific(latest.picked_on);

  return (
    <section className="space-y-3">
      <div className="vhs-label inline-block text-sm">{t("title")}</div>

      <div className="panel-xbox overflow-visible p-4 flex items-center gap-4">
        {/* ---- Left: the pick + owner controls ---- */}
        <div className="min-w-0 flex-1 space-y-3">
          {latest ? (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle shrink-0">
                {latest.cover_image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={latest.cover_image}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-2xl">
                    💿
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="pixel-text text-[11px] uppercase tracking-widest mb-0.5 text-text-muted">
                  {dayLabel(latest.picked_on, locale, {
                    today: t("today"),
                    yesterday: t("yesterday"),
                  })}
                  {!hasToday && isOwner && (
                    <span className="text-osd-amber">{t("streakAtRisk")}</span>
                  )}
                </p>
                {latest.track_url ? (
                  <a
                    href={latest.track_url}
                    target={
                      latest.track_url.startsWith("/") ? undefined : "_blank"
                    }
                    rel="noopener noreferrer"
                    className="font-[family-name:var(--font-heading)] font-bold text-text-primary hover:text-accent-primary transition-colors truncate block"
                  >
                    {latest.track_title} ↗
                  </a>
                ) : (
                  <p className="font-[family-name:var(--font-heading)] font-bold text-text-primary truncate">
                    {latest.track_title}
                  </p>
                )}
                <p className="text-sm text-text-secondary truncate">
                  {latest.artist}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-text-secondary">{t("firstPick")}</p>
          )}

          {isOwner && <SotdPicker hasToday={hasToday} />}
        </div>

        {/* ---- Right: the big moving streak counter ---- */}
        <StreakIndicator streak={streak} icon={streakIcon} size="lg" />
      </div>
    </section>
  );
}
