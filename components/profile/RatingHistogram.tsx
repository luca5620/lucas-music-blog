/**
 * RatingHistogram — the RATING OVERVIEW module: the average rating
 * stated on the left, and on the right a frequency graph of every
 * rating the member has published (Luca 2026-09-12: "a graph showing
 * all of the frequency of ratings with it saying the average rating
 * as well").
 *
 * Half-point buckets (0, 0.5, … 10 — 21 bars) because ratings carry
 * one decimal and a 9.5 is not a 9. Each bar wears the rating
 * ladder's colour for its value (lib/rating.ts), so the graph reads
 * like the rating badges do: greys → reds → greens → cyan → blue →
 * purple → the perfect-10 blue. The count sits above every non-empty
 * bar; a dashed marker drops through the graph at the average.
 *
 * Pure markup, no chart library, no hooks beyond translations —
 * profile pages render it straight from the server. The ratings come
 * from the page's own reviews list, so the graph always agrees with
 * the REVIEWS number in the header. (The old get_rating_distribution
 * RPC was being called with the wrong parameter name and never
 * returned a row — the graph had been invisible since day one.)
 */

import { useTranslations } from "next-intl";
import { formatRating, getRatingHex } from "@/lib/rating";

const BUCKETS = 21; // 0.0 … 10.0 in halves

interface RatingHistogramProps {
  /** Every published rating, 0–10 with one decimal. */
  ratings: number[];
  /** Headline colour for the average — the profile's accent. */
  accentColor?: string;
}

export default function RatingHistogram({
  ratings,
  accentColor = "#1e90ff",
}: RatingHistogramProps) {
  const t = useTranslations("profile");
  const counts = new Array<number>(BUCKETS).fill(0);
  let sum = 0;
  for (const r of ratings) {
    if (!Number.isFinite(r)) continue;
    const clamped = Math.min(10, Math.max(0, r));
    counts[Math.min(BUCKETS - 1, Math.floor(clamped * 2))] += 1;
    sum += clamped;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  const average = total > 0 ? sum / total : null;
  const max = Math.max(1, ...counts);

  return (
    <div className="rating-overview">
      {/* The average, stated */}
      <div className="rating-overview-avg">
        <p className="rating-overview-number" style={{ color: accentColor }}>
          {average === null ? "—" : formatRating(average)}
        </p>
        <p className="stat-label">{t("averageRating")}</p>
        <p className="rating-overview-count">{t("histogram.ratingsCount", { n: total })}</p>
      </div>

      {/* The frequency graph */}
      <div className="rating-graph">
        <div
          className="rating-graph-bars"
          role="img"
          aria-label={t("histogram.aria", { n: total })}
        >
          {counts.map((count, i) => {
            const value = i / 2;
            const label = Number.isInteger(value) ? String(value) : value.toFixed(1);
            return (
              <div key={i} className="rating-bar" title={t("histogram.bar", { bucket: label, n: count })}>
                {count > 0 && <span className="rating-bar-count">{count}</span>}
                <span
                  className="rating-bar-fill"
                  style={{
                    height: count > 0 ? `${Math.max((count / max) * 100, 8)}%` : "2px",
                    background: count > 0 ? getRatingHex(value) : "rgba(255,255,255,0.08)",
                  }}
                />
              </div>
            );
          })}
          {average !== null && (
            <span
              className="rating-avg-line"
              style={{ left: `${(average / 10) * 100}%`, borderColor: accentColor }}
              aria-hidden="true"
            />
          )}
        </div>
        {/* Axis */}
        <div className="rating-graph-axis" aria-hidden="true">
          <span>0</span>
          <span>2.5</span>
          <span>5</span>
          <span>7.5</span>
          <span>10</span>
        </div>
      </div>
    </div>
  );
}
