/**
 * SpotifyEmbed — Spotify's official iframe preview player.
 *
 * The legal way to put 30-second snippets on the site: the player is
 * Spotify's own embed (open.spotify.com/embed/...), streaming from
 * their servers under their licenses — we host nothing. Logged-out
 * visitors get 30s previews per track; visitors logged into Spotify
 * in the same browser can play full tracks. (Spotify killed the raw
 * preview_url API for newer apps, so the embed is the sanctioned
 * route.)
 *
 * Works for singles and albums. The release row's spotify_id is an
 * ALBUM id for album imports but a TRACK id for single-track imports
 * (spotify_track picks key the row by the track) — a one-track
 * release whose track carries the same id gets the track player.
 *
 * next.config.ts CSP frame-src allows open.spotify.com.
 */

import type { Release, ReleaseTrack } from "@/lib/types/database";

interface SpotifyEmbedProps {
  release: Release;
  tracks: ReleaseTrack[];
}

export default function SpotifyEmbed({ release, tracks }: SpotifyEmbedProps) {
  if (!release.spotify_id) return null; // Genius-only imports: nothing to embed

  const isTrackId =
    tracks.length === 1 && tracks[0]?.spotify_id === release.spotify_id;
  const kind = isTrackId ? "track" : "album";
  // Spotify's compact player is 152px; the album player gets real
  // room for its tracklist (Luca 2026-08-26: extend the preview —
  // it replaced the Tracks card, so it should show the tracks).
  // theme=0 = dark, matching the CRT.
  const height = isTrackId ? 152 : 550;

  return (
    // xl: the card grows to fill its grid column so the preview box
    // is always exactly as tall as the live room box beside it —
    // universal across every release page (the iframe absorbs the
    // extra height; Spotify's player scales its layout to fit).
    <div className="card-y2k p-4 sm:p-5 space-y-3 overflow-hidden xl:flex-1 xl:flex xl:flex-col">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="glow-orb" />
          <span className="label-xbox">Preview</span>
        </div>
        <span className="pixel-text text-[10px] text-text-muted uppercase tracking-widest">
          30s clips · via Spotify
        </span>
      </div>
      <iframe
        src={`https://open.spotify.com/embed/${kind}/${release.spotify_id}?theme=0`}
        width="100%"
        // The height attribute rules on phones; at xl the flex-1
        // class overrides it and the player fills the column.
        height={height}
        frameBorder="0"
        allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
        loading="lazy"
        title={`Spotify preview of ${release.title}`}
        className="rounded-lg xl:flex-1 xl:min-h-0"
      />
    </div>
  );
}
