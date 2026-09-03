"use client";

/**
 * Role Badge — Verification checkmarks for profiles and reviews.
 * - Founder (role value stays 'owner' internally — every RLS policy
 *   and permission gate checks that string): GOLD with a strong glow
 * - Admin: site blue with a strong glow
 * - Verified Reviewer: green, subtle (no dramatic glow)
 * - Early Tester: PURPLE with a strong glow — the day-one crew
 * - Regular users: no badge
 */

import { useTranslations } from "next-intl";

type Role = "user" | "reviewer" | "admin" | "owner" | "tester";

interface RoleBadgeProps {
  role: Role;
  size?: "xs" | "sm" | "md" | "lg";
  showLabel?: boolean;
}

const badgeConfig: Record<
  Exclude<Role, "user">,
  { color: string; glow: string; label: string; strongGlow: boolean }
> = {
  owner: {
    color: "#fbbf24",
    glow: "#fbbf24",
    label: "Founder",
    strongGlow: true,
  },
  admin: {
    color: "#1e90ff",
    glow: "#1e90ff",
    label: "Admin",
    strongGlow: true,
  },
  reviewer: {
    color: "#22c55e",
    glow: "#22c55e",
    label: "Verified Reviewer",
    strongGlow: false,
  },
  tester: {
    color: "#a855f7",
    glow: "#a855f7",
    label: "Early Tester",
    strongGlow: true,
  },
};

/* The glow halo needs ROOM: a drop-shadow filter on a tiny svg gets
   clipped to (roughly) the element box, so the glow faded into a hard
   square (Luca 2026-08-31: "fades into a box shape"). Each box is now
   double the visible icon — the padded viewBox below centers the
   artwork in it — and the negative margin hands the padding back to
   layout, so gaps/alignment stay exactly as before. */
const sizeMap = {
  // xs = the inline-with-a-name size (12px visible): the home-page
  // review cards read "{name} ✓ rated this release" and a 16px check
  // next to 16px text looked like a second avatar (Luca 2026-09-02).
  xs: { icon: "w-6 h-6 -m-1.5", text: "text-[10px]" },
  sm: { icon: "w-8 h-8 -m-2", text: "text-[10px]" },
  md: { icon: "w-10 h-10 -m-2.5", text: "text-xs" },
  lg: { icon: "w-12 h-12 -m-3", text: "text-sm" },
};

export default function RoleBadge({
  role,
  size = "md",
  showLabel = false,
}: RoleBadgeProps) {
  // LANGUAGES: the visible label comes from messages → profile.roles;
  // badgeConfig keeps colors (and the English label as documentation).
  const t = useTranslations("profile.roles");
  if (role === "user") return null;

  const config = badgeConfig[role];
  // Unknown role value (e.g. DB ahead of the deployed code) — show nothing
  // rather than crash.
  if (!config) return null;

  const s = sizeMap[size];
  const label = t(role);

  // Strong glow = layered drop-shadows (tight core + wide halo);
  // subtle = the single soft shadow the badges always had.
  const glowFilter = config.strongGlow
    ? `drop-shadow(0 0 3px ${config.glow}) drop-shadow(0 0 9px ${config.glow}99)`
    : `drop-shadow(0 0 4px ${config.glow}80)`;

  return (
    // align-middle: an inline-flex box has no text baseline, so
    // browsers park its BOTTOM margin edge on the baseline — the check
    // floated a few px above the name it belongs to (Luca 2026-09-02:
    // "above as it sits currently"). Middle-aligning centers it on
    // the x-height, same line as the name, everywhere it's used.
    <span className="inline-flex items-center gap-1 align-middle" title={label}>
      {/* viewBox pads 12 units of breathing room on every side (the
          icon art spans 0–24) = half the box is halo space. */}
      <svg
        viewBox="-12 -12 48 48"
        fill="none"
        className={`${s.icon} overflow-visible`}
        style={{ filter: glowFilter }}
      >
        {/* Shield / badge shape */}
        <path
          d="M9 12l2 2 4-4"
          stroke={config.color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          fill={`${config.color}20`}
          stroke={config.color}
          strokeWidth="2"
        />
      </svg>
      {showLabel && (
        <span
          className={`${s.text} font-bold uppercase tracking-wider font-[family-name:var(--font-heading)]`}
          style={{ color: config.color }}
        >
          {label}
        </span>
      )}
    </span>
  );
}

/**
 * Small inline badge for review cards and comments.
 * Just the checkmark icon, no label.
 */
export function VerifiedBadge({
  role,
  size = "sm",
}: {
  role: Role;
  /** "xs" for the check that rides inline with a name in body text. */
  size?: "xs" | "sm";
}) {
  return <RoleBadge role={role} size={size} />;
}
