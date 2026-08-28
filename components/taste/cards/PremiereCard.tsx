"use client";

/**
 * PremiereCard — the broadcast card for a RELEASE (WP7 fidelity pass;
 * replaces the faithful port of the old ChannelSurf rendering).
 *
 * The full program renderer:
 *  - AIRED / DROPPED line: fresh records (≤30 days since the drop)
 *    read "DROPPED {timeAgo}"; older ones read "AIRED {date}" — a
 *    premiere vs a rerun, in the OSD voice.
 *  - UNRELEASED = AMBER TAKEOVER: the chrome already tints the whole
 *    card amber; here the `.poster-unreleased` corner tag + a big
 *    amber pixel "COMING SOON · D-{n}" countdown take over the date
 *    line. The countdown comes from lib/upcoming.ts helpers ONLY —
 *    drops happen at midnight EASTERN (standing rule), never roll
 *    your own date math.
 *  - "{n} TRACKS · {m} MIN" from the tracks[] jsonb (WP1); runtime
 *    drops cleanly when durations are unknown (Genius imports).
 *  - COMMUNITY line from the post-pick get_release_stats RPC (WP1):
 *    "{avg} FROM {n} REVIEWS", average colored by getRatingHex.
 *  - Description keeps its source line (Genius-first sourcing rules
 *    untouched — the card only renders what lib/taste.ts enriched).
 *  - Spotify embed for released records; unreleased keep the link
 *    pill (/prerelease/ links don't resolve to embeds — standing
 *    rule, the link-paste door lives on the release page).
 *  - Rail: 📡 TRACK (the existing release-follow endpoint, optimistic,
 *    MEDIUM haptic — see RailTrack in ChannelChrome) + open arrow.
 */

import { useState } from "react";
import type { CardProps } from "./ChannelChrome";
import ChannelChrome, {
  RailOpen,
  RailTrack,
  TuningSlot,
  hrefOf,
  safeImage,
  timeAgo,
  toSpotifyEmbed,
} from "./ChannelChrome";
import { getRatingHex, formatRating } from "@/lib/rating";
import { smallCover } from "@/lib/images";
import { daysUntil, easternMidnightUtcMs, formatDropDate } from "@/lib/upcoming";
import { hapticTap } from "@/lib/native";

/** A drop is still "DROPPED {timeAgo}" news for this many days;
    after that the line flips to the calmer "AIRED {date}". */
const DROPPED_WINDOW_DAYS = 30;

/**
 * The schedule line for a RELEASED record: "DROPPED {timeAgo}" while
 * the record is still news, "AIRED {date}" once it's a rerun. Module
 * helper (like the shared timeAgo) so the clock read happens outside
 * the component body — measured from the actual drop MOMENT (midnight
 * Eastern on release day, via lib/upcoming.ts), falling back to the
 * import date when the catalog has no release_date.
 */
function airedLineFor(
  releaseDate: string | null,
  createdAt: string
): string | null {
  const dropMs = easternMidnightUtcMs(releaseDate);
  if (!Number.isNaN(dropMs) && Date.now() >= dropMs) {
    const daysAgo = Math.floor((Date.now() - dropMs) / 86_400_000);
    return daysAgo <= DROPPED_WINDOW_DAYS
      ? `DROPPED ${timeAgo(new Date(dropMs).toISOString())}`
      : `AIRED ${formatDropDate(releaseDate)}`;
  }
  // No usable release_date — the import date is the only "aired"
  // signal we have.
  return `DROPPED ${timeAgo(createdAt)}`;
}

