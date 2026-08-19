/**
 * StreakFlame — the song-of-the-day streak counter.
 * A red flame with a strong glow (same treatment family as the
 * verification badges) and the streak number beside it. Renders
 * nothing for streak 0 — no badge of shame for missing a day.
 */

interface StreakFlameProps {
  streak: number;
  size?: "sm" | "md";
}

const FLAME_RED = "#ff4455";

const sizeMap = {
  sm: { icon: "w-4 h-4", text: "text-xs" },
  md: { icon: "w-5 h-5", text: "text-sm" },
};

export default function StreakFlame({ streak, size = "md" }: StreakFlameProps) {
  if (streak <= 0) return null;

  const s = sizeMap[size];

  return (
    <span
      className="inline-flex items-center gap-1"
      title={`${streak}-day song-of-the-day streak`}
    >
      <svg
        viewBox="0 0 24 24"
        className={s.icon}
        style={{
          filter: `drop-shadow(0 0 3px ${FLAME_RED}) drop-shadow(0 0 9px ${FLAME_RED}99)`,
        }}
      >
        {/* Flame: outer body + brighter inner tongue */}
        <path
          d="M12 2c1.2 3.6-1.8 5.4-1.8 8.1 0 1 .5 1.8 1.2 2.3-.1-1.6.9-2.5 1.9-3.6 1.9 1.9 4.2 4 4.2 7.2A6.5 6.5 0 0 1 11 22.4 6.7 6.7 0 0 1 5.5 16C5.5 10.5 10.4 7.4 12 2z"
          fill={`${FLAME_RED}30`}
          stroke={FLAME_RED}
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M12 13.5c1.4 1.3 2.4 2.6 2.4 4.2a2.9 2.9 0 0 1-5.8.2c0-2 2-2.6 3.4-4.4z"
          fill={FLAME_RED}
        />
      </svg>
      <span
        className={`${s.text} font-bold font-[family-name:var(--font-heading)] tabular-nums`}
        style={{
          color: FLAME_RED,
          textShadow: `0 0 6px ${FLAME_RED}aa`,
        }}
      >
        {streak}
      </span>
    </span>
  );
}
