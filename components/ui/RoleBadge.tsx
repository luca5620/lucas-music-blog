"use client";

/**
 * Role Badge — Verification checkmarks for profiles and reviews.
 * - Owner: GOLD with a strong glow
 * - Admin: site blue with a strong glow
 * - Verified Reviewer: green, subtle (no dramatic glow)
 * - Early Tester: PURPLE with a strong glow — the day-one crew
 * - Regular users: no badge
 */

type Role = "user" | "reviewer" | "admin" | "owner" | "tester";

interface RoleBadgeProps {
  role: Role;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const badgeConfig: Record<
  Exclude<Role, "user">,
  { color: string; glow: string; label: string; strongGlow: boolean }
> = {
  owner: {
    color: "#fbbf24",
    glow: "#fbbf24",
    label: "Owner",
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

const sizeMap = {
  sm: { icon: "w-4 h-4", text: "text-[10px]" },
  md: { icon: "w-5 h-5", text: "text-xs" },
  lg: { icon: "w-6 h-6", text: "text-sm" },
};

export default function RoleBadge({
  role,
  size = "md",
  showLabel = false,
}: RoleBadgeProps) {
  if (role === "user") return null;

  const config = badgeConfig[role];
  // Unknown role value (e.g. DB ahead of the deployed code) — show nothing
  // rather than crash.
  if (!config) return null;

  const s = sizeMap[size];

  // Strong glow = layered drop-shadows (tight core + wide halo);
  // subtle = the single soft shadow the badges always had.
  const glowFilter = config.strongGlow
    ? `drop-shadow(0 0 3px ${config.glow}) drop-shadow(0 0 9px ${config.glow}99)`
    : `drop-shadow(0 0 4px ${config.glow}80)`;

  return (
    <span className="inline-flex items-center gap-1" title={config.label}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={s.icon}
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
          {config.label}
        </span>
      )}
    </span>
  );
}

/**
 * Small inline badge for review cards and comments.
 * Just the checkmark icon, no label.
 */
export function VerifiedBadge({ role }: { role: Role }) {
  return <RoleBadge role={role} size="sm" />;
}
