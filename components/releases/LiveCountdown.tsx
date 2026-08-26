"use client";

/**
 * LiveCountdown — a ticking DD:HH:MM:SS clock to a release date.
 *
 * Counts down to MIDNIGHT EASTERN of release day (the US drop
 * moment) via lib/upcoming's easternMidnightUtcMs — the one shared
 * anchor, so the tick and every D–x badge always agree. Never do
 * date math here directly.
 *
 * Hydration-safe: the server renders a static "D–x" placeholder and
 * the ticking clock only takes over after mount (a live clock can
 * never match the server's HTML anyway). When the clock hits zero it
 * flips to OUT NOW — no refresh needed at midnight.
 */

import { useEffect, useState } from "react";
import { easternMidnightUtcMs } from "@/lib/upcoming";

interface LiveCountdownProps {
  /** YYYY-MM-DD release date (longer ISO strings are truncated). */
  releaseDate: string;
  className?: string;
}

function remaining(releaseDate: string): number {
  const target = easternMidnightUtcMs(releaseDate);
  if (Number.isNaN(target)) return 0;
  return Math.max(0, Math.floor((target - Date.now()) / 1000));
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export default function LiveCountdown({
  releaseDate,
  className = "",
}: LiveCountdownProps) {
  // null until mounted — that renders the static placeholder.
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  useEffect(() => {
    setSecondsLeft(remaining(releaseDate));
    const timer = setInterval(
      () => setSecondsLeft(remaining(releaseDate)),
      1000
    );
    return () => clearInterval(timer);
  }, [releaseDate]);

  if (secondsLeft === null) {
    // Server + first client paint: day-precision only, so both sides
    // render identical HTML.
    const days = Math.ceil(remaining(releaseDate) / 86_400);
    return (
      // suppressHydrationWarning: server render and client hydration
      // can straddle a midnight boundary — a one-day flicker beats a
      // hydration error.
      <span className={`tabular-nums ${className}`} suppressHydrationWarning>
        {days > 0 ? `D–${days}` : "OUT NOW"}
      </span>
    );
  }

  if (secondsLeft <= 0) {
    return <span className={`tabular-nums ${className}`}>OUT NOW</span>;
  }

  const days = Math.floor(secondsLeft / 86_400);
  const hours = Math.floor((secondsLeft % 86_400) / 3_600);
  const mins = Math.floor((secondsLeft % 3_600) / 60);
  const secs = secondsLeft % 60;

  return (
    <span className={`tabular-nums ${className}`}>
      {days > 0 ? `${days}D ` : ""}
      {pad(hours)}:{pad(mins)}:{pad(secs)}
    </span>
  );
}
