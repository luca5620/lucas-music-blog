/**
 * Apple Music — SERVER ONLY. Finds the Apple Music id for a release
 * and caches it (migration 036), so the release page can show Apple's
 * embed player to members who picked Apple Music in Settings.
 *
 * NO DEVELOPER KEY. Everything here is public:
 *   - Spotify's single-item endpoints (still open to client
 *     credentials — see lib/spotify/playlist.ts for what isn't) give
 *     the album's UPC / the track's ISRC.
 *   - Apple's public lookup, https://itunes.apple.com/lookup?upc=… /
 *     ?isrc=…, turns those into Apple Music ids. No token, no quota
 *     worth worrying about at our size (Apple documents ~20 calls/min
 *     per IP; we make at most two per release, ONCE).
 *   - When the code lookup misses (very new releases sometimes lag on
 *     Apple's side), a name search with an artist sanity check is the
 *     last resort. Genius/manual releases only ever have the name.
 *
 * The result is cached on the row through catalog_set_apple_music
 * (SECURITY DEFINER — members can't write releases directly). A miss
 * is cached too (checked_at set, id null) and retried after a week.
 *
 * Verified 2026-09-02 with a real album: Spotify /albums → upc
 * 196874557198 → Apple collectionId 6784327271 in one call.
 */

import { createClient } from "@/lib/supabase/server";
import { spotifyFetch } from "@/lib/spotify-import";
import type { Release, ReleaseTrack } from "@/lib/types/database";

export interface AppleMusicRef {
  albumId: string;
  /** Present for single-track releases — the embed opens on the song. */
  trackId?: string;
}

const RECHECK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;
const ITUNES = "https://itunes.apple.com";

/* ------------------------------------------------------------------
   Parsing the cached value
   ------------------------------------------------------------------ */

export function parseAppleMusicId(raw: string | null | undefined): AppleMusicRef | null {
  if (!raw) return null;
  const m = raw.match(/^([0-9]{1,20})(?::([0-9]{1,20}))?$/);
  if (!m) return null;
  return m[2] ? { albumId: m[1], trackId: m[2] } : { albumId: m[1] };
}

function serialize(ref: AppleMusicRef): string {
  return ref.trackId ? `${ref.albumId}:${ref.trackId}` : ref.albumId;
}

/** Public Apple Music embed src — the ONLY iframe src we build. */
export function appleMusicEmbedSrc(ref: AppleMusicRef): string {
  const base = `https://embed.music.apple.com/us/album/${ref.albumId}`;
  return ref.trackId ? `${base}?i=${ref.trackId}&theme=dark` : `${base}?theme=dark`;
}

export function appleMusicUrl(ref: AppleMusicRef): string {
  const base = `https://music.apple.com/us/album/${ref.albumId}`;
  return ref.trackId ? `${base}?i=${ref.trackId}` : base;
}

/* ------------------------------------------------------------------
   Apple's public lookup / search
   ------------------------------------------------------------------ */

interface ItunesResult {
  wrapperType?: string;
  collectionType?: string;
  collectionId?: number;
  trackId?: number;
  artistName?: string;
  collectionName?: string;
  trackName?: string;
}

