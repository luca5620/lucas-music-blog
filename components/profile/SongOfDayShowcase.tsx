/**
 * SongOfDayShowcase — the "SONG OF THE DAY" profile block.
 *
 * Shows the user's current pick with cover + link, the glowing
 * flame streak counter, and (for the owner) the picker to set or
 * change today's song. Server component: pick + streak are fetched
 * during the profile render.
 */

import { getLatestSotd, getSotdStreak, isTodayUtc } from "@/lib/db/sotd";
import StreakFlame from "@/components/profile/StreakFlame";
import SotdPicker from "@/components/profile/SotdPicker";

interface Props {
  userId: string;
  isOwner: boolean;
}

function dayLabel(pickedOn: string): string {
  if (isTodayUtc(pickedOn)) return "Today";
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  if (pickedOn === yesterday) return "Yesterday";
  try {
    return new Date(pickedOn + "T00:00:00Z").toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return pickedOn;
  }
}

export default async function SongOfDayShowcase({ userId, isOwner }: Props) {
  // The table only exists after migration 009 — fail soft until then.
  const [latest, streak] = await Promise.all([
    getLatestSotd(userId).catch(() => null),
    getSotdStreak(userId).catch(() => 0),
  ]);

  // Nothing ever picked and it's not your profile: skip the section.
  if (!latest && !isOwner) return null;

  const hasToday = !!latest && isTodayUtc(latest.picked_on);

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="vhs-label inline-block text-sm">SONG OF THE DAY</div>
        <StreakFlame streak={streak} size="md" />
      </div>

      <div className="panel-xbox overflow-visible p-5 space-y-4">
        {latest ? (
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-lg overflow-hidden bg-bg-elevated border border-border-subtle shrink-0">
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
              <p className="pixel-text text-xs uppercase tracking-widest mb-0.5 text-text-muted">
                {dayLabel(latest.picked_on)}
                {!hasToday && isOwner && (
                  <span className="text-osd-amber"> · streak at risk!</span>
                )}
              </p>
              {latest.track_url ? (
                <a
                  href={latest.track_url}
                  target={latest.track_url.startsWith("/") ? undefined : "_blank"}
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
          <p className="text-sm text-text-secondary">
            Pick your first song of the day — a new one every day keeps the
            flame lit. 🔥
          </p>
        )}

        {isOwner && <SotdPicker hasToday={hasToday} />}
      </div>
    </section>
  );
}
