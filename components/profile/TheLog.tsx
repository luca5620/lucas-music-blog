/**
 * TheLog — the month punch card (Luca 2026-09-12: the diary with a
 * twist, first cut). One square per day of the current month; a day
 * you published a rating shows that record's cover with the score in
 * the corner, every other day stays a dark square waiting to be
 * filled. The empty squares are the point — "fill the calendar" is
 * the pull, the covers are the reward.
 *
 * Rules:
 *  - A review lands on its review_date (the date the verdict was
 *    published; the form stamps it at publish time). Re-rates REPLACE
 *    the old score, so a record is one square, never two.
 *  - Two records on one day: the newest cover shows, with "+1" in the
 *    corner. Tap → the review page.
 *  - On by default, every profile, no showcase toggle. Compact by
 *    design: it lives beside the four numbers on web and under them
 *    on the app (see the profile page).
 *
 * Never called "diary" in copy. Server component, pure markup.
 */

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { getRatingHex, formatRating } from "@/lib/rating";
import type { Review } from "@/lib/types/database";

/** YYYY-MM-DD of the day a review counts on. */
function dayKey(review: Review): string {
  if (review.review_date) return review.review_date.slice(0, 10);
  return review.created_at.slice(0, 10);
}

export default async function TheLog({
  reviews,
  locale,
  accentColor,
  now = new Date(),
}: {
  reviews: Review[];
  locale: string;
  accentColor: string;
  now?: Date;
}) {
  const t = await getTranslations("profile.log");
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-based
  const todayKey = now.toISOString().slice(0, 10);
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  // Monday-first grid: how many blanks before the 1st.
  const firstDow = (new Date(Date.UTC(year, month, 1)).getUTCDay() + 6) % 7;

  // Newest review per day this month, plus how many landed that day.
  const byDay = new Map<string, { review: Review; extra: number }>();
  const prefix = `${year}-${String(month + 1).padStart(2, "0")}-`;
  for (const r of reviews) {
    const key = dayKey(r);
    if (!key.startsWith(prefix)) continue;
    const cur = byDay.get(key);
    if (!cur) byDay.set(key, { review: r, extra: 0 });
    else {
      cur.extra += 1;
      if (r.created_at > cur.review.created_at) cur.review = r;
    }
  }

  const monthName = new Intl.DateTimeFormat(locale, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(now);
  const weekdayFmt = new Intl.DateTimeFormat(locale, { weekday: "narrow", timeZone: "UTC" });
  // A known Monday (2024-01-01) → the seven narrow weekday letters.
  const weekdays = Array.from({ length: 7 }, (_, i) =>
    weekdayFmt.format(new Date(Date.UTC(2024, 0, 1 + i)))
  );

  const cells: React.ReactNode[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push(<span key={`pad-${i}`} className="log-cell log-cell-pad" aria-hidden="true" />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${prefix}${String(d).padStart(2, "0")}`;
    const hit = byDay.get(key);
    const isToday = key === todayKey;
    const isFuture = key > todayKey;
    if (hit) {
      const { review, extra } = hit;
      const color = getRatingHex(review.rating);
      cells.push(
        <Link
          key={key}
          href={`/reviews/${review.slug}`}
          className={`log-cell log-cell-filled${isToday ? " log-cell-today" : ""}`}
          title={`${review.title} — ${review.artist} (${formatRating(review.rating)})`}
          style={{ "--log-accent": accentColor } as React.CSSProperties}
        >
          {review.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={review.cover_image} alt="" loading="lazy" decoding="async" />
          ) : (
            <span className="log-cell-nocover">💿</span>
          )}
          <span className="log-cell-rating" style={{ color, borderColor: color }}>
            {formatRating(review.rating)}
          </span>
          {extra > 0 && <span className="log-cell-more">+{extra}</span>}
        </Link>
      );
    } else {
      cells.push(
        <span
          key={key}
          className={`log-cell${isToday ? " log-cell-today" : ""}${isFuture ? " log-cell-future" : ""}`}
          style={{ "--log-accent": accentColor } as React.CSSProperties}
        >
          <span className="log-cell-day">{d}</span>
        </span>
      );
    }
  }

  const logged = byDay.size;

  return (
    <section className="the-log" aria-label={t("aria", { month: monthName })}>
      <div className="the-log-head">
        <span className="vhs-label text-[11px]">{t("title")}</span>
        <span className="the-log-month">{monthName}</span>
      </div>
      <div className="log-weekdays" aria-hidden="true">
        {weekdays.map((w, i) => (
          <span key={i}>{w}</span>
        ))}
      </div>
      <div className="log-grid">{cells}</div>
      <p className="the-log-foot">
        {logged === 0 ? t("empty") : t("logged", { n: logged })}
      </p>
    </section>
  );
}
