"use client";

/**
 * LiveCountdown — a ticking DD:HH:MM:SS clock to a release date.
 *
 * Counts down to the record's EXACT drop moment when we know it
 * (Spotify's own release time, migration 064 — BREAK EVEN ticks to
 * 5am ET), otherwise to MIDNIGHT EASTERN of release day, via
 * lib/upcoming's dropMomentMs — the one shared anchor, so the tick and
 * every D–x badge always agree. Never do date math here directly.
 *
 * Hydration-safe: the server renders a static "D–x" placeholder and
 * the ticking clock only takes over after mount (a live clock can
 * never match the server's HTML anyway). When the clock hits zero it
 * flips to OUT NOW — no refresh needed — or to "Later today" when
 * there's no exact time and Spotify hasn't switched the record on yet
 * (lib/upcoming isWaitingForDrop).
 */

import { useEffect, useState } from "react";
import { dropMomentMs, isWaitingForDrop, type DropInfo } from "@/lib/upcoming";
import { useHydrated } from "@/lib/useHydrated";
import { useTranslations } from "next-intl";

interface LiveCountdownProps {
  /** YYYY-MM-DD release date (longer ISO strings are truncated). */
  releaseDate: string;
  /** The row's drop facts (migration 064). With them, a record that
      Spotify hasn't switched on yet reads "Later today" at zero
      instead of OUT NOW, and an early drop stops the clock early. */
  drop?: DropInfo | null;
  className?: string;
}

function remaining(releaseDate: string, drop?: DropInfo | null): number {
  const target = dropMomentMs(releaseDate, drop);
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function LiveCountdown({
  releaseDate,
  drop,
  className = "",
}: LiveCountdownProps) {
  // Plain strings for the effect deps (a fresh drop object every render
  // would restart the timer each time).
  const dropsAt = drop?.drops_at ?? null;
  const waitingAt = drop?.drop_waiting_at ?? null;
  // The static placeholder renders until hydration is done (server
  // render + first client paint agree); the ticking clock takes over
  // right after. useHydrated is a store read, not a mounted-flag
  // effect, so there's no setState-in-effect here.
  const hydrated = useHydrated();
  const t = useTranslations("releases.countdown");
  const [secondsLeft, setSecondsLeft] = useState(() => remaining(releaseDate, drop));

  // A new release date (rare — the prop is fixed for a mounted card)
  // resets the clock during render, React's prev-prop pattern.
  const [prevDate, setPrevDate] = useState(releaseDate);
  if (prevDate !== releaseDate) {
    setPrevDate(releaseDate);
    setSecondsLeft(remaining(releaseDate, drop));
  }

  useEffect(() => {
    const timer = setInterval(
      () => setSecondsLeft(remaining(releaseDate, { drops_at: dropsAt, drop_waiting_at: waitingAt })),
      1000
    );
    return () => clearInterval(timer);
  }, [releaseDate, dropsAt, waitingAt]);

  // Midnight Eastern has passed but Spotify hasn't switched it on yet.
  const waiting = isWaitingForDrop(releaseDate, drop);

  if (!hydrated) {
    // Server + first client paint: day-precision only, so both sides
    // render identical HTML.
    const days = Math.ceil(remaining(releaseDate, drop) / 86_400);
    return (
      // suppressHydrationWarning: server render and client hydration
      // can straddle a midnight boundary — a one-day flicker beats a
      // hydration error.
      <span className={`tabular-nums ${className}`} suppressHydrationWarning>
        {waiting ? t("laterToday") : days > 0 ? t("dMinus", { n: days }) : t("outNow")}
      </span>
    );
  }

  if (secondsLeft <= 0) {
    return <span className={`tabular-nums ${className}`}>{waiting ? t("laterToday") : t("outNow")}</span>;
  }

  const days = Math.floor(secondsLeft / 86_400);
  const hours = Math.floor((secondsLeft % 86_400) / 3_600);
  const mins = Math.floor((secondsLeft % 3_600) / 60);
  const secs = secondsLeft % 60;

  return (
    <span className={`tabular-nums ${className}`}>
      {days > 0 ? t("days", { n: days }) : ""}
      {pad(hours)}:{pad(mins)}:{pad(secs)}
    </span>
  );
}
