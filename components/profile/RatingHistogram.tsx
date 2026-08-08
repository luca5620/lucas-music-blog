/**
 * RatingHistogram — a small pure-CSS bar chart of a user's rating
 * distribution (whole-number buckets 0–10, from the
 * get_rating_distribution() SQL function).
 *
 * No chart library: just an 11-column flex row where each bar's
 * height is its count relative to the busiest bucket. Hovering a bar
 * shows the exact count via the native title tooltip. Server-friendly
 * (no hooks), so profile pages can render it directly.
 */

import type { RatingBucket } from "@/lib/types/database";

interface RatingHistogramProps {
  distribution: RatingBucket[];
  /** Bar color — usually the profile's accent color. */
  accentColor?: string;
}

export default function RatingHistogram({
  distribution,
  accentColor = "#1e90ff",
}: RatingHistogramProps) {
  // Fill all 11 buckets (0–10) so gaps render as empty columns.
  const counts = Array.from({ length: 11 }, (_, bucket) => {
    const match = distribution.find((d) => d.bucket === bucket);
    return match?.count ?? 0;
  });

  const total = counts.reduce((sum, c) => sum + c, 0);
  if (total === 0) return null; // nothing rated yet — skip the chart

  // Tallest bucket = 100% height; everything else scales off it.
  const max = Math.max(...counts);

  return (
    <div className="space-y-1">
      {/* The bars. items-end makes them grow up from the baseline. */}
      <div
        className="flex items-end gap-1 h-16"
        role="img"
        aria-label={`Rating distribution across ${total} ratings`}
      >
        {counts.map((count, bucket) => (
          <div
            key={bucket}
            className="flex-1 rounded-t-sm transition-all"
            // Hover shows the exact numbers, e.g. "8: 12 ratings"
            title={`${bucket}: ${count} ${count === 1 ? "rating" : "ratings"}`}
            style={{
              // Zero-count buckets keep a 2px stub so the axis reads
              // as continuous; rated buckets scale to the max.
              height: count > 0 ? `${Math.max((count / max) * 100, 6)}%` : "2px",
              background: count > 0 ? accentColor : "rgba(255,255,255,0.08)",
              opacity: count > 0 ? 0.55 + 0.45 * (count / max) : 1,
            }}
          />
        ))}
      </div>

      {/* Axis ends: 0 on the left, 10 on the right */}
      <div className="flex justify-between">
        <span className="pixel-text text-[0.6rem] text-[#5a5a60]">0</span>
        <span className="pixel-text text-[0.6rem] text-[#5a5a60]">10</span>
      </div>
    </div>
  );
}
