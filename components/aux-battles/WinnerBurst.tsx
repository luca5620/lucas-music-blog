"use client";

/**
 * WinnerBurst — "some cool effect for when a winner is chosen" (Luca
 * 2026-09-13). A full-stage overlay: CRT flash, a rain of confetti
 * bars in the side's colour, the winning song's art punched in with
 * a chromatic wobble, and a big pixel WINNER / CHAMPION stamp.
 * Pure CSS (see .aux-burst in globals.css); html.low-detail keeps the
 * stamp and the art, drops the flash and the confetti.
 *
 * Mounted for ~3.6s by AuxRoom (game winner) or left up (champion).
 */

import { useEffect, useMemo } from "react";
// LANGUAGES: every word we wrote comes from messages/<locale>.json.
import { useTranslations } from "next-intl";
import { hapticImpact } from "@/lib/native";
import type { AuxSong } from "@/lib/types/database";
import type { AuxProfile } from "@/lib/db/aux-battles";
import { AuxAvatar } from "@/components/aux-battles/PlayerChip";

interface Props {
  kind: "game" | "champion" | "overtime";
  side?: "a" | "b" | null;
  song?: AuxSong | null;
  player?: AuxProfile | null;
  onDone?: () => void;
  /** ms before onDone fires (champion bursts pass 0 = stay). */
  duration?: number;
}

const PIECES = 42;

export default function WinnerBurst({ kind, side, song, player, onDone, duration = 3600 }: Props) {
  const t = useTranslations("aux.burst");

  // One thunk when the stamp lands (no-op on the web).
  useEffect(() => {
    void hapticImpact("MEDIUM");
  }, []);

  useEffect(() => {
    if (!onDone || duration <= 0) return;
    const id = window.setTimeout(onDone, duration);
    return () => window.clearTimeout(id);
  }, [onDone, duration]);

  // Random confetti layout, computed once per burst.
  const pieces = useMemo(
    () =>
      Array.from({ length: PIECES }, (_, i) => ({
        left: `${(i * 97) % 100}%`,
        delay: `${((i * 37) % 100) / 100}s`,
        dur: `${1.8 + ((i * 53) % 100) / 100}s`,
        rot: `${(i * 131) % 360}deg`,
        w: 6 + ((i * 17) % 8),
        h: 10 + ((i * 29) % 14),
      })),
    []
  );

  const toneClass = side === "b" ? "aux-burst-b" : "aux-burst-a";
  const label =
    kind === "champion" ? t("champion") : kind === "overtime" ? t("overtime") : t("winner");

  return (
    <div
      className={`aux-burst ${toneClass} ${kind === "champion" ? "aux-burst-stay" : ""}`}
      role="status"
      aria-live="assertive"
    >
      <div className="aux-burst-flash" />
      {kind !== "overtime" && (
        <div className="aux-confetti" aria-hidden>
          {pieces.map((p, i) => (
            <i
              key={i}
              style={{
                left: p.left,
                animationDelay: p.delay,
                animationDuration: p.dur,
                width: p.w,
                height: p.h,
                transform: `rotate(${p.rot})`,
              }}
            />
          ))}
        </div>
      )}
      <div className="aux-burst-card">
        {kind === "overtime" ? (
          <span className="aux-burst-stamp">{label}</span>
        ) : (
          <>
            {song?.artwork ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={song.artwork} alt="" className="aux-burst-art" />
            ) : player ? (
              <span className="aux-burst-art aux-burst-art-avatar">
                <AuxAvatar profile={player} size="lg" />
              </span>
            ) : null}
            <span className="aux-burst-stamp">{label}</span>
            {player && (
              <span className="aux-burst-name">
                {player.display_name || player.username}
                {kind === "game" && song ? (
                  <span className="aux-burst-song">
                    {t("takesIt", { song: song.title })}
                  </span>
                ) : null}
              </span>
            )}
          </>
        )}
      </div>
    </div>
  );
}
