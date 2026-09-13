/**
 * Aux battle songs — SERVER ONLY. One place that turns "what the
 * player typed or pasted" into the AuxSong card stored on a game
 * (lib/types/database.ts → AuxSong), across the three sources Luca
 * asked for (2026-09-13): Spotify, SoundCloud and YouTube.
 *
 *   searchSongs(q, source)   → up to 8 cards from that service
 *   songFromLink(url)        → one card from a pasted link (any of
 *                              the three; the link says which)
 *   isAuxSong(x)             → the shape check the API runs before
 *                              the card goes anywhere near the DB
 *
 * Spotify comes through the same client-credentials token the
 * catalog uses (single /tracks and /search are open to it — see
 * lib/spotify-import.ts). SoundCloud and YouTube search need their
 * own keys (lib/soundcloud.ts, lib/youtube.ts); their link-paste
 * paths need none, so a battle always works even with no keys set.
 */

import { spotifyFetch } from "@/lib/spotify-import";
import {
  isSoundCloudUrl,
  searchSoundCloudTracks,
  soundcloudConfigured,
  soundcloudSongFromLink,
} from "@/lib/soundcloud";
import { parseYouTubeId, searchYouTube, youtubeConfigured, youtubeSongFromLink } from "@/lib/youtube";
import type { AuxSong } from "@/lib/types/database";

export type SongSource = AuxSong["source"];

export const SONG_SOURCES: SongSource[] = ["spotify", "soundcloud", "youtube"];

/** Which sources can SEARCH right now (link-paste always works). */
export function searchableSources(): Record<SongSource, boolean> {
  return {
    spotify: !!process.env.SPOTIFY_CLIENT_ID && !!process.env.SPOTIFY_CLIENT_SECRET,
    soundcloud: soundcloudConfigured(),
    youtube: youtubeConfigured(),
  };
}

/* ------------------------------------------------------------------
   Spotify
   ------------------------------------------------------------------ */

interface SpotifyTrack {
  id: string;
  name: string;
  artists?: { name: string }[];
  album?: { images?: { url: string; width?: number }[] };
  external_urls?: { spotify?: string };
}

function spotifyTrackToSong(t: SpotifyTrack): AuxSong {
  const images = t.album?.images ?? [];
  // Spotify lists images largest first; the 300px one is plenty.
  const art = images.find((i) => (i.width ?? 0) <= 320) ?? images[images.length - 1] ?? null;
  return {
    source: "spotify",
    title: t.name.slice(0, 200),
    artist: (t.artists ?? []).map((a) => a.name).join(", ").slice(0, 120) || null,
    artwork: art?.url ?? null,
    url: t.external_urls?.spotify ?? `https://open.spotify.com/track/${t.id}`,
    embed_id: t.id,
  };
}

export function parseSpotifyTrackId(url: string): string | null {
  const m =
    url.match(/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?track\/([A-Za-z0-9]{22})/) ||
    url.match(/^spotify:track:([A-Za-z0-9]{22})$/);
  return m ? m[1] : null;
}

async function searchSpotify(q: string, limit: number): Promise<AuxSong[]> {
  try {
    const data = (await spotifyFetch(
      `/search?type=track&limit=${limit}&q=${encodeURIComponent(q)}`
    )) as { tracks?: { items?: SpotifyTrack[] } };
    return (data.tracks?.items ?? []).filter((t) => t?.id && t.name).map(spotifyTrackToSong);
  } catch (err) {
    console.warn("aux songs: spotify search failed —", err instanceof Error ? err.message : err);
    return [];
  }
}

async function spotifySongFromLink(url: string): Promise<AuxSong | null> {
  const id = parseSpotifyTrackId(url);
  if (!id) return null;
  try {
    const t = (await spotifyFetch(`/tracks/${id}`)) as SpotifyTrack;
    if (!t?.id) return null;
    return spotifyTrackToSong(t);
  } catch (err) {
    console.warn("aux songs: spotify track failed —", err instanceof Error ? err.message : err);
    return null;
  }
}

/* ------------------------------------------------------------------
   The two public entry points
   ------------------------------------------------------------------ */

export async function searchSongs(q: string, source: SongSource, limit = 8): Promise<AuxSong[]> {
  const query = q.trim();
  if (query.length < 2) return [];
  switch (source) {
    case "spotify":
      return searchSpotify(query, limit);
    case "soundcloud":
      return searchSoundCloudTracks(query, limit);
    case "youtube":
      return searchYouTube(query, limit);
    default:
      return [];
  }
}

/** Which service a pasted link belongs to, or null for anything else. */
export function detectSource(url: string): SongSource | null {
  if (parseSpotifyTrackId(url)) return "spotify";
  if (parseYouTubeId(url)) return "youtube";
  if (isSoundCloudUrl(url)) return "soundcloud";
  return null;
}

export async function songFromLink(url: string): Promise<AuxSong | null> {
  const clean = url.trim();
  switch (detectSource(clean)) {
    case "spotify":
      return spotifySongFromLink(clean);
    case "youtube":
      return youtubeSongFromLink(clean);
    case "soundcloud":
      return soundcloudSongFromLink(clean);
    default:
      return null;
  }
}

/* ------------------------------------------------------------------
   Validation — the API never trusts a card the browser sends back
   ------------------------------------------------------------------ */

function str(v: unknown, max: number): v is string {
  return typeof v === "string" && v.length > 0 && v.length <= max;
}
function optStr(v: unknown, max: number): boolean {
  return v === null || v === undefined || (typeof v === "string" && v.length <= max);
}

export function isAuxSong(x: unknown): x is AuxSong {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  if (!SONG_SOURCES.includes(s.source as SongSource)) return false;
  if (!str(s.title, 200) || !str(s.url, 300) || !str(s.embed_id, 300)) return false;
  if (!optStr(s.artist, 120) || !optStr(s.artwork, 400)) return false;
  if (!/^https:\/\//.test(s.url as string)) return false;
  if (s.artwork && !/^https:\/\//.test(s.artwork as string)) return false;
  switch (s.source) {
    case "spotify":
      return /^[A-Za-z0-9]{22}$/.test(s.embed_id as string);
    case "youtube":
      return /^[A-Za-z0-9_-]{11}$/.test(s.embed_id as string);
    case "soundcloud":
      return /^https:\/\/soundcloud\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_./-]+$/.test(s.embed_id as string);
    default:
      return false;
  }
}

/** Strip a card down to exactly the fields we store — nothing extra rides along. */
export function cleanSong(s: AuxSong): AuxSong {
  return {
    source: s.source,
    title: s.title,
    artist: s.artist ?? null,
    artwork: s.artwork ?? null,
    url: s.url,
    embed_id: s.embed_id,
    ...(s.release_id ? { release_id: s.release_id, release_slug: s.release_slug ?? null } : {}),
  };
}
