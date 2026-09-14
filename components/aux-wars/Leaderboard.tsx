"use client";

/**
 * Leaderboard — the top ten on Aux Wars (Luca 2026-09-14: "there
 * should also be a leaderboard for the top 10 players on Aux Wars
 * and filter it for all time wins and weekly wins").
 *
 * Both lists are fetched on the server and handed in, so the filter is
 * an instant swap with no spinner and no second round trip — there are
 * only ever twenty rows.
 *
 * Wins a host handed themselves (playing AND judging their own room)
 * are already excluded by the aux_leaderboard function in migration
 * 044, so the board can't be farmed by hosting a room alone.
 */

import { useState } from "react";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { hapticTap } from "@/lib/native";
import PlayerChip from "@/components/aux-wars/PlayerChip";
import type { AuxLeaderRow } from "@/lib/db/aux-wars";

type Period = "all" | "week";

export default function Leaderboard({
  allTime,
  weekly,
}: {
  allTime: AuxLeaderRow[];
  weekly: AuxLeaderRow[];
}) {
  const t = useTranslations("aux.leaderboard");
  const [period, setPeriod] = useState<Period>("all");
  const rows = period === "all" ? allTime : weekly;

  // Nothing won anywhere yet — no point showing an empty podium.
  if (allTime.length === 0 && weekly.length === 0) return null;

  return (
    <section className="panel-xbox p-4 sm:p-5 space-y-3 relative overflow-hidden">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="glow-orb" style={{ animationDelay: "0.3s" }} />
        <h2 className="label-xbox">{t("title")}</h2>
        <div
          role="tablist"
          className="ml-auto flex rounded-full border border-border-medium bg-bg-elevated p-1 gap-1"
        >
          {(["all", "week"] as const).map((p) => {
            const active = period === p;
            return (
              <button
                key={p}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  hapticTap();
                  setPeriod(p);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase whitespace-nowrap transition-all font-[family-name:var(--font-heading)] ${
                  active
                    ? "bg-accent-primary/15 text-accent-primary border border-accent-primary/30"
                    : "text-text-secondary border border-transparent hover:text-text-primary"
                }`}
              >
                {t(p === "all" ? "allTime" : "weekly")}
              </button>
            );
          })}
        </div>
      </div>

      <div className="divider-glow" />

      {rows.length === 0 ? (
        <p className="text-sm text-text-muted py-2">{t("emptyWeek")}</p>
      ) : (
        <ol className="space-y-1.5">
          {rows.map((row, i) => (
            <li
              key={row.profile.id}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 odd:bg-black/20"
            >
              {/* The rank. Gold/silver/bronze for the podium, plain
                  numerals after that — the CRT look does the rest. */}
              <span
                className={`font-[family-name:var(--font-vt323)] text-xl tabular-nums w-7 text-center shrink-0 ${
                  i === 0
                    ? "text-osd-amber"
                    : i === 1
                      ? "text-text-primary"
                      : i === 2
                        ? "text-accent-rose"
                        : "text-text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <PlayerChip profile={row.profile} size="sm" />
              </span>
              <span className="text-right shrink-0 leading-tight">
                <span className="block pixel-text text-xs text-osd-amber tabular-nums">
                  🏆 {row.battles}
                </span>
                <span className="block text-[10px] text-text-muted tabular-nums">
                  {t("rounds", { n: row.rounds })}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}

      <p className="text-[11px] text-text-muted">{t("fairPlay")}</p>
      <div className="scan-bar" />
    </section>
  );
}
