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
import { useHydrated } from "@/lib/useHydrated";

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
  // The static placeholder renders until hydration is done (server
  // render + first client paint agree); the ticking clock takes over
  // right after. useHydrated is a store read, not a mounted-flag
  // effect, so there's no setState-in-effect here.
  const hydrated = useHydrated();
  const [secondsLeft, setSecondsLeft] = useState(() => remaining(releaseDate));

  // A new release date (rare — the prop is fixed for a mounted card)
  // resets the clock during render, React's prev-prop pattern.
  const [prevDate, setPrevDate] = useState(releaseDate);
  if (prevDate !== releaseDate) {
    setPrevDate(releaseDate);
    setSecondsLeft(remaining(releaseDate));
  }

  useEffect(() => {
    const timer = setInterval(
      () => setSecondsLeft(remaining(releaseDate)),
      1000
    );
    return () => clearInterval(timer);
  }, [releaseDate]);

  if (!hydrated) {
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
