/**
 * RecentResult — one finished war on the arena's "from the tape
 * vault" shelf (code review 2026-10-05). Where AuxCard is a room's
 * label, this is the result: the final's topic, the two songs that
 * met in it, which one won, and the champion. It's what tells a
 * visitor on a quiet day "people DO play this — here's what it looks
 * like".
 *
 * The two songs sit like the A- and B-side of a single: blue for A,
 * rose for B (the same two colours the stage uses), the winning side
 * lit, the other dimmed. A final decided by forfeit has no songs —
 * the rows then just show the two players.
 *
 * Server-rendered, links to the room (its page keeps the full bracket
 * and the chat).
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { VerifiedBadge } from "@/components/ui/RoleBadge";
import type { AuxProfile, AuxRecentResult } from "@/lib/db/aux-wars";
import type { AuxSong } from "@/lib/types/database";

function SideRow({
  side,
  profile,
  song,
  won,
  decided,
}: {
  side: "a" | "b";
  profile: AuxProfile | null;
  song: AuxSong | null;
  won: boolean;
  /** Is there a winner at all? If not, neither side is dimmed. */
  decided: boolean;
}) {
  const t = useTranslations("aux.recent");
  const tone = side === "a" ? "border-accent-primary/40" : "border-accent-rose/40";
  const name = profile?.display_name || profile?.username || "…";
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border ${tone} bg-black/25 p-2 ${
        decided && !won ? "opacity-55" : ""
      } ${won ? "shadow-[0_0_14px_rgba(var(--accent-rgb),0.25)]" : ""}`}
    >
      {/* The sleeve. Spotify/SoundCloud/YouTube artwork when the pick
          had one; otherwise a blank tape with the side letter. */}
      {song?.artwork ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={song.artwork}
          alt=""
          loading="lazy"
          className="w-11 h-11 rounded object-cover border border-white/10 shrink-0"
        />
      ) : (
        <span className="w-11 h-11 rounded border border-border-medium bg-bg-elevated flex items-center justify-center shrink-0 pixel-text text-xs text-text-muted uppercase">
          {side}
        </span>
      )}
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block text-sm font-bold text-text-primary truncate font-[family-name:var(--font-heading)]">
          {song ? song.title : name}
        </span>
        <span className="block text-[11px] text-text-muted truncate">
          {song ? (
            <>
              {song.artist ? `${song.artist} · ` : ""}
              {t("pickedBy", { name })}
            </>
          ) : (
            t("noSong")
          )}
        </span>
      </span>
      {won && (
        <span className="pixel-text text-[10px] uppercase tracking-widest text-osd-amber shrink-0">
          🏆 {t("won")}
        </span>
      )}
    </div>
  );
}

export default function RecentResult({ result }: { result: AuxRecentResult }) {
  const t = useTranslations("aux.recent");
  const { room, topic, a, b, winnerSide } = result;
  const champ = room.champion;
  const champName = champ?.display_name || champ?.username || null;

  return (
    <Link
      href={`/aux-wars/${room.slug}`}
      className="panel-xbox p-4 sm:p-5 block space-y-3 hover-glow relative overflow-hidden group"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="osd-text text-xs opacity-80">{t("final")}</span>
        <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted truncate max-w-[60%]">
          {room.name}
        </span>
      </div>

      {topic && (
        <p className="crt-title text-base sm:text-lg leading-snug group-hover:text-accent-glow transition-colors">
          “{topic}”
        </p>
      )}

      <div className="space-y-1.5">
        <SideRow side="a" profile={a.profile} song={a.song} won={winnerSide === "a"} decided={!!winnerSide} />
        <div className="pixel-text text-[10px] uppercase tracking-[0.3em] text-text-muted text-center">
          {t("vs")}
        </div>
        <SideRow side="b" profile={b.profile} song={b.song} won={winnerSide === "b"} decided={!!winnerSide} />
      </div>

      {champName && (
        <div className="flex items-center gap-1.5 text-xs text-text-muted flex-wrap pt-1">
          <span>🏆</span>
          <span className="font-bold text-osd-amber">{champName}</span>
          {champ && <VerifiedBadge role={champ.role} />}
          <span>{t("champion")}</span>
        </div>
      )}
      <div className="scan-bar" />
    </Link>
  );
}
