/**
 * Unified catalog layer — Spotify + Genius + local DB.
 *
 * Search: one query fans out to
 *   1. the local releases table (already-imported stuff, instant),
 *   2. Spotify album search (canonical released catalog),
 *   3. Genius song search (deep catalog: unreleased, leaks, loosies).
 *
 * Import: `ensureRelease(source, id)` creates the release row on
 * demand the first time anyone reviews/lists it, via the
 * `catalog_import_release` SECURITY DEFINER function (insert-only,
 * server-validated — regular users never get table-level write
 * access to the catalog). Idempotent: re-ensuring returns the
 * existing row.
 */

import { createClient } from "@/lib/supabase/server";
import { spotifyFetch, slugify } from "@/lib/spotify-import";
import { searchReleases } from "@/lib/db/releases";
import {
  searchGeniusSongs,
  getGeniusSong,
  getGeniusAlbum,
  getGeniusAlbumTracks,
  geniusDateToIso,
  geniusConfigured,
} from "@/lib/genius";
import type { Release, ReleaseTrack } from "@/lib/types/database";

/* ---------------------------------------------------------------
   Search
   --------------------------------------------------------------- */

export interface CatalogResult {
  /** Where this result lives right now. Local = already in our DB.
      spotify = an album; spotify_track = a single track (importing
      it pulls in its parent album). */
  source: "local" | "spotify" | "spotify_track" | "genius";
  /** Source-specific id: release uuid, Spotify album/track id, or Genius song id. */
  id: string;
  title: string;
  artist: string;
  cover: string | null;
  year: string | null;
  kind: string; // "album" | "single" | "EP" | ... | "song"
  /** Present for local rows so the UI can deep-link immediately. */
  slug?: string;
  unreleased?: boolean;
}

interface SpotifyAlbumHit {
  id: string;
  name: string;
  album_type: "album" | "single" | "compilation";
  release_date?: string;
  total_tracks?: number;
  artists: { name: string }[];
  images?: { url: string; width: number | null }[];
}

async function searchSpotifyAlbums(
  query: string,
  limit = 8
): Promise<CatalogResult[]> {
  try {
    const raw = (await spotifyFetch(
      `/search?type=album&limit=${limit}&q=${encodeURIComponent(query)}`
    )) as { albums?: { items?: SpotifyAlbumHit[] } };

    return (raw.albums?.items ?? []).map((a) => ({
      source: "spotify" as const,
      id: a.id,
      title: a.name,
      artist: a.artists?.map((x) => x.name).join(", ") || "Unknown Artist",
      cover: a.images?.[0]?.url ?? null,
      year: a.release_date?.slice(0, 4) ?? null,
      kind: a.album_type === "single" && (a.total_tracks ?? 1) > 3 ? "EP" : a.album_type,
    }));
  } catch (err) {
    console.warn("Spotify search failed:", err instanceof Error ? err.message : err);
    return [];
  }
}

interface SpotifyTrackHit {
  id: string;
  name: string;
  artists: { name: string }[];
  album?: {
    images?: { url: string; width: number | null }[];
    release_date?: string;
  };
}

/**
 * Track-level Spotify search — the fix for "I typed a SONG name and
 * got nothing": album search only matches album titles, so deep cuts
 * like an album track were unfindable unless Genius surfaced them.
 */
