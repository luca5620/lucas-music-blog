/**
 * LifetimeStatsBlock — Horizontal grid of lifetime listening stat cards.
 * Server component. Pure presentational.
 */

import type { LifetimeStat } from "@/data/analytics/lucas";

interface Props {
  stats: LifetimeStat[];
  accentColor: string;
}

export default function LifetimeStatsBlock({ stats, accentColor }: Props) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="card-y2k p-3 sm:p-4 text-center space-y-1"
          style={{ borderColor: `${accentColor}33` }}
        >
          <p
            className="font-[family-name:var(--font-heading)] text-xl sm:text-2xl font-extrabold"
            style={{ color: accentColor }}
          >
            {stat.value}
          </p>
          <p className="pixel-text text-xs text-text-primary uppercase tracking-widest">
            {stat.label}
          </p>
          <p className="text-xs text-text-muted">{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}
