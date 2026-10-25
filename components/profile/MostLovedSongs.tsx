/**
 * MostLovedSongs — the automatic "Most loved songs" profile showcase
 * (Luca 2026-10-24, showcases overhaul round 2).
 *
 * Fills itself in, nothing to set up: the songs the member ♥'d as
 * personal favourites in their reviews come first, then their highest
 * song-by-song scores (lib/db/showcases.ts → getMostLovedSongs). Top 5.
 *
 * Mockup B's look: no box — a hairline heading and plain rows (number ·
 * cover · title / artist · the score badge and/or the ♥), each row
 * linking to their review of that record.
 */

import Link from "next/link";
import { useTranslations } from "next-intl";
import { formatRating, getRatingColor } from "@/lib/rating";
import type { LovedSong } from "@/lib/db/showcases";
import { LovedHeart } from "@/components/profile/ShowcaseWidgets";

export default function MostLovedSongs({ songs }: { songs: LovedSong[] }) {
  const t = useTranslations("profile.sc");
  if (songs.length === 0) return null; // nothing loved yet → no section

  return (
    <section className="space-y-3">
      <h2 className="sc-label">
        <span>{t("mostLoved")}</span>
        <small>{t("mostLovedHint")}</small>
      </h2>
      <ol className="sc-loved">
        {songs.map((song, i) => (
          <li key={song.key}>
            <Link href={song.href} className="sc-loved-row group">
              <span className="sc-loved-n">{i + 1}</span>
              <span className="sc-widget-cover">
                {song.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={song.cover} alt="" />
                ) : (
                  <span>💿</span>
                )}
              </span>
              <span className="min-w-0 flex-1">
                <span className="sc-widget-title block group-hover:text-accent-primary transition-colors">
                  {song.title}
                </span>
                <span className="sc-widget-sub block">{song.artist}</span>
              </span>
              {song.score !== null && (
                <span className={`rating-badge sc-loved-score ${getRatingColor(song.score)}`}>
                  {formatRating(song.score)}
                </span>
              )}
              {song.hearted && <LovedHeart label={t("loved")} />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