async function searchSpotifyTracks(
  query: string,
  limit = 6
): Promise<CatalogResult[]> {
  try {
    const raw = (await spotifyFetch(
      `/search?type=track&limit=${limit}&q=${encodeURIComponent(query)}`
    )) as { tracks?: { items?: SpotifyTrackHit[] } };

    return (raw.tracks?.items ?? []).map((t) => ({
      source: "spotify_track" as const,
      id: t.id,
      title: t.name,
      artist: t.artists?.map((x) => x.name).join(", ") || "Unknown Artist",
      cover: t.album?.images?.[0]?.url ?? null,
      year: t.album?.release_date?.slice(0, 4) ?? null,
      kind: "song",
    }));
  } catch (err) {
    console.warn(
      "Spotify track search failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

async function searchGenius(query: string, limit = 8): Promise<CatalogResult[]> {
  const hits = await searchGeniusSongs(query, limit);
  return hits.map((h) => ({
    source: "genius" as const,
    id: String(h.id),
    title: h.title,
    artist: h.artist_names || h.primary_artist?.name || "Unknown Artist",
    cover: h.song_art_image_thumbnail_url ?? h.song_art_image_url ?? null,
    year: h.release_date_components?.year
      ? String(h.release_date_components.year)
      : null,
    kind: "song",
    unreleased: !h.release_date_components?.year,
  }));
}

async function searchLocal(query: string, limit = 6): Promise<CatalogResult[]> {
  type Row = Release & { artists: { name: string } | { name: string }[] | null };
  const rows = (await searchReleases(query, limit)) as Row[];
  return rows.map((r) => {
    const joined = Array.isArray(r.artists) ? r.artists[0] : r.artists;
    return {
      source: "local" as const,
      id: r.id,
      title: r.title,
      artist: joined?.name ?? "",
      cover: r.cover_image,
      year: r.release_date?.slice(0, 4) ?? null,
      kind: r.release_type,
      slug: r.slug,
      unreleased: r.is_unreleased,
    };
  });
}

/**
 * Fan out to all three sources. Spotify results that are already in
 * the local DB are deduped (local wins — it has a slug). Genius stays
 * separate because song-level hits complement album-level ones.
 */
export async function searchCatalog(query: string): Promise<{
  results: CatalogResult[];
  geniusEnabled: boolean;
}> {
  const [local, spotify, spotifyTracks, genius] = await Promise.all([
    searchLocal(query),
    searchSpotifyAlbums(query, 6),
    searchSpotifyTracks(query, 6),
    searchGenius(query, 6),
  ]);

  const supabase = await createClient();
  const spotifyIds = spotify.map((s) => s.id);
  const known = new Set<string>();
  if (spotifyIds.length > 0) {
    const { data } = await supabase
      .from("releases")
      .select("spotify_id")
      .in("spotify_id", spotifyIds);
    (data ?? []).forEach((r) => {
      const row = r as { spotify_id: string | null };
      if (row.spotify_id) known.add(row.spotify_id);
    });
  }

  return {
    // Order: what's already here, album matches, then song-level
    // matches (Spotify tracks + Genius) for "I typed a song name".
    results: [
      ...local,
      ...spotify.filter((s) => !known.has(s.id)),
      ...spotifyTracks,
      ...genius,
    ],
    geniusEnabled: geniusConfigured(),
  };
}

/* ---------------------------------------------------------------
   On-demand import
   --------------------------------------------------------------- */

interface ImportArtistPayload {
  slug: string;
  name: string;
  spotify_id?: string | null;
  genius_id?: string | null;
  image_url?: string | null;
  genres?: string[];
  popularity?: number | null;
  role: "primary" | "feature";
}

interface ImportPayload {
  release: {
    slug: string;
    title: string;
    release_type: string;
    release_date: string | null;
    cover_image: string | null;
    spotify_id?: string | null;
    genius_id?: string | null;
    is_unreleased: boolean;
    tracks: ReleaseTrack[];
    popularity?: number | null;
  };
  artists: ImportArtistPayload[];
}

async function importViaRpc(payload: ImportPayload): Promise<Release> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("catalog_import_release", {
    payload,
  } as never);

  if (error || !data) {
    throw new Error(`catalog import failed: ${error?.message ?? "no data"}`);
  }
  return data as Release;
}

interface SpotifyAlbumFull {
  id: string;
  name: string;
  album_type: "album" | "single" | "compilation";
  release_date?: string;
  release_date_precision?: "year" | "month" | "day";
  images?: { url: string; width: number | null }[];
  popularity?: number;
  artists: { id: string; name: string }[];
  tracks: {
    items: {
      id: string;
      name: string;
      track_number?: number;
      duration_ms: number;
      preview_url: string | null;
    }[];
  };
}

interface SpotifyArtistFull {
  id: string;
  name: string;
  images?: { url: string; width: number | null }[];
  genres?: string[];
  popularity?: number;
}

function coerceDate(date?: string, precision?: string): string | null {
  if (!date) return null;
  if (precision === "year") return `${date}-01-01`;
  if (precision === "month") return `${date}-01`;
  return date;
}

async function ensureFromSpotify(albumId: string): Promise<Release> {
  const album = (await spotifyFetch(`/albums/${albumId}`)) as SpotifyAlbumFull;

  // Full artist objects for images/genres (cap at 5 to bound latency).
  const artistRefs = (album.artists ?? []).slice(0, 5);
  const fullArtists = await Promise.all(
    artistRefs.map(async (a) => {
      try {
        return (await spotifyFetch(`/artists/${a.id}`)) as SpotifyArtistFull;
      } catch {
        return { id: a.id, name: a.name } as SpotifyArtistFull;
      }
    })
  );

  const releaseType =
    album.album_type === "single"
      ? album.tracks.items.length > 3
        ? "EP"
        : "single"
      : album.album_type;

  return importViaRpc({
    release: {
      slug: slugify(`${album.name}-${album.artists?.[0]?.name ?? ""}`) || `release-${albumId.slice(-6)}`,
      title: album.name,
      release_type: releaseType,
      release_date: coerceDate(album.release_date, album.release_date_precision),
      cover_image: album.images?.[0]?.url ?? null,
      spotify_id: album.id,
      is_unreleased: false,
      tracks: album.tracks.items.map((t, i) => ({
        position: t.track_number ?? i + 1,
        title: t.name,
        duration_ms: t.duration_ms,
        spotify_id: t.id,
        preview_url: t.preview_url ?? null,
      })),
      popularity: album.popularity ?? null,
    },
    artists: fullArtists.map((a, i) => ({
      slug: slugify(a.name) || `artist-${a.id.slice(-6)}`,
      name: a.name,
      spotify_id: a.id,
      image_url: a.images?.[0]?.url ?? null,
      genres: a.genres ?? [],
      popularity: a.popularity ?? null,
      role: i === 0 ? "primary" : "feature",
    })),
  });
}

async function ensureFromGenius(songId: number): Promise<Release> {
  const song = await getGeniusSong(songId);
  if (!song) throw new Error(`Genius song ${songId} not found`);

  // Song belongs to an album → import the whole album.
  if (song.album?.id) {
    const [album, tracks] = await Promise.all([
      getGeniusAlbum(song.album.id),
      getGeniusAlbumTracks(song.album.id),
    ]);

    const albumArtist = album?.artist ?? song.album.artist ?? song.primary_artist;
    const releaseDate = geniusDateToIso(album?.release_date_components);

    return importViaRpc({
      release: {
        slug:
          slugify(`${song.album.name}-${albumArtist?.name ?? ""}`) ||
          `release-g${song.album.id}`,
        title: album?.name ?? song.album.name,
        release_type: tracks.length > 0 && tracks.length <= 3 ? "EP" : "album",
        release_date: releaseDate,
        cover_image: album?.cover_art_url ?? song.album.cover_art_url ?? null,
        genius_id: `album:${song.album.id}`,
        is_unreleased: !releaseDate,
        tracks: tracks.map((t, i) => ({
          position: t.number ?? i + 1,
          title: t.song.title,
          duration_ms: 0,
        })),
      },
      artists: [
        {
          slug: slugify(albumArtist?.name ?? "") || `artist-g${albumArtist?.id ?? songId}`,
          name: albumArtist?.name ?? "Unknown Artist",
          genius_id: albumArtist ? String(albumArtist.id) : null,
          image_url: albumArtist?.image_url ?? null,
          role: "primary",
        },
      ],
    });
  }

  // No album → standalone single (this is the unreleased/loosie path).
  const releaseDate =
    song.release_date ?? geniusDateToIso(song.release_date_components);

  return importViaRpc({
    release: {
      slug:
        slugify(`${song.title}-${song.primary_artist?.name ?? ""}`) ||
        `song-g${song.id}`,
      title: song.title,
      release_type: "single",
      release_date: releaseDate,
      cover_image: song.song_art_image_url ?? null,
      genius_id: `song:${song.id}`,
      is_unreleased: !releaseDate,
      tracks: [{ position: 1, title: song.title, duration_ms: 0 }],
    },
    artists: [
      {
        slug:
          slugify(song.primary_artist?.name ?? "") ||
          `artist-g${song.primary_artist?.id ?? song.id}`,
        name: song.primary_artist?.name ?? "Unknown Artist",
        genius_id: song.primary_artist ? String(song.primary_artist.id) : null,
        image_url: song.primary_artist?.image_url ?? null,
        role: "primary",
      },
      ...(song.featured_artists ?? []).slice(0, 8).map((f) => ({
        slug: slugify(f.name) || `artist-g${f.id}`,
        name: f.name,
        genius_id: String(f.id),
        image_url: f.image_url ?? null,
        role: "feature" as const,
      })),
    ],
  });
}

/**
 * Make sure a release exists locally, importing it if needed.
 * `source` + `id` come straight from a CatalogResult.
 */
export async function ensureRelease(
  source: "local" | "spotify" | "spotify_track" | "genius",
  id: string
): Promise<Release> {
  if (source === "local") {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("releases")
      .select("*")
      .eq("id", id)
      .single();
    if (error || !data) throw new Error("Release not found");
    return data as Release;
  }

  if (source === "spotify") {
    if (!/^[A-Za-z0-9]{10,30}$/.test(id)) throw new Error("Bad Spotify id");
    return ensureFromSpotify(id);
  }

  if (source === "spotify_track") {
    // A track pick imports its PARENT ALBUM — the caller then chooses
    // the track from the release's tracklist (review standouts, song
    // of the day, profile song all work track-level off the release).
    if (!/^[A-Za-z0-9]{10,30}$/.test(id)) throw new Error("Bad Spotify id");
    const track = (await spotifyFetch(`/tracks/${id}`)) as {
      album?: { id?: string };
    };
    if (!track.album?.id) throw new Error("Track has no parent album");
    return ensureFromSpotify(track.album.id);
  }

  const songId = Number(id);
  if (!Number.isInteger(songId) || songId <= 0) throw new Error("Bad Genius id");
  return ensureFromGenius(songId);
}
