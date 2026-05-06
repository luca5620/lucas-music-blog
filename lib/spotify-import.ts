/**
 * Spotify import pipeline.
 *
 * Two main entry points:
 *  - importArtistFromSpotify(spotifyId)  -> Artist
 *  - importReleaseFromSpotify(spotifyId) -> Release
 *
 * Both are idempotent thanks to `upsertArtist` / `upsertRelease` keying
 * on `spotify_id`. All DB writes go through the helpers in `lib/db/*` —
 * we never touch supabase directly here so RLS / policy logic stays
 * single-sourced. The caller (`/api/admin/import`) is responsible for
 * verifying the user is owner/admin before invoking these.
 */

import { getSpotifyToken } from "@/lib/spotify/auth";
import {
  getArtistBySlug,
  upsertArtist,
} from "@/lib/db/artists";
import {
  attachReleaseArtists,
  getReleaseBySlug,
  upsertRelease,
} from "@/lib/db/releases";
import type {
  Artist,
  Release,
  ReleaseTrack,
} from "@/lib/types/database";

const SPOTIFY_API = "https://api.spotify.com/v1";
const VARIOUS_ARTISTS_ID = "0LyfQWJT6nXafLPZqxe9Of";

// ---------------------------------------------------------------------------
// Slug helper
// ---------------------------------------------------------------------------

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "") // strip diacritics
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ---------------------------------------------------------------------------
// HTTP helper with 429 backoff
// ---------------------------------------------------------------------------

async function spotifyFetch(path: string): Promise<unknown> {
  const url = path.startsWith("http") ? path : `${SPOTIFY_API}${path}`;
  const maxRetries = 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const token = await getSpotifyToken();
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (res.status === 429 && attempt < maxRetries) {
      const retryAfterRaw = res.headers.get("retry-after");
      const retryAfter = retryAfterRaw ? Number(retryAfterRaw) : NaN;
      const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : (attempt + 1) * 1000;
      await new Promise((r) => setTimeout(r, delayMs));
      continue;
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(
        `Spotify ${res.status} for ${path}: ${body.slice(0, 500)}`
      );
    }

    return res.json();
  }

  throw new Error(`Spotify request to ${path} exhausted retries`);
}

// ---------------------------------------------------------------------------
// Artist import
// ---------------------------------------------------------------------------

interface SpotifyImage {
  url: string;
  height: number | null;
  width: number | null;
}

interface SpotifyArtistResponse {
  id: string;
  name: string;
  images?: SpotifyImage[];
  genres?: string[];
  popularity?: number;
}

interface SpotifyAlbumArtistRef {
  id: string;
  name: string;
}

interface SpotifyAlbumTrack {
  id: string;
  name: string;
  track_number?: number;
  duration_ms: number;
  preview_url: string | null;
  artists: SpotifyAlbumArtistRef[];
}

interface SpotifyAlbumResponse {
  id: string;
  name: string;
  album_type: "album" | "single" | "compilation";
  release_date: string;
  release_date_precision: "year" | "month" | "day";
  images?: SpotifyImage[];
  popularity?: number;
  artists: SpotifyAlbumArtistRef[];
  tracks: { items: SpotifyAlbumTrack[] };
}

function pickLargestImage(images?: SpotifyImage[]): string | null {
  if (!images || images.length === 0) return null;
  const sorted = [...images].sort(
    (a, b) => (b.width ?? 0) - (a.width ?? 0)
  );
  return sorted[0]?.url ?? null;
}

/**
 * Build a unique slug. If a *different* row already owns the base slug,
 * suffix with the last 4 chars of the spotify ID to disambiguate.
 */
async function resolveArtistSlug(
  base: string,
  spotifyId: string
): Promise<string> {
  const candidate = base || `artist-${spotifyId.slice(-4)}`;
  const existing = await getArtistBySlug(candidate);
  if (!existing) return candidate;
  if (existing.spotify_id === spotifyId) return candidate; // we own it
  return `${candidate}-${spotifyId.slice(-4)}`;
}

async function resolveReleaseSlug(
  base: string,
  spotifyId: string
): Promise<string> {
  const candidate = base || `release-${spotifyId.slice(-4)}`;
  const existing = await getReleaseBySlug(candidate);
  if (!existing) return candidate;
  if (existing.spotify_id === spotifyId) return candidate;
  return `${candidate}-${spotifyId.slice(-4)}`;
}

