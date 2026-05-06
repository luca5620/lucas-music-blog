/**
 * GenreBreakdown — Vertical list with horizontal % bars per genre.
 * Each genre's `color` (a Tailwind class) drives the bar fill, with the
 * profile accent color as the fallback / framing accent.
 * Server component.
 */

import type { GenreRow } from "@/data/analytics/lucas";

interface Props {
  genres: GenreRow[];
  accentColor: string;
}

export default function GenreBreakdown({ genres, accentColor }: Props) {
  const maxHours = genres[0]?.hours ?? 1;

  return (
    <div className="panel-xbox p-5 space-y-4 relative">
      <div className="flex items-center gap-3">
        <span className="label-xbox">Genres</span>
        <span className="text-xs text-text-muted">By hours</span>
      </div>
      <div className="space-y-3">
        {genres.map((genre) => (
          <div key={genre.name} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-text-primary font-medium">
                {genre.name}
              </span>
              <span
                className="pixel-text"
                style={{ color: accentColor }}
              >
                {genre.hours.toLocaleString()}h
              </span>
            </div>
            <div className="h-2.5 bg-bg-elevated rounded-full overflow-hidden">
              <div
                className={`h-full ${genre.color} rounded-full`}
                style={{ width: `${(genre.hours / maxHours) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="scan-bar" />
    </div>
  );
}
