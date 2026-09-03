/**
 * StreakIndicator — the animated song-of-the-day streak counter.
 *
 * Three icon styles, all glowing streak-red, all moving:
 *  - flame: flickers
 *  - vinyl: record spinning (marker notch makes the motion obvious)
 *  - cd:    disc spinning (sheen wedges do the same job)
 *
 * Pure component (no hooks) so it works in server AND client trees —
 * the settings page uses it as a live preview. Animations live in
 * globals.css (.streak-spin / .streak-flicker) and respect
 * prefers-reduced-motion. Renders nothing at streak 0.
 */

import { useTranslations } from "next-intl";

export type StreakIcon = "flame" | "vinyl" | "cd";

interface StreakIndicatorProps {
  streak: number;
  icon: StreakIcon;
  /** sm = inline chip; lg = the big module version with the count under it */
  size?: "sm" | "lg";
  /** Force-render at streak 0 (settings preview). */
  preview?: boolean;
}

const RED = "#ff4455";
const GLOW = {
  filter: `drop-shadow(0 0 4px ${RED}) drop-shadow(0 0 12px ${RED}99)`,
};

function FlameSvg({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} streak-flicker`} style={GLOW}>
      <path
        d="M12 2c1.2 3.6-1.8 5.4-1.8 8.1 0 1 .5 1.8 1.2 2.3-.1-1.6.9-2.5 1.9-3.6 1.9 1.9 4.2 4 4.2 7.2A6.5 6.5 0 0 1 11 22.4 6.7 6.7 0 0 1 5.5 16C5.5 10.5 10.4 7.4 12 2z"
        fill={`${RED}30`}
        stroke={RED}
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 13.5c1.4 1.3 2.4 2.6 2.4 4.2a2.9 2.9 0 0 1-5.8.2c0-2 2-2.6 3.4-4.4z"
        fill={RED}
      />
    </svg>
  );
}

function VinylSvg({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} streak-spin`} style={GLOW}>
      {/* Disc + grooves */}
      <circle cx="12" cy="12" r="10" fill={`${RED}22`} stroke={RED} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="7.4" fill="none" stroke={RED} strokeWidth="0.6" opacity="0.55" />
      <circle cx="12" cy="12" r="5.6" fill="none" stroke={RED} strokeWidth="0.6" opacity="0.4" />
      {/* Label + spindle hole */}
      <circle cx="12" cy="12" r="3.4" fill={RED} opacity="0.85" />
      <circle cx="12" cy="12" r="0.9" fill="#0a0a0c" />
      {/* Marker notch on the label — makes the spin readable */}
      <rect x="11.6" y="8.6" width="0.8" height="2.2" rx="0.4" fill="#0a0a0c" />
    </svg>
  );
}

function CdSvg({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`${className} streak-spin`} style={GLOW}>
      {/* Disc */}
      <circle cx="12" cy="12" r="10" fill={`${RED}18`} stroke={RED} strokeWidth="1.6" />
      {/* Sheen wedges — the rotating highlight of a CD */}
      <path d="M12 2.6A9.4 9.4 0 0 1 20.2 7.4L12 12z" fill={RED} opacity="0.32" />
      <path d="M12 21.4A9.4 9.4 0 0 1 3.8 16.6L12 12z" fill={RED} opacity="0.22" />
      {/* Hub ring + hole */}
      <circle cx="12" cy="12" r="3" fill="none" stroke={RED} strokeWidth="1" opacity="0.8" />
      <circle cx="12" cy="12" r="1.4" fill="#0a0a0c" stroke={RED} strokeWidth="0.6" />
    </svg>
  );
}

const ICONS: Record<StreakIcon, typeof FlameSvg> = {
  flame: FlameSvg,
  vinyl: VinylSvg,
  cd: CdSvg,
};

export default function StreakIndicator({
  streak,
  icon,
  size = "lg",
  preview = false,
}: StreakIndicatorProps) {
  // LANGUAGES: useTranslations works in server AND client components
  // (this one is rendered from both), unlike the async getTranslations.
  const t = useTranslations("profile.sotd");
  if (streak <= 0 && !preview) return null;

  const Icon = ICONS[icon] ?? FlameSvg;

  if (size === "sm") {
    return (
      <span
        className="inline-flex items-center gap-1"
        title={t("streakTitle", { n: streak })}
      >
        <Icon className="w-4 h-4" />
        <span
          className="text-xs font-bold font-[family-name:var(--font-heading)] tabular-nums"
          style={{ color: RED, textShadow: `0 0 6px ${RED}aa` }}
        >
          {streak}
        </span>
      </span>
    );
  }

  // lg — the module version: big moving icon, count underneath.
  return (
    <div
      className="flex flex-col items-center justify-center gap-1 shrink-0"
      title={t("streakTitle", { n: streak })}
    >
      <Icon className="w-14 h-14 sm:w-16 sm:h-16" />
      <span
        className="text-xl font-extrabold font-[family-name:var(--font-heading)] tabular-nums leading-none"
        style={{ color: RED, textShadow: `0 0 8px ${RED}aa` }}
      >
        {streak}
      </span>
      <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted">
        {t("dayStreak")}
      </span>
    </div>
  );
}
