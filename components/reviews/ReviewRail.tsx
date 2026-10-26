/**
 * ReviewRail — the right-hand column on a review page, wide desktop only
 * (Luca 2026-10-25, website frame option D). The old game-case spine down
 * the left of the screen was removed, and the room it freed goes to the
 * things people actually tap after reading someone's review:
 *
 *   ON PEAK MUSIC   the record's average + how many people rated it,
 *                   then "Rate it yourself" (or "Your rating" when the
 *                   viewer already has one) and "Save for later"
 *   ALSO RATED IT   everyone else's score, best first, up to 5
 *   LISTEN          Spotify / Apple Music, straight to the record
 *
 * Server component: everything is worked out from rows the page already
 * has or one cheap query, no client JS except the Save button. Hidden
 * below 80rem (globals.css .review-rail) — on phones and the app the
 * page stays the single column it always was.
 */

import Link from "next/link";
import UserLink from "@/components/ui/UserLink";
import FollowEntityButton from "@/components/follow/FollowEntityButton";
import { getRatingHex, formatRating } from "@/lib/rating";
import { appleMusicUrl, parseAppleMusicId } from "@/lib/apple-music";

/** One published review of the record, trimmed to what the rail shows. */
export interface RailRating {
  reviewId: string;
  slug: string;
  userId: string;
  rating: number;
  username: string;
  name: string;
  avatarUrl: string | null;
}

interface ReviewRailProps {
  /** The review being read — left out of "Also rated it". */
  currentReviewId: string;
  viewerId: string | null;
  release: {
    id: string;
    slug: string;
    title: string;
    spotify_id: string | null;
    apple_music_id?: string | null;
  };
  artist: string;
  /** Every published review of the record, best score first. */
  ratings: RailRating[];
  viewerSaved: boolean;
  labels: {
    on: string;
    /** "average · 2 ratings" (already pluralised by the page) */
    ratings: string;
    rate: string;
    yours: string;
    save: string;
    saved: string;
    also: string;
    seeAll: string;
    listen: string;
  };
}

// How many other people the rail lists before "See all" takes over.
const SHOWN = 5;

export default function ReviewRail({
  currentReviewId,
  viewerId,
  release,
  artist,
  ratings,
  viewerSaved,
  labels,
}: ReviewRailProps) {
  // Two decimals like Rewind's average (9.55), trailing zeros dropped.
  const average =
    ratings.length > 0
      ? String(Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 100) / 100)
      : null;

  // The viewer's own rating of this record, if they have one.
  const mine = viewerId ? ratings.find((r) => r.userId === viewerId) ?? null : null;
  // Everyone else — not the review on screen, not the viewer.
  const others = ratings.filter((r) => r.reviewId !== currentReviewId && r.userId !== viewerId);

  /* Listen: straight to the record when we know its ids, otherwise a
     search for "title artist" on that service. The Apple id comes from
     the lazy cache only (lib/apple-music.ts) — no lookup on this page. */
  const query = encodeURIComponent(`${release.title} ${artist}`);
  const spotifyHref = release.spotify_id
    ? `https://open.spotify.com/album/${release.spotify_id}`
    : `https://open.spotify.com/search/${query}`;
  const appleRef = parseAppleMusicId(release.apple_music_id);
  const appleHref = appleRef ? appleMusicUrl(appleRef) : `https://music.apple.com/us/search?term=${query}`;

  return (
    <aside className="review-rail" aria-label={labels.on}>
      <div className="review-rail-sticky">
        <section className="review-rail-block">
          <p className="review-rail-eyebrow">{labels.on}</p>
          {average && (
            <p className="review-rail-avg">
              <b>{average}</b>
              <span>{labels.ratings}</span>
            </p>
          )}
          {/* The viewer reading their OWN review gets neither button
              line — they've rated it, and this page is that rating. */}
          {mine ? (
            mine.reviewId !== currentReviewId && (
              <Link href={`/reviews/${mine.slug}`} className="review-rail-mine">
                <span>{labels.yours}</span>
                <b style={{ color: getRatingHex(mine.rating) }}>{formatRating(mine.rating)}</b>
              </Link>
            )
          ) : (
            <Link href={`/reviews/new?release_id=${release.id}`} className="review-rail-btn is-primary">
              {labels.rate}
            </Link>
          )}
          <FollowEntityButton
            kind="release"
            entityId={release.id}
            initialFollowing={viewerSaved}
            labelFollow={labels.save}
            labelFollowing={labels.saved}
            plainClassName="review-rail-btn"
          />
        </section>

        {others.length > 0 && (
          <section className="review-rail-block">
            <p className="review-rail-eyebrow">{labels.also}</p>
            <ul className="review-rail-people">
              {others.slice(0, SHOWN).map((r) => (
                <li key={r.reviewId}>
                  <UserLink username={r.username} className="review-rail-person">
                    {r.avatarUrl ? (
                      <img src={r.avatarUrl} alt="" />
                    ) : (
                      <span className="review-rail-initial">{(r.username || "U")[0]}</span>
                    )}
                    <span className="review-rail-name">{r.name}</span>
                  </UserLink>
                  {/* the score opens that person's review */}
                  <Link
                    href={`/reviews/${r.slug}`}
                    className="review-rail-score"
                    style={{ color: getRatingHex(r.rating) }}
                  >
                    {formatRating(r.rating)}
                  </Link>
                </li>
              ))}
            </ul>
            {others.length > SHOWN && (
              <Link href={`/releases/${release.slug}`} className="review-rail-more">
                {labels.seeAll}
              </Link>
            )}
          </section>
        )}

        <section className="review-rail-block">
          <p className="review-rail-eyebrow">{labels.listen}</p>
          <div className="review-rail-listen">
            <a href={spotifyHref} target="_blank" rel="noopener noreferrer" className="is-spotify">
              Spotify
            </a>
            <a href={appleHref} target="_blank" rel="noopener noreferrer" className="is-apple">
              Apple Music
            </a>
          </div>
        </section>
      </div>
    </aside>
  );
}