export async function importArtistFromSpotify(
  spotifyId: string
): Promise<Artist> {
  if (!spotifyId) throw new Error("importArtistFromSpotify: spotifyId required");

  let raw: unknown;
  try {
    raw = await spotifyFetch(`/artists/${spotifyId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) {
      throw new Error(`Spotify artist not found: ${spotifyId}`);
    }
    throw err;
  }

  const data = raw as SpotifyArtistResponse;
  const name = data.name?.trim() || "Unknown Artist";
  const baseSlug = slugify(name);
  const slug = await resolveArtistSlug(baseSlug, spotifyId);

  return upsertArtist({
    slug,
    name,
    spotify_id: spotifyId,
    image_url: pickLargestImage(data.images),
    bio: null,
    genres: data.genres ?? [],
    popularity: typeof data.popularity === "number" ? data.popularity : null,
  });
}

// ---------------------------------------------------------------------------
// Release import
// ---------------------------------------------------------------------------

function coerceReleaseDate(
  date: string,
  precision: "year" | "month" | "day"
): string {
  if (precision === "year") return `${date}-01-01`;
  if (precision === "month") return `${date}-01`;
  return date;
}

function mapAlbumType(
  albumType: SpotifyAlbumResponse["album_type"]
): Release["release_type"] {
  switch (albumType) {
    case "single":
      return "single";
    case "compilation":
      return "compilation";
    case "album":
    default:
      return "album";
  }
}

export async function importReleaseFromSpotify(
  spotifyId: string
): Promise<Release> {
  if (!spotifyId) throw new Error("importReleaseFromSpotify: spotifyId required");

  let raw: unknown;
  try {
    raw = await spotifyFetch(`/albums/${spotifyId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) {
      throw new Error(`Spotify album not found: ${spotifyId}`);
    }
    throw err;
  }

  const album = raw as SpotifyAlbumResponse;

  // Reject Various Artists compilations — they pollute the artist table.
  if (album.artists?.[0]?.id === VARIOUS_ARTISTS_ID) {
    throw new Error(
      "Refusing to import Various Artists compilation — these aren't real artist entities"
    );
  }

  if (!album.artists || album.artists.length === 0) {
    throw new Error(`Spotify album ${spotifyId} has no artists attached`);
  }

  // 1. Import every album-level artist (sequential — usually 1-2).
  const albumArtistRows: Artist[] = [];
  for (const a of album.artists) {
    const row = await importArtistFromSpotify(a.id);
    albumArtistRows.push(row);
  }
  const primaryArtist = albumArtistRows[0];

  // 2. Build tracks jsonb.
  const tracks: ReleaseTrack[] = album.tracks.items.map((t, i) => ({
    position: t.track_number ?? i + 1,
    title: t.name,
    duration_ms: t.duration_ms,
    spotify_id: t.id,
    preview_url: t.preview_url ?? null,
  }));

  // 3. Build slug.
  const baseSlug = slugify(`${album.name}-${primaryArtist.name}`);
  const slug = await resolveReleaseSlug(baseSlug, spotifyId);

  // 4. Coerce release_date.
  const releaseDate = album.release_date
    ? coerceReleaseDate(album.release_date, album.release_date_precision)
    : null;

  // 5. Upsert release.
  const release = await upsertRelease({
    slug,
    title: album.name,
    primary_artist_id: primaryArtist.id,
    release_type: mapAlbumType(album.album_type),
    release_date: releaseDate,
    cover_image: pickLargestImage(album.images),
    spotify_id: spotifyId,
    description: null,
    tracks,
    popularity: typeof album.popularity === "number" ? album.popularity : null,
  });

  // 6. Attach album-level artists. First = primary, rest = feature.
  const albumArtistAttachments = albumArtistRows.map((row, i) => ({
    artistId: row.id,
    role: (i === 0 ? "primary" : "feature") as "primary" | "feature",
    position: i,
  }));
  await attachReleaseArtists(release.id, albumArtistAttachments);

  // 7. Feature scan — track-level artists not already attached.
  const albumArtistSpotifyIds = new Set(album.artists.map((a) => a.id));
  const seenFeatures = new Set<string>();
  type FeatureCandidate = { spotifyId: string; name: string };
  const featureCandidates: FeatureCandidate[] = [];

  for (const t of album.tracks.items) {
    for (const a of t.artists) {
      if (albumArtistSpotifyIds.has(a.id)) continue;
      if (seenFeatures.has(a.id)) continue;
      seenFeatures.add(a.id);
      featureCandidates.push({ spotifyId: a.id, name: a.name });
    }
  }

  let featurePosition = albumArtistAttachments.length;
  for (const candidate of featureCandidates) {
    try {
      const artistRow = await importArtistFromSpotify(candidate.spotifyId);
      await attachReleaseArtists(release.id, [
        {
          artistId: artistRow.id,
          role: "feature",
          position: featurePosition++,
        },
      ]);
    } catch (err) {
      // Don't abort the whole import for a flaky feature artist.
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `Feature import skipped: ${candidate.name} (${candidate.spotifyId}) — ${msg}`
      );
    }
  }

  return release;
}

// ---------------------------------------------------------------------------
// Track import — resolves to the track's parent album, then imports it.
// We don't store individual tracks as their own entity (Phase 2a stores
// tracks as jsonb on the release); a track URL is just a friendlier way
// for users to point at the release that contains it.
// ---------------------------------------------------------------------------

interface SpotifyTrackResponse {
  id: string;
  name: string;
  album: { id: string };
}

export async function importReleaseFromTrack(
  trackId: string
): Promise<Release> {
  if (!trackId) throw new Error("importReleaseFromTrack: trackId required");

  let raw: unknown;
  try {
    raw = await spotifyFetch(`/tracks/${trackId}`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) {
      throw new Error(`Spotify track not found: ${trackId}`);
    }
    throw err;
  }

  const track = raw as SpotifyTrackResponse;
  if (!track.album?.id) {
    throw new Error(`Spotify track ${trackId} has no parent album`);
  }

  return importReleaseFromSpotify(track.album.id);
}
