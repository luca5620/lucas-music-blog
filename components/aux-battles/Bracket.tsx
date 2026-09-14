"use client";

/**
 * Bracket — the tournament tree, one column per round, one card per
 * match. The live match pulses, done matches show the score and light
 * the winner, a bye reads "free win". With two players and bo3 this
 * is a single card with the series score, which is all the "best of
 * 3" view needs.
 */

// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import type { AuxMatch } from "@/lib/types/database";
import type { AuxMemberWithProfile } from "@/lib/db/aux-battles";
import { AuxAvatar } from "@/components/aux-battles/PlayerChip";

interface Props {
  matches: AuxMatch[];
  members: AuxMemberWithProfile[];
  format: "bo1" | "bo3";
  currentMatchId: string | null;
}

export default function Bracket({ matches, members, format, currentMatchId }: Props) {
  const t = useTranslations("aux.room");
  const byId = new Map(members.map((m) => [m.user_id, m.profile]));
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  const lastRound = rounds[rounds.length - 1] ?? 1;

  if (matches.length === 0) return null;

  const name = (id: string | null) => {
    if (!id) return null;
    const p = byId.get(id);
    return p ? p.display_name || p.username : "…";
  };

  return (
    <div className="overflow-x-auto -mx-1 px-1">
      <div className="flex gap-3 sm:gap-5 min-w-max py-1">
        {rounds.map((round) => {
          const list = matches.filter((m) => m.round === round);
          const isFinal = round === lastRound && list.length === 1 && !list[0].is_bye;
          return (
            <div key={round} className="flex flex-col gap-3 justify-around min-w-[11.5rem]">
              <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
                {isFinal && rounds.length > 1 ? t("final") : t("round", { n: round })}
                {/* The round's topic (043) rides on every match of the round. */}
                {list[0]?.topic && (
                  <span className="block normal-case tracking-normal text-text-secondary font-[family-name:var(--font-heading)] text-xs mt-0.5 max-w-[11.5rem] truncate">
                    {list[0].topic}
                  </span>
                )}
              </span>
              {list.map((m) => {
                const live = m.id === currentMatchId || m.status === "live";
                const pa = m.player_a_id ? byId.get(m.player_a_id) : null;
                const pb = m.player_b_id ? byId.get(m.player_b_id) : null;
                const rowClass = (id: string | null) =>
                  `flex items-center gap-2 px-2 py-1.5 ${
                    m.status === "done" && m.winner_id === id
                      ? "text-accent-glow font-bold"
                      : m.status === "done"
                        ? "text-text-muted line-through decoration-border-medium"
                        : "text-text-primary"
                  }`;
                return (
                  <div
                    key={m.id}
                    className={`panel-xbox text-xs divide-y divide-border-subtle ${
                      live ? "aux-match-live" : ""
                    }`}
                  >
                    <div className={rowClass(m.player_a_id)}>
                      {pa && <AuxAvatar profile={pa} size="sm" />}
                      <span className="truncate flex-1">{name(m.player_a_id)}</span>
                      {(format === "bo3" || m.status === "done") && !m.is_bye && (
                        <span className="tabular-nums pixel-text">{m.wins_a}</span>
                      )}
                    </div>
                    {m.is_bye ? (
                      <div className="px-2 py-1.5 pixel-text text-[10px] uppercase tracking-widest text-osd-amber">
                        {t("bye")}
                      </div>
                    ) : (
                      <div className={rowClass(m.player_b_id)}>
                        {pb && <AuxAvatar profile={pb} size="sm" />}
                        <span className="truncate flex-1">{name(m.player_b_id)}</span>
                        {(format === "bo3" || m.status === "done") && (
                          <span className="tabular-nums pixel-text">{m.wins_b}</span>
                        )}
                      </div>
                    )}
                    {live && (
                      <div className="px-2 py-1 osd-text text-[10px]">
                        <span className="text-[#ff4455] animate-pulse">●</span> {t("onAir")}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
