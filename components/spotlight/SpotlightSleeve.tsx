/**
 * SpotlightSleeve — the top of an album page while it's the Community
 * Spotlight (Luca 2026-10-30, round 3: "do the record label one").
 *
 * Same sleeve as a finished review (components/reviews/ReviewSleeve):
 * the cover is the sleeve and the record is slid out to its right.
 * Here the LP's label carries the MEMBERS' score, and a 7" single in
 * front of it carries YOURS — the community is the album, you're your
 * own single.
 *
 * Before you rate, the LP label reads ?.? in grey and the single is an
 * empty dashed "your record" slot that opens the rating screen. Rating
 * is what fills it in (the score reveal is the reason to rate).
 *
 * Both labels keep the site's score bands (plumes under 2, sparks from
 * 9.5) by reusing the review sleeve's classes. Pure markup, renders on
 * the server. Sizes come from --sleeve on .spotlight-sleeve (globals.css,
 * "COMMUNITY SPOTLIGHT").
 */

import Link from "next/link";
import { formatRating, getRatingHex } from "@/lib/rating";
import { labelInk, scoreTier } from "@/components/reviews/ReviewSleeve";

/** One printed label: score on top, small caps word underneath. */
function Label({
  rating,
  word,
  className,
}: {
  rating: number;
  word: string;
  className: string;
}) {
  const color = getRatingHex(rating);
  const tier = scoreTier(rating);
  return (
    <span className={`${className}${tier}`} style={{ background: color, color: labelInk(color) }}>
      <b>{formatRating(rating)}</b>
      <i>{word}</i>
      {tier && (
        <>
          <em className="sleeve-fx sleeve-fx-a" />
          <em className="sleeve-fx sleeve-fx-b" />
          <em className="sleeve-fx sleeve-fx-c" />
          <em className="sleeve-fx sleeve-fx-d" />
        </>
      )}
    </span>
  );
}

export default function SpotlightSleeve({
  cover,
  coverAlt,
  members,
  you,
  rateHref,
  labels,
}: {
  cover: string | null;
  coverAlt: string;
  /** Community average — only shown once the viewer has rated. */
  members: number | null;
  /** The viewer's own score; null = not rated yet (or signed out). */
  you: number | null;
  rateHref: string;
  /** Translated words: MEMBERS / YOU / "Your record" + the screen-reader lines. */
  labels: { members: string; you: string; yourRecord: string; srScores: string; srHidden: string };
}) {
  const revealed = you !== null && members !== null;
  return (
    <div className="spotlight-sleeve">
      {/* The LP — members' score on the label, or ?.? until you rate. */}
      <div className={`review-sleeve-disc${revealed ? scoreTier(members) : ""}`} aria-hidden="true">
        {revealed ? (
          <Label rating={members} word={labels.members} className="review-sleeve-label" />
        ) : (
          <span className="review-sleeve-label spotlight-label-hidden">
            <b>?.?</b>
            <i>{labels.members}</i>
          </span>
        )}
      </div>

      {/* The sleeve (the cover) sits on top of the LP. */}
      <div className="review-sleeve-jacket">
        {cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover} alt={coverAlt} />
        ) : (
          <span className="review-sleeve-blank">💿</span>
        )}
      </div>

      {/* Your 7" — or the empty slot that takes you to the rating screen. */}
      {revealed ? (
        <div className={`spotlight-single${scoreTier(you)}`} aria-hidden="true">
          <Label rating={you} word={labels.you} className="review-sleeve-label spotlight-single-label" />
        </div>
      ) : (
        <Link href={rateHref} className="spotlight-single is-empty">
          <span aria-hidden="true">+</span>
          <small>{labels.yourRecord}</small>
        </Link>
      )}

      {/* Screen readers get the scores once, as words. */}
      <span className="sr-only">{revealed ? labels.srScores : labels.srHidden}</span>
    </div>
  );
}
