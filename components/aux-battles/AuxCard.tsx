/**
 * AuxCard — one aux battle room on the index. Name, the status
 * light (LOBBY / ON AIR / FINAL), format + judge chips, player count,
 * host, and the champion once there is one.
 */

import Link from "next/link";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import type { AuxRoomWithMeta } from "@/lib/db/aux-battles";

export default function AuxCard({ room }: { room: AuxRoomWithMeta }) {
  const t = useTranslations("aux.card");
  const hostName = room.host?.display_name || room.host?.username || t("unknown");
  const champName = room.champion?.display_name || room.champion?.username || null;

  return (
    <Link
      href={`/aux-battles/${room.slug}`}
      className="panel-xbox p-4 sm:p-5 block space-y-3 hover-glow relative overflow-hidden group"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="osd-text text-xs">
          {room.status === "live" ? (
            <>
              <span className="text-[#ff4455] animate-pulse">●</span> {t("live")}
            </>
          ) : room.status === "lobby" ? (
            <span className="text-osd-amber">◌ {t("lobby")}</span>
          ) : (
            <span className="opacity-60">{t("final")}</span>
          )}
        </span>
        <span className="osd-text text-xs opacity-80 tabular-nums">
          {t("players", { n: room.player_count })}
        </span>
      </div>

      <h3 className="crt-title text-lg leading-snug group-hover:text-accent-glow transition-colors">
        {room.name}
      </h3>

      <div className="flex flex-wrap gap-1.5">
        <span className="pixel-text text-[10px] uppercase px-1.5 py-px rounded border border-border-medium text-text-secondary">
          {room.format === "bo3" ? t("bo3") : t("bo1")}
        </span>
        <span className="pixel-text text-[10px] uppercase px-1.5 py-px rounded border border-border-medium text-text-secondary">
          {room.judge === "host" ? t("hostJudge") : t("crowd")}
        </span>
        {room.is_private && (
          <span className="pixel-text text-[10px] uppercase px-1.5 py-px rounded border border-osd-amber/40 text-osd-amber">
            {t("private")}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1.5 text-xs text-text-muted flex-wrap">
        {champName ? (
          <>
            <span>🏆</span>
            <span className="font-bold text-osd-amber">{champName}</span>
            {room.champion && <VerifiedBadge role={room.champion.role} />}
            <span className="opacity-60">·</span>
          </>
        ) : null}
        <span>{t("hostedBy")}</span>
        <span className="font-bold text-text-secondary">{hostName}</span>
        {room.host && <VerifiedBadge role={room.host.role} />}
      </div>

      <div className="scan-bar" />
    </Link>
  );
}
