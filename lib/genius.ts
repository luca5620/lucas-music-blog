/**
 * Genius API client (server-only).
 *
 * Genius is the deep-catalog source: it knows unreleased/leaked
 * tracks, loosies, and obscure work that Spotify never gets. The
 * public API is song-centric — search returns songs, and a song
 * points at its album (if it has one).
 *
 * Auth: a single client access token in GENIUS_ACCESS_TOKEN
 * (free — generate at https://genius.com/api-clients). Every
 * helper here degrades to empty results if the token is missing
 * so the site keeps working while it isn't configured yet.
 */

const GENIUS_API = "https://api.genius.com";

export function geniusConfigured(): boolean {
  return !!process.env.GENIUS_ACCESS_TOKEN;
}

async function geniusFetch(path: string): Promise<unknown | null> {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  if (!token) return null;

  const res = await fetch(`${GENIUS_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });

  if (!res.ok) {
    // 404s are expected (e.g. album endpoints for songs without albums);
    // anything else we surface in logs but never crash the request.
    if (res.status !== 404) {
      const body = await res.text().catch(() => "");
      console.warn(`Genius ${res.status} for ${path}: ${body.slice(0, 300)}`);
    }
    return null;
  }

  return res.json();
}

/* ---------------------------------------------------------------
   Shapes — only the fields we actually read.
   --------------------------------------------------------------- */

export interface GeniusArtistRef {
  id: number;
  name: string;
  image_url?: string | null;
}

export interface GeniusSearchHit {
  id: number;
  title: string;
  artist_names: string;
  primary_artist: GeniusArtistRef;
  song_art_image_url?: string | null;
  song_art_image_thumbnail_url?: string | null;
  release_date_components?: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
}

export interface GeniusSong extends GeniusSearchHit {
  album?: {
    id: number;
    name: string;
    cover_art_url?: string | null;
    artist?: GeniusArtistRef;
  } | null;
  release_date?: string | null;
  featured_artists?: GeniusArtistRef[];
}

export interface GeniusAlbum {
  id: number;
  name: string;
  cover_art_url?: string | null;
  release_date_components?: {
    year: number | null;
    month: number | null;
    day: number | null;
  } | null;
  artist?: GeniusArtistRef;
}

export interface GeniusAlbumTrack {
  number: number | null;
  song: { id: number; title: string };
}

/* ---------------------------------------------------------------
   Public helpers
   --------------------------------------------------------------- */

/** Song search — Genius's only search modality. */
export async function searchGeniusSongs(
  query: string,
  limit = 8
): Promise<GeniusSearchHit[]> {
  const raw = await geniusFetch(`/search?q=${encodeURIComponent(query)}`);
  if (!raw) return [];

  const hits =
    (raw as { response?: { hits?: { type: string; result: GeniusSearchHit }[] } })
      .response?.hits ?? [];

  return hits
    .filter((h) => h.type === "song")
    .map((h) => h.result)
    .slice(0, limit);
}

export async function getGeniusSong(songId: number): Promise<GeniusSong | null> {
  const raw = await geniusFetch(`/songs/${songId}`);
  if (!raw) return null;
  return (raw as { response?: { song?: GeniusSong } }).response?.song ?? null;
}

/**
 * Album detail. Lightly documented endpoint but works with a client
 * token; callers must tolerate null. Currently unused — a Genius pick
 * imports the clicked song as a standalone single (see lib/catalog.ts).
 * Kept for a future "import the whole Genius album" feature.
 */
export async function getGeniusAlbum(albumId: number): Promise<GeniusAlbum | null> {
  const raw = await geniusFetch(`/albums/${albumId}`);
  if (!raw) return null;
  return (raw as { response?: { album?: GeniusAlbum } }).response?.album ?? null;
}

/** Album track list — same caveat as getGeniusAlbum. */
export async function getGeniusAlbumTracks(
  albumId: number
): Promise<GeniusAlbumTrack[]> {
  const raw = await geniusFetch(`/albums/${albumId}/tracks?per_page=50`);
  if (!raw) return [];
  return (
    (raw as { response?: { tracks?: GeniusAlbumTrack[] } }).response?.tracks ?? []
  );
}

/** "YYYY-MM-DD" from Genius date components, or null. */
export function geniusDateToIso(
  c?: { year: number | null; month: number | null; day: number | null } | null
): string | null {
  if (!c?.year) return null;
  const mm = String(c.month ?? 1).padStart(2, "0");
  const dd = String(c.day ?? 1).padStart(2, "0");
  return `${c.year}-${mm}-${dd}`;
}
