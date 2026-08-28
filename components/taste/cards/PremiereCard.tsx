"use client";

/**
 * PremiereCard — the broadcast card for a RELEASE.
 *
 * FAITHFUL PORT (for now) of the old ChannelSurf fullscreen release
 * rendering: poster (UNRELEASED corner tag when applicable), title,
 * artist, the Letterboxd-style synopsis with its source line, and
 * the Spotify embed slot. The WP7 fidelity pass (AIRED/DROPPED line,
 * amber COMING SOON D-{n} countdown, tracks/runtime line, community
 * stats, 📡 TRACK follow button) replaces the internals next; the
 * contract stays.
 *
 * Description sourcing rules are untouched: the blurb arrives
 * pre-enriched from lib/taste.ts (getReleaseDescription, Genius
 * first) — this card only renders it and credits the source.
 */

import { useState } from "react";
import type { CardProps } from "./ChannelChrome";
import ChannelChrome, {
  RailOpen,
  TuningSlot,
  hrefOf,
  safeImage,
  toSpotifyEmbed,
} from "./ChannelChrome";
import { hapticTap } from "@/lib/native";

export default function PremiereCard({ item, near }: CardProps<"release">) {
  const cover = safeImage(item.cover_image);
  // Unreleased drops keep the plain link pill (below): /prerelease/
  // Spotify links don't resolve to embeds — standing rule, the
  // link-paste door is for the release page, not a dead player here.
  const embed =
    item.spotify_url && !item.is_unreleased
      ? toSpotifyEmbed(item.spotify_url)
      : null;

  // TUNING… until the pre-mounted iframe paints (see CriticSegment —
  // same slot mechanics, one shared skeleton, same guarded
  // render-phase reset when the card leaves the ±1 window).
  const [embedLoaded, setEmbedLoaded] = useState(false);
  if (!near && embedLoaded) setEmbedLoaded(false);

  return (
    <ChannelChrome
      item={item}
      near={near}
      rail={<RailOpen href={hrefOf(item)} label="release" />}
    >
      <span className="poster shrink-0 relative w-40 sm:w-48">
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
        {item.is_unreleased && (
          <span className="poster-unreleased">UNRELEASED</span>
        )}
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
