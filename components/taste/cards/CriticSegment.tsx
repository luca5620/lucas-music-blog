"use client";

/**
 * CriticSegment — the broadcast card for a REVIEW.
 *
 * FAITHFUL PORT (for now) of the old ChannelSurf fullscreen review
 * rendering: reviewer chyron line ("{name} rated it {x}"), poster
 * with the rating corner, title/artist, reason chip, the review's
 * own words (scrolling inside the card when long), and the Spotify
 * embed slot. The WP7 fidelity pass (full chyron bar, rating-badge
 * tiers, elite arrival, standout-track pills) replaces this file's
 * internals next — the card CONTRACT ({ item, active, near,
 * onOpenComments }) is what's permanent here.
 *
 * Media windowing (the new part): the Spotify iframe mounts whenever
 * the card is `near` (settled index ±1) — pre-mounted embeds never
 * autoplay, so a neighbor card is silent until the viewer presses
 * play — and the slot wears the TUNING… skeleton until the iframe
 * actually paints. Leaving the ±1 window unmounts it, which is what
 * cuts any playing audio: audio-beyond-±1 is the invariant.
 */

import { useState } from "react";
import type { CardProps } from "./ChannelChrome";
import ChannelChrome, {
  RailComments,
  RailLike,
  RailOpen,
  TuningSlot,
  hrefOf,
  safeImage,
  toSpotifyEmbed,
} from "./ChannelChrome";
import { getRatingHex, formatRating } from "@/lib/rating";
import { hapticTap } from "@/lib/native";

export default function CriticSegment({
  item,
  near,
  onOpenComments,
}: CardProps<"review">) {
  const cover = safeImage(item.cover_image);
  const embed = item.spotify_url ? toSpotifyEmbed(item.spotify_url) : null;

  // TUNING… shows until the pre-mounted iframe paints; leaving the
  // ±1 window unmounts the iframe and re-arms the skeleton. Guarded
  // RENDER-PHASE adjustment, not an effect: the reset settles before
  // anything paints and never cascades (the guard makes it fire at
  // most once per window exit).
  const [embedLoaded, setEmbedLoaded] = useState(false);
  if (!near && embedLoaded) setEmbedLoaded(false);

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
              the channel — reviews only. */}
          {onOpenComments && <RailComments onClick={onOpenComments} />}
          <RailOpen href={hrefOf(item)} label="review" />
        </>
      }
    >
      {/* Reviews lead with the person: avatar + name above the work */}
      <span className="flex items-center gap-2.5">
        {safeImage(item.avatar_url) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={safeImage(item.avatar_url)!}
            alt=""
            loading="lazy"
            decoding="async"
            className="w-8 h-8 rounded-full object-cover border border-white/10"
          />
        ) : (
          <span className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase">
            {(item.username || "U")[0]}
          </span>
        )}
        <span className="text-sm text-text-secondary">
          <span className="font-bold text-text-primary">
            {item.display_name || item.username}
          </span>{" "}
          rated it{" "}
          <span
            className="font-bold tabular-nums"
            style={{ color: getRatingHex(item.rating) }}
          >
            {formatRating(item.rating)}
          </span>
        </span>
      </span>

      {/* Poster — smaller when the review has words (their words get
          the room), covers windowed at ±1 like all media. */}
      <span
        className={`poster shrink-0 relative ${item.body ? "w-28 sm:w-32" : "w-40 sm:w-48"}`}
      >
        {cover && near ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover}
            alt={`${item.title} cover`}
            loading="lazy"
            decoding="async"
          />
        ) : (
          <span className="w-full h-full flex items-center justify-center text-5xl">
            💿
          </span>
        )}
        <span
          className="poster-rating"
          style={{ color: getRatingHex(item.rating) }}
        >
          {formatRating(item.rating)}
        </span>
      </span>

      <span className="block max-w-md space-y-1">
        <span className="block text-lg sm:text-xl font-bold text-text-primary font-[family-name:var(--font-heading)] leading-snug">
          {item.title}
        </span>
        <span className="block text-sm text-text-secondary">{item.artist}</span>
        {item.reason && (
          <span className="block text-xs text-accent-primary/80 pt-0.5">
            ◈ {item.reason}
          </span>
        )}
      </span>

      {/* The words themselves, right on the card. Long reads get the
          reading treatment — left-aligned, scrolling inside their own
          box. overscroll-contain + touch-pan-y: the inner scroller
          never chains into the pager mid-read, and the drag-to-exit
          gesture checks its scrollTop before arming. */}
      {item.body && (
        <span
          className={`block max-w-md text-sm text-text-secondary leading-relaxed whitespace-pre-line ${
            item.body.length > 280
              ? "w-full flex-shrink min-h-0 overflow-y-auto overscroll-contain touch-pan-y text-left px-1 [scrollbar-width:thin]"
              : "text-center"
          }`}
        >
          {item.body}
        </span>
      )}

      {/* Straight to the music — Spotify's compact player, PRE-MOUNTED
          while the card is within ±1 of the settled channel (embeds
          are silent until played). Fixed-height slot so mount/unmount
          never shifts the card's layout; TUNING… until it paints.
          URLs that don't map to an embed keep the external link. */}
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
