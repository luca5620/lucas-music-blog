"use client";

/**
 * Role Badge — Verification badges for profiles and reviews.
 * - Owner: Gold checkmark badge
 * - Admin/Reviewer: Blue checkmark badge
 * - Regular users: no badge
 */

type Role = "user" | "reviewer" | "admin" | "owner";

interface RoleBadgeProps {
  role: Role;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

const badgeConfig: Record<
  Exclude<Role, "user">,
  { color: string; glow: string; label: string }
> = {
  owner: { color: "#fbbf24", glow: "#fbbf2480", label: "Owner" },
  admin: { color: "#1e90ff", glow: "#1e90ff80", label: "Admin" },
  reviewer: { color: "#1e90ff", glow: "#1e90ff80", label: "Verified Reviewer" },
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
  const s = sizeMap[size];

  return (
    <span className="inline-flex items-center gap-1" title={config.label}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className={s.icon}
        style={{ filter: `drop-shadow(0 0 4px ${config.glow})` }}
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
