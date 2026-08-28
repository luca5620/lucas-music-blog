"use client";

/**
 * CriticSegment — the broadcast card for a REVIEW (WP7 fidelity pass;
 * replaces the faithful port of the old ChannelSurf rendering).
 *
 * The full program renderer:
 *  - CHYRON lower-third: avatar + display name + "PEAK CRITIC" role
 *    chip for verified voices, with the OSD "REC {timeAgo}" stamp —
 *    news-broadcast framing for "who is talking and when".
 *  - `.crt-title` title + artist line with a genre chip.
 *  - The site's full `.rating-badge` with its elite (9.5+) and
 *    perfect (10) tiers, NEXT TO the `.poster` (which keeps its
 *    corner rating — the badge is the verdict, the corner is the
 *    receipt).
 *  - ELITE ARRIVAL: when a snap SETTLES on a ≥9.5 card, the badge
 *    remounts with the one-shot `.elite-arrival` pop (CSS restarts
 *    the animation, no JS timing) + a distinct MEDIUM haptic; the
 *    static `.elite-bloom` halo behind the poster is always painted,
 *    so thermal-idled phones still get the moment.
 *  - READ MORE: long bodies clamp to ~40svh under a fade mask;
 *    tapping "READ MORE ▸" turns the SAME box into a contained inner
 *    scroller (never chains into the pager; the frame's drag-to-exit
 *    checks its scrollTop).
 *  - STANDOUT-TRACK PILLS: the reviewer's picked tracks, and tapping
 *    one SWAPS the Spotify embed's src to THAT track — listening
 *    stays on the card, never a link-out. Tapping the active pill
 *    again rewinds to the review's own album/track embed.
 *
 * Media windowing (unchanged contract): the Spotify iframe mounts
 * whenever the card is `near` (settled index ±1) — pre-mounted
 * embeds never autoplay — and the slot wears the TUNING… skeleton
 * until the iframe actually paints. Leaving ±1 unmounts it:
 * audio-beyond-±1 is the invariant.
 */

import { useEffect, useState } from "react";
import type { CardProps } from "./ChannelChrome";
import ChannelChrome, {
  Chyron,
  RailComments,
  RailLike,
  RailOpen,
  RoleChip,
  TuningSlot,
  hrefOf,
  safeImage,
  timeAgo,
  toSpotifyEmbed,
} from "./ChannelChrome";
import { getRatingColor, getRatingHex, formatRating } from "@/lib/rating";
import { smallCover } from "@/lib/images";
import { hapticImpact, hapticTap } from "@/lib/native";

/** 9.5 is where the badge goes elite — same threshold as the badge
    tiers in lib/rating.ts (getRatingColor's rating-elite cut). */
const ELITE_MIN = 9.5;

