/**
 * Spotify playlist fetch — SERVER ONLY (uses the client-credentials
 * token from lib/spotify/auth.ts).
 *
 * Powers "turn this playlist into a list": we read the playlist's
 * name + tracks once and hand back plain rows (title / artist / album
 * cover / album id) for list_items. We deliberately do NOT import
 * every album into the catalog here — a 100-track playlist would mean
 * 100 Spotify album imports in one request. Items land with
 * release_id null (list_items allows it) plus a cover, which is all
 * the list page needs to render.
 *
 * Known ceiling (Spotify, Nov 2024): apps in development mode can no
 * longer read Spotify-OWNED editorial playlists (RapCaviar, Today's
 * Top Hits, "Made for you" mixes) — those 404. User-made playlists,
 * which is what people actually share, work. We turn that 404 into a
 * readable message.
 */

import { spotifyFetch } from "@/lib/spotify-import";
import { PLAYLIST_ID_RE } from "@/lib/playlist";

export interface PlaylistTrackRow {
  title: string;
  artist: string;
  cover_image: string | null;
  /** Spotify ALBUM id — lets a later pass link the item to a catalog
      release without re-reading the playlist. */
  album_spotify_id: string | null;
}

export interface PlaylistSnapshot {
  id: string;
  name: string;
  description: string | null;
  owner: string | null;
  total: number;
  tracks: PlaylistTrackRow[];
}

/** Lists are for records, and a list page renders a poster grid — a
    thousand-row list is neither. 100 = Spotify's own page size. */
export const PLAYLIST_IMPORT_CAP = 100;

interface SpotifyImage {
  url: string;
  width?: number | null;
}

interface SpotifyPlaylistResponse {
  id: string;
  name: string;
  description: string | null;
  owner?: { display_name?: string | null } | null;
  tracks: {
    total: number;
    items: Array<{
      track: {
        name: string;
        artists: Array<{ name: string }>;
        album: { id: string; images?: SpotifyImage[] } | null;
        // Local files and podcast episodes have no album / are not
        // tracks — both get skipped below.
        type?: string;
        is_local?: boolean;
      } | null;
    }>;
  };
}

function smallestUsable(images?: SpotifyImage[]): string | null {
  if (!images || images.length === 0) return null;
  // Spotify returns 640 / 300 / 64. 300 is the poster size the list
  // grid uses; fall back to whatever exists.
  const mid = images.find((i) => (i.width ?? 0) === 300);
  return (mid ?? images[0]).url ?? null;
}

export async function fetchPlaylistSnapshot(
  playlistId: string
): Promise<PlaylistSnapshot> {
  if (!PLAYLIST_ID_RE.test(playlistId)) {
    throw new Error("Invalid playlist id.");
  }

  // fields= trims the payload to what we render; limit=100 is the
  // first (and only) page we take — see PLAYLIST_IMPORT_CAP.
  const fields =
    "id,name,description,owner(display_name),tracks.total," +
    "tracks.items(track(name,type,is_local,artists(name),album(id,images)))";
  let raw: unknown;
  try {
    raw = await spotifyFetch(
      `/playlists/${playlistId}?fields=${encodeURIComponent(fields)}&limit=${PLAYLIST_IMPORT_CAP}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) {
      throw new Error(
        "Spotify won't share that playlist — it's private, deleted, or one of Spotify's own editorial playlists (those are closed to third-party apps). User-made playlists work."
      );
    }
    throw err;
  }

  const data = raw as SpotifyPlaylistResponse;
  const tracks: PlaylistTrackRow[] = [];
  for (const item of data.tracks?.items ?? []) {
    const t = item?.track;
    if (!t || t.is_local || (t.type && t.type !== "track")) continue;
    if (!t.name) continue;
    tracks.push({
      title: t.name.slice(0, 200),
      artist: (t.artists ?? []).map((a) => a.name).filter(Boolean).join(", ").slice(0, 200) || "Unknown Artist",
      cover_image: smallestUsable(t.album?.images ?? undefined),
      album_spotify_id: t.album?.id ?? null,
    });
  }

  return {
    id: data.id,
    name: (data.name || "Untitled playlist").slice(0, 120),
    description: data.description ? data.description.slice(0, 2000) : null,
    owner: data.owner?.display_name ?? null,
    total: data.tracks?.total ?? tracks.length,
    tracks,
  };
}