export default function PremiereCard({ item, near }: CardProps<"release">) {
  const cover = safeImage(item.cover_image);
  // Unreleased drops keep the plain link pill (below): /prerelease/
  // Spotify links don't resolve to embeds — standing rule, the
  // link-paste door is for the release page, not a dead player here.
  const embed =
    item.spotify_url && !item.is_unreleased
      ? toSpotifyEmbed(item.spotify_url)
      : null;

  // The countdown — lib/upcoming.ts helpers ONLY (midnight-Eastern
  // rule). daysUntil returns null once the drop moment passes, so an
  // is_unreleased row whose date arrived mid-session degrades to the
  // tag without a stale D-0.
  const dDays = item.is_unreleased ? daysUntil(item.release_date) : null;

  // AIRED vs DROPPED for released records (see airedLineFor above).
  const airedLabel = item.is_unreleased
    ? null
    : airedLineFor(item.release_date, item.created_at);

  // TUNING… until the pre-mounted iframe paints (see CriticSegment —
  // same slot mechanics, one shared skeleton, same guarded
  // render-phase reset when the card leaves the ±1 window).
  const [embedLoaded, setEmbedLoaded] = useState(false);
  if (!near && embedLoaded) setEmbedLoaded(false);

  return (
    <ChannelChrome
      item={item}
      near={near}
      rail={
        <>
          <RailTrack releaseId={item.id} />
          <RailOpen href={hrefOf(item)} label="release" />
        </>
      }
    >
      {/* Schedule line: amber COMING SOON countdown for unreleased,
          AIRED/DROPPED for everything out in the world. */}
      {item.is_unreleased ? (
        <span className="pixel-text text-base sm:text-lg uppercase tracking-widest text-osd-amber [text-shadow:0_0_10px_rgba(255,176,47,0.5)] shrink-0">
          COMING SOON{dDays !== null ? ` · D-${dDays}` : ""}
        </span>
      ) : (
        airedLabel && (
          <span className="osd-text text-[11px] shrink-0">{airedLabel}</span>
        )
      )}

      {/* Big poster — the premiere IS the picture */}
      <span className="poster shrink-0 relative w-44 sm:w-56">
        {cover && near ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={smallCover(cover)}
            alt={`${item.title} cover`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-5xl">
            💿
          </span>
        )}
        {item.is_unreleased && (
          <span className="poster-unreleased">UNRELEASED</span>
        )}
      </span>

      <span className="block max-w-md space-y-1">
        <span className="crt-title block text-xl sm:text-2xl leading-snug">
          {item.title}
        </span>
        <span className="block text-sm text-text-secondary">{item.artist}</span>
        {item.reason && (
          <span className="block text-xs text-accent-primary/80 pt-0.5">
            ◈ {item.reason}
          </span>
        )}
      </span>

      {/* Format facts: tracks + runtime (runtime drops cleanly when
          the durations are unknown — Genius imports store 0s). */}
      {item.track_count > 0 && (
        <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
          {item.track_count} {item.track_count === 1 ? "TRACK" : "TRACKS"}
          {item.total_runtime_min !== null
            ? ` · ${item.total_runtime_min} MIN`
            : ""}
        </span>
      )}

      {/* What the room thinks — the WP1 post-pick RPC. Hidden until
          real reviews exist; a fake 0.0 would poison the premiere. */}
      {item.review_count > 0 && item.avg_rating !== null && (
        <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
          COMMUNITY:{" "}
          <span
            className="font-bold tabular-nums"
            style={{ color: getRatingHex(item.avg_rating) }}
          >
            {formatRating(item.avg_rating)}
          </span>{" "}
          FROM {item.review_count}{" "}
          {item.review_count === 1 ? "REVIEW" : "REVIEWS"}
        </span>
      )}

      {/* Release synopsis — enriched in lib/taste.ts for the picked
          cards. The blurb IS the pitch to check the release out. */}
      {item.description && (
        <>
          <span
            className={`block max-w-md text-sm text-text-secondary leading-relaxed whitespace-pre-line ${
              item.description.length > 280
                ? "w-full flex-shrink min-h-0 overflow-y-auto overscroll-contain touch-pan-y text-left px-1 [scrollbar-width:thin]"
                : "text-center"
            }`}
          >
            {item.description}
          </span>
          {item.description_source && item.description_source !== "manual" && (
            item.description_url ? (
              <a
                href={item.description_url}
                target="_blank"
                rel="noopener noreferrer"
                className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors shrink-0"
              >
                via {item.description_source === "genius" ? "Genius" : "Wikipedia"} ↗
              </a>
            ) : (
              <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                via {item.description_source === "genius" ? "Genius" : "Wikipedia"}
              </span>
            )
          )}
        </>
      )}

      {/* Spotify: the compact player pre-mounted at ±1 for released
          records; unreleased (or unmappable URLs) keep the link pill. */}
      {embed ? (
        <span className="block w-full max-w-md h-[152px] shrink-0 relative">
          {(!near || !embedLoaded) && <TuningSlot />}
          {near && (
            <iframe
              src={embed}
              width="100%"
              height={152}
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media"
              title={`Spotify preview of ${item.title}`}
              onLoad={() => setEmbedLoaded(true)}
              className={`w-full rounded-lg relative ${embedLoaded ? "" : "opacity-0"}`}
            />
          )}
        </span>
      ) : item.spotify_url ? (
        <a
          href={item.spotify_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => hapticTap()}
          className="shrink-0 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1DB954]/50 bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20 transition-colors text-xs font-bold uppercase tracking-wider font-[family-name:var(--font-heading)]"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
            <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.5a.62.62 0 0 1-.86.2c-2.36-1.44-5.33-1.77-8.82-.97a.62.62 0 1 1-.28-1.21c3.82-.88 7.1-.5 9.75 1.12.3.18.39.57.21.86zm1.23-2.73a.78.78 0 0 1-1.07.26c-2.7-1.66-6.82-2.14-10.01-1.17a.78.78 0 1 1-.45-1.49c3.65-1.11 8.18-.57 11.28 1.33.36.22.48.7.25 1.07zm.1-2.85C14.7 9 9.35 8.82 6.26 9.76a.93.93 0 1 1-.54-1.79c3.55-1.08 9.45-.87 13.18 1.34a.93.93 0 0 1-.95 1.6z" />
          </svg>
          Listen on Spotify
        </a>
      ) : null}
    </ChannelChrome>
  );
}