export default function CriticSegment({
  item,
  active,
  near,
  onOpenComments,
}: CardProps<"review">) {
  const cover = safeImage(item.cover_image);
  const ratingHex = getRatingHex(item.rating);
  const isElite = item.rating >= ELITE_MIN;
  // Perfect 10s bloom in the theme accent; 9.5–9.9 blooms purple —
  // mirrors the badge tiers exactly.
  const isPerfect = item.rating >= 10;

  // Standout pills: keep only tracks whose URL actually maps to an
  // embeddable player (2–3 by contract; a pill that can't load the
  // slot would be a lie, so it's dropped, not linked out).
  const pills = (item.standout_tracks ?? [])
    .map((t) => ({ ...t, embed: toSpotifyEmbed(t.spotifyUrl) }))
    .filter((t): t is typeof t & { embed: string } => t.embed !== null)
    .slice(0, 3);

  // The slot's CURRENT program: a tapped standout track, else the
  // review's own album/track embed. Swapping src re-arms the TUNING
  // skeleton (the click handler resets embedLoaded).
  const defaultEmbed = item.spotify_url ? toSpotifyEmbed(item.spotify_url) : null;
  const [pillIdx, setPillIdx] = useState<number | null>(null);
  const embed = pillIdx !== null ? (pills[pillIdx]?.embed ?? defaultEmbed) : defaultEmbed;

  // TUNING… shows until the pre-mounted iframe paints; leaving the
  // ±1 window unmounts the iframe and re-arms the skeleton. Guarded
  // RENDER-PHASE adjustments, not effects: each reset settles before
  // paint and fires at most once per window exit.
  const [embedLoaded, setEmbedLoaded] = useState(false);
  if (!near && embedLoaded) setEmbedLoaded(false);
  // Off-window the slot rewinds to the album embed — coming back
  // should replay the review's own pick, not a stale pill.
  if (!near && pillIdx !== null) setPillIdx(null);

  // READ MORE: collapsed by default, collapses again off-window so a
  // return visit starts from the top of the read.
  const longRead = !!item.body && item.body.length > 280;
  const [readOpen, setReadOpen] = useState(false);
  if (!near && readOpen) setReadOpen(false);

  // ELITE ARRIVAL — fires on the settled snap ONTO this card (active
  // flipping false→true), elite cards only. Same guarded RENDER-PHASE
  // adjustment pattern as the window resets above: the key bump lands
  // in the arrival paint itself, no effect cascade. Remounting the
  // badge via arrivalKey restarts its one-shot CSS pop.
  const [arrivalKey, setArrivalKey] = useState(0);
  // AUDIO HYGIENE — Spotify's embed has no pause API, so a playing
  // player would keep sounding over the NEXT channel while this card
  // is still pre-mounted at ±1. Leaving the active slot remounts the
  // iframe (muteEpoch in its key): fresh embed, silent; the play
  // position is the lesser sacrifice ("audio bleeding over the next
  // channel is the one unforgivable bug").
  const [muteEpoch, setMuteEpoch] = useState(0);
  const [wasActive, setWasActive] = useState(active);
  if (active !== wasActive) {
    setWasActive(active);
    if (active && isElite) setArrivalKey((k) => k + 1);
    if (!active) {
      setMuteEpoch((k) => k + 1);
      setEmbedLoaded(false); // TUNING… covers the reload
    }
  }
  // The haptic is a real external system → a real effect, keyed on
  // the arrival counter: the vocabulary's DISTINCT MEDIUM for a 9.5+
  // landing (arrivalKey 0 = never arrived, no buzz on mount).
  useEffect(() => {
    if (arrivalKey > 0) hapticImpact("MEDIUM");
  }, [arrivalKey]);

  return (
    <ChannelChrome
      item={item}
      near={near}
      rail={
        <>
          <RailLike
            kind="review"
            id={item.id}
            initialCount={item.like_count}
            initialLiked={item.viewer_has_liked}
          />
          {/* Comments open IN PLACE (bottom sheet) without leaving
              the channel — reviews only. Count on the button:
              conversation needs scent. */}
          {onOpenComments && (
            <span className="flex flex-col items-center gap-1">
              <RailComments onClick={onOpenComments} />
              <span className="pixel-text text-xs text-text-secondary tabular-nums">
                {item.comment_count}
              </span>
            </span>
          )}
          <RailOpen href={hrefOf(item)} label="review" />
        </>
      }
    >
      {/* CHYRON — who's on air, with credentials and a REC stamp */}
      <Chyron
        avatarUrl={item.avatar_url}
        letter={(item.username || "U")[0]}
        right={
          <span className="osd-text text-[10px] whitespace-nowrap">
            REC {timeAgo(item.created_at)}
          </span>
        }
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <span className="text-sm font-bold text-text-primary truncate">
            {item.display_name || item.username}
          </span>
          <RoleChip role={item.role} />
        </span>
      </Chyron>

      {/* The work under review */}
      <span className="block max-w-md space-y-1">
        <span className="crt-title block text-xl sm:text-2xl leading-snug">
          {item.title}
        </span>
        <span className="flex items-center justify-center gap-2 text-sm text-text-secondary">
          <span>{item.artist}</span>
          {item.genre && (
            <span className="label-xbox !text-[0.55rem] !px-1.5 !py-0.5">
              {item.genre}
            </span>
          )}
        </span>
        {item.reason && (
          <span className="block text-xs text-accent-primary/80 pt-0.5">
            ◈ {item.reason}
          </span>
        )}
      </span>

      {/* Poster + the verdict. The static elite bloom sits BEHIND the
          pair (always painted — the thermal half of the arrival);
          the badge remounts per settled arrival to replay its pop. */}
      <span className="relative shrink-0 flex items-end gap-3">
        {isElite && (
          <span
            className="elite-bloom"
            aria-hidden="true"
            style={
              {
                "--bloom-rgb": isPerfect ? "var(--accent-rgb)" : "168, 85, 247",
              } as React.CSSProperties
            }
          />
        )}
        <span
          className={`poster relative ${item.body ? "w-28 sm:w-32" : "w-40 sm:w-48"}`}
        >
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
          <span className="poster-rating" style={{ color: ratingHex }}>
            {formatRating(item.rating)}
          </span>
        </span>
        <span
          key={arrivalKey}
          className={`rating-badge relative shrink-0 ${getRatingColor(item.rating)} ${
            arrivalKey > 0 ? "elite-arrival" : ""
          }`}
          style={{ color: ratingHex, borderColor: ratingHex }}
        >
          {formatRating(item.rating)}
        </span>
      </span>

      {/* The critic's words. Short takes center; long reads clamp to
          ~40svh behind a fade + READ MORE, then become their own
          contained scroller — the pager never steals a read-scroll. */}
      {item.body &&
        (longRead ? (
          <span className="block w-full max-w-md shrink min-h-0">
            <span
              className={`block text-sm text-text-secondary leading-relaxed whitespace-pre-line text-left px-1 ${
                readOpen ? "cf-read-open" : "cf-read-clamp"
              }`}
            >
              {item.body}
            </span>
            {!readOpen && (
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setReadOpen(true);
                }}
                className="mt-1 pixel-text text-[10px] uppercase tracking-widest text-accent-primary hover:text-accent-glow transition-colors"
              >
                READ MORE ▸
              </button>
            )}
          </span>
        ) : (
          <span className="block max-w-md text-sm text-text-secondary leading-relaxed whitespace-pre-line text-center">
            {item.body}
          </span>
        ))}

      {/* STANDOUT TRACKS — tapping a pill loads THAT track into the
          embed slot below (src swap, TUNING re-arms); tapping the
          active pill rewinds to the review's own embed. */}
      {pills.length > 0 && (
        <span className="flex flex-wrap items-center justify-center gap-2 max-w-md shrink-0">
          <span className="pixel-text text-[9px] uppercase tracking-widest text-text-muted w-full text-center">
            STANDOUT TRACKS
          </span>
          {pills.map((t, i) => (
            <button
              key={`${t.spotifyUrl}-${i}`}
              type="button"
              aria-pressed={pillIdx === i}
              onClick={() => {
                hapticTap();
                setPillIdx(pillIdx === i ? null : i);
                setEmbedLoaded(false); // new program → TUNING again
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold font-[family-name:var(--font-heading)] transition-colors ${
                pillIdx === i
                  ? "border-accent-primary bg-accent-primary/20 text-accent-glow"
                  : "border-white/15 bg-black/40 text-text-secondary hover:border-accent-primary/60 hover:text-accent-primary"
              }`}
            >
              ♪ {t.title}
            </button>
          ))}
        </span>
      )}

      {/* The listening slot — Spotify's compact player, PRE-MOUNTED
          while the card is within ±1 (embeds are silent until
          played). Fixed height so src swaps and mounts never shift
          layout; keyed by src so a pill tap remounts cleanly. */}
      {embed ? (
        <span className="block w-full max-w-md h-[152px] shrink-0 relative">
          {(!near || !embedLoaded) && <TuningSlot />}
          {near && (
            <iframe
              key={`${embed}:${muteEpoch}`}
              src={embed}
              width="100%"
              height={152}
              frameBorder="0"
              allow="autoplay; clipboard-write; encrypted-media"
              title={`Spotify preview of ${
                pillIdx !== null ? pills[pillIdx]?.title ?? item.title : item.title
              }`}
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