async function itunes(path: string): Promise<ItunesResult[]> {
  const res = await fetch(`${ITUNES}${path}`, {
    // Apple caches aggressively anyway; we cache the ANSWER in our DB.
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) return [];
  const data = (await res.json().catch(() => null)) as
    | { results?: ItunesResult[] }
    | null;
  return data?.results ?? [];
}

/** Loose name match: lowercase, strip punctuation/feat/deluxe noise. */
function norm(s: string | undefined | null): string {
  return (s ?? "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/\b(feat|ft|featuring|deluxe|edition|explicit|remastered)\b.*$/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function artistMatches(candidate: string | undefined, artist: string): boolean {
  const a = norm(artist);
  const c = norm(candidate);
  if (!a || !c) return false;
  // "Future" vs "Future & Metro Boomin", "Drake" vs "Drake" — the
  // first credited name has to be in there.
  const first = a.split(" ")[0];
  return c.includes(a) || a.includes(c) || (first.length > 2 && c.includes(first));
}

function titleMatches(candidate: string | undefined, title: string): boolean {
  const t = norm(title);
  const c = norm(candidate);
  if (!t || !c) return false;
  return c === t || c.startsWith(t) || t.startsWith(c);
}

/* ------------------------------------------------------------------
   The lookup itself
   ------------------------------------------------------------------ */

async function lookupAlbum(
  release: Release,
  artistName: string
): Promise<AppleMusicRef | null> {
  // 1. By UPC, when Spotify knows the album.
  if (release.spotify_id) {
    try {
      const album = (await spotifyFetch(`/albums/${release.spotify_id}`)) as {
        external_ids?: { upc?: string };
      };
      const upc = album.external_ids?.upc?.replace(/\D/g, "");
      if (upc) {
        const hits = await itunes(`/lookup?upc=${upc}&entity=album&country=us`);
        const album = hits.find((h) => h.wrapperType === "collection" && h.collectionId);
        if (album?.collectionId) return { albumId: String(album.collectionId) };
      }
    } catch (err) {
      console.warn("apple-music: upc path failed —", err instanceof Error ? err.message : err);
    }
  }

  // 2. By name, with an artist sanity check so a common title never
  // lands on the wrong record.
  const term = encodeURIComponent(`${artistName} ${release.title}`);
  const hits = await itunes(`/search?term=${term}&entity=album&limit=8&country=us`);
  const match = hits.find(
    (h) =>
      h.collectionId &&
      artistMatches(h.artistName, artistName) &&
      titleMatches(h.collectionName, release.title)
  );
  return match?.collectionId ? { albumId: String(match.collectionId) } : null;
}

async function lookupTrack(
  release: Release,
  artistName: string,
  track: ReleaseTrack
): Promise<AppleMusicRef | null> {
  // 1. By ISRC, when Spotify knows the track.
  if (track.spotify_id) {
    try {
      const t = (await spotifyFetch(`/tracks/${track.spotify_id}`)) as {
        external_ids?: { isrc?: string };
      };
      const isrc = t.external_ids?.isrc?.trim();
      if (isrc) {
        const hits = await itunes(`/lookup?isrc=${encodeURIComponent(isrc)}&entity=song&country=us`);
        const song = hits.find((h) => h.wrapperType === "track" && h.trackId && h.collectionId);
        if (song?.trackId && song.collectionId) {
          return { albumId: String(song.collectionId), trackId: String(song.trackId) };
        }
      }
    } catch (err) {
      console.warn("apple-music: isrc path failed —", err instanceof Error ? err.message : err);
    }
  }

  // 2. By name.
  const term = encodeURIComponent(`${artistName} ${track.title || release.title}`);
  const hits = await itunes(`/search?term=${term}&entity=song&limit=8&country=us`);
  const match = hits.find(
    (h) =>
      h.trackId &&
      h.collectionId &&
      artistMatches(h.artistName, artistName) &&
      titleMatches(h.trackName, track.title || release.title)
  );
  return match?.trackId && match.collectionId
    ? { albumId: String(match.collectionId), trackId: String(match.trackId) }
    : null;
}

/**
 * The Apple Music ref for a release — cached, or resolved now and
 * cached. Returns null when Apple doesn't carry it (or the lookup
 * failed; a miss is remembered for a week). Never throws.
 */
export async function resolveAppleMusic(
  release: Release,
  artistName: string
): Promise<AppleMusicRef | null> {
  const cached = parseAppleMusicId(release.apple_music_id);
  if (cached) return cached;

  // Recent miss — don't ask Apple again yet.
  if (release.apple_music_checked_at) {
    const age = Date.now() - new Date(release.apple_music_checked_at).getTime();
    if (age < RECHECK_AFTER_MS) return null;
  }

  const tracks = (release.tracks ?? []) as ReleaseTrack[];
  const isSingleTrack =
    tracks.length === 1 && !!release.spotify_id && tracks[0]?.spotify_id === release.spotify_id;

  let ref: AppleMusicRef | null = null;
  try {
    ref = isSingleTrack
      ? await lookupTrack(release, artistName, tracks[0])
      : await lookupAlbum(release, artistName);
  } catch (err) {
    console.warn("apple-music: lookup failed —", err instanceof Error ? err.message : err);
    ref = null;
  }

  // Cache hit or miss. Fails soft — a cache miss just means we look
  // again next time.
  try {
    const supabase = await createClient();
    await supabase.rpc("catalog_set_apple_music", {
      p_release_id: release.id,
      p_apple_id: ref ? serialize(ref) : null,
    } as never);
  } catch (err) {
    console.warn("apple-music: cache write failed —", err instanceof Error ? err.message : err);
  }

  return ref;
}
