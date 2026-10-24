/**
 * ReviewSleeve — the top of a finished review (Luca 2026-10-24, round 3
 * verdict: "sleeve option 1").
 *
 * The album cover is the record sleeve, and the record is slid halfway
 * out to its right. The reviewer's score is printed on the record's
 * centre label, in the rating colour — the score IS the record, not a
 * badge stuck beside it. When the page opens, the record rolls out of
 * the sleeve (a short slide + turn); Low detail mode and Reduce Motion
 * show it already out.
 *
 * Banned on purpose (Luca 2026-10-24, never borrow from the Ratings
 * app): no ring score, no gradient slider, no blurred-cover background.
 *
 * Pure markup, no hooks, so it renders on the server with the page.
 * Sizes come from one CSS variable (--sleeve, set in globals.css under
 * "REVIEW SLEEVE") so the record, its label and the number all scale
 * together from phones to desktop.
 */

import { formatRating, getRatingHex } from "@/lib/rating";

/** Dark ink on light label colours, white ink on dark ones — the label
    has to stay readable whatever colour the score lands on. */
function labelInk(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.22 ? "#120a1f" : "#ffffff";
}

export default function ReviewSleeve({
  cover,
  coverAlt,
  rating,
  outOfLabel,
  unreleasedLabel,
}: {
  cover: string | null;
  coverAlt: string;
  rating: number;
  /** "OUT OF 10", translated. */
  outOfLabel: string;
  /** Set when the release is unreleased — the amber tag on the sleeve. */
  unreleasedLabel?: string | null;
}) {
  const color = getRatingHex(rating);
  return (
    <div className="review-sleeve">
      {/* The record. The label is part of it, so it turns with the
          record as it rolls out and lands upright. */}
      <div className="review-sleeve-disc" aria-hidden="true">
        <span
          className="review-sleeve-label"
          style={{ background: color, color: labelInk(color) }}
        >
          <b>{formatRating(rating)}</b>
          <i>{outOfLabel}</i>
        </span>
      </div>
      {/* The sleeve (the cover) sits on top of the record. */}
      <div className="review-sleeve-jacket">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={coverAlt} />
        ) : (
          <span className="review-sleeve-blank">💿</span>
        )}
        {unreleasedLabel && <span className="poster-unreleased">{unreleasedLabel}</span>}
      </div>
      {/* Screen readers get the score once, as words. */}
      <span className="sr-only">{`${formatRating(rating)} / 10`}</span>
    </div>
  );
}
