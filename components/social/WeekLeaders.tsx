/**
 * WeekLeaders — "your people, this week" on /social (Luca 2026-09-16:
 * "an area with top 3 of your friends for the week of aux war wins,
 * reviews, and likes").
 *
 * Three small podiums side by side: Aux Wars won, reviews written,
 * likes received. The circle is the viewer plus everyone they follow,
 * and the week is the same Friday reset the Top Reviews chart above
 * already uses — see migration 049 for why that boundary is passed in
 * rather than decided in SQL.
 *
 * A metric with nobody on it keeps its column and says so, instead of
 * collapsing the row to two: a board that changes shape week to week
 * is harder to read at a glance than one with a quiet column in it.
 * The whole section only disappears when all three are empty.
 *
 * Server component — no state, no effects. Visual language is the Aux
 * Wars leaderboard's (VT323 rank numerals, amber/white/rose podium,
 * odd-row wash) so the two boards read as siblings.
 */

import { useTranslations } from "next-intl";
import UserLink from "@/components/ui/UserLink";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import { TrophyGlyph, HeartGlyph } from "@/components/profile/BadgeGlyphs";
import type { WeekLeader, WeekLeaders as Leaders, WeekMetric } from "@/lib/db/social";

/** Podium colours, matching components/aux-wars/Leaderboard.tsx. */
function rankClass(i: number): string {
  if (i === 0) return "text-osd-amber";
  if (i === 1) return "text-text-primary";
  if (i === 2) return "text-accent-rose";
  return "text-text-muted";
}

function safeAvatar(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

function Column({
  metric,
  rows,
  title,
  empty,
  glyph,
  unit,
}: {
  metric: WeekMetric;
  rows: WeekLeader[];
  title: string;
  empty: string;
  glyph: React.ReactNode;
  unit: (n: number) => string;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <div className="flex items-center gap-1.5">
        <span className="text-accent-primary shrink-0">{glyph}</span>
        <h3 className="label-xbox text-[0.6rem] truncate">{title}</h3>
      </div>

      {rows.length === 0 ? (
        <p className="text-[11px] text-text-muted leading-snug">{empty}</p>
      ) : (
        <ol className="space-y-1">
          {rows.map((row, i) => {
            const avatar = safeAvatar(row.avatar_url);
            const name = row.display_name || row.username;
            return (
              <li
                key={`${metric}-${row.user_id}`}
                className="flex items-center gap-2 rounded-md px-1.5 py-1 odd:bg-black/20"
              >
                <span
                  className={`font-[family-name:var(--font-vt323)] text-base tabular-nums w-4 text-center shrink-0 ${rankClass(i)}`}
                >
                  {i + 1}
                </span>
                <UserLink
                  username={row.username}
                  className="flex items-center gap-1.5 min-w-0 flex-1 group/leader"
                >
                  {avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatar}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="w-5 h-5 rounded-full object-cover border border-white/10 shrink-0"
                    />
                  ) : (
                    <span className="w-5 h-5 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-[9px] font-bold text-accent-primary uppercase shrink-0">
                      {(row.username || "U")[0]}
                    </span>
                  )}
                  <span className="min-w-0 truncate text-xs text-text-secondary group-hover/leader:text-accent-primary transition-colors">
                    {name}
                  </span>
                  {row.role !== "user" && <VerifiedBadge role={row.role} size="xs" />}
                </UserLink>
                <span className="pixel-text text-[10px] tabular-nums text-text-primary shrink-0">
                  {unit(row.score)}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export default function WeekLeaders({ leaders }: { leaders: Leaders }) {
  const t = useTranslations("social.week");

  const total =
    leaders.aux.length + leaders.reviews.length + leaders.likes.length;
  // Nobody in the whole circle did anything this week — say nothing at
  // all rather than show three empty columns.
  if (total === 0) return null;

  return (
    <section className="panel-xbox p-4 sm:p-5 space-y-3 relative overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="glow-orb shrink-0" />
        <h2 className="label-xbox">{t("title")}</h2>
        <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted ml-auto">
          {t("resetsFriday")}
        </span>
      </div>
      <div className="divider-glow" />

      {/* Stacked on a phone, three across from sm up. Three columns on
          a 375px screen leaves about 40px for a name once the avatar
          and the number have taken their share, which is not a name. */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <Column
          metric="aux"
          rows={leaders.aux}
          title={t("aux")}
          empty={t("auxEmpty")}
          glyph={<TrophyGlyph className="w-3.5 h-3.5" />}
          unit={(n) => `${n}`}
        />
        <Column
          metric="reviews"
          rows={leaders.reviews}
          title={t("reviews")}
          empty={t("reviewsEmpty")}
          glyph={<span className="text-[13px] leading-none">✍</span>}
          unit={(n) => `${n}`}
        />
        <Column
          metric="likes"
          rows={leaders.likes}
          title={t("likes")}
          empty={t("likesEmpty")}
          glyph={<HeartGlyph className="w-3.5 h-3.5" />}
          unit={(n) => `${n}`}
        />
      </div>

      <div className="scan-bar" />
    </section>
  );
}
