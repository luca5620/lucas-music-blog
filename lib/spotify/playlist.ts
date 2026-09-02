/**
 * Spotify playlist read — SERVER ONLY.
 *
 * Powers "turn this playlist into a list": read the playlist's name +
 * tracks once and hand back plain rows (title / artist / album cover /
 * album id) for list_items. We deliberately do NOT import every album
 * into the catalog here — a 100-track playlist would mean 100 album
 * imports in one request. Items land with release_id null (list_items
 * allows it) plus a cover, which is all the list page needs.
 *
 * WHERE THE TRACKS COME FROM (verified 2026-09-02 with the app's own
 * credentials — see ROADMAP):
 *
 *  1. The official Web API first. Since Spotify's Feb 2026 API
 *     changes, a development-mode app with client credentials gets
 *     the playlist's name/owner/cover from GET /playlists/{id} but NO
 *     `tracks` object at all, and GET /playlists/{id}/tracks answers
 *     403 — items are only served to a user token that OWNS the
 *     playlist. We still ask, so the day Spotify opens it back up
 *     this path just starts working.
 *  2. Otherwise the public EMBED page. open.spotify.com/embed/playlist/
 *     {id} — the page the iframe on our post/profile renders in every
 *     visitor's browser — carries its tracklist (up to 100: title,
 *     artist line, track uri) in its Next.js page JSON. We read that
 *     same public page server-side. Unofficial: Spotify can reshape
 *     it any day, so the parser is defensive and a miss surfaces as a
 *     readable error instead of a crash. No credentials, no login,
 *     nothing private — only what the embed already shows.
 *  3. Covers: the embed rows carry no album art, so we enrich through
 *     GET /tracks?ids= (50 per call, still open to client
 *     credentials). Fails soft — a list with a few 💿 placeholders
 *     beats no list.
 *
 * Spotify-OWNED editorial playlists (RapCaviar, Today's Top Hits…) are
 * closed to third-party apps on BOTH routes — the API 404s and the
 * embed page has no tracklist — so those get a clear message.
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
  /** Which door the tracks came through — logged, and handy in the
      response while the API situation keeps shifting. */
  source: "api" | "embed";
}

/** Lists are for records, and a list page renders a poster grid — a
    thousand-row list is neither. 100 = what the embed page carries and
    Spotify's own API page size. */
export const PLAYLIST_IMPORT_CAP = 100;

export class PlaylistUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PlaylistUnavailableError";
  }
}

const EDITORIAL_MESSAGE =
  "Spotify won't share that playlist — it's private, deleted, or one of Spotify's own editorial playlists (those are closed to third-party apps). User-made playlists work.";

/* ------------------------------------------------------------------
   Shared shapes
   ------------------------------------------------------------------ */

interface SpotifyImage {
  url: string;
  width?: number | null;
}

/** Spotify returns 640 / 300 / 64. 300 is the poster size the list
    grid uses; fall back to whatever exists. */
function posterImage(images?: SpotifyImage[] | null): string | null {
  if (!images || images.length === 0) return null;
  const mid = images.find((i) => (i.width ?? 0) === 300);
  return (mid ?? images[0]).url ?? null;
}

/* ------------------------------------------------------------------
   Door 1 — the official API
   ------------------------------------------------------------------ */

interface ApiPlaylistResponse {
  id: string;
  name: string;
  description: string | null;
  owner?: { display_name?: string | null } | null;
  tracks?: {
    total: number;
    items: Array<{
      track: {
        name: string;
        artists: Array<{ name: string }>;
        album: { id: string; images?: SpotifyImage[] } | null;
        type?: string;
        is_local?: boolean;
      } | null;
    }>;
  };
}

async function readViaApi(
  playlistId: string
): Promise<{ meta: ApiPlaylistResponse; tracks: PlaylistTrackRow[] | null }> {
  const fields =
    "id,name,description,owner(display_name),tracks.total," +
    "tracks.items(track(name,type,is_local,artists(name),album(id,images)))";
  let raw: unknown;
  try {
    raw = await spotifyFetch(
      `/playlists/${playlistId}?fields=${encodeURIComponent(fields)}`
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404")) throw new PlaylistUnavailableError(EDITORIAL_MESSAGE);
    throw err;
  }
  const meta = raw as ApiPlaylistResponse;

  // No tracks object = the dev-mode wall. Signal "try the embed".
  if (!meta.tracks || !Array.isArray(meta.tracks.items)) {
    return { meta, tracks: null };
  }

  const tracks: PlaylistTrackRow[] = [];
  for (const item of meta.tracks.items) {
    const t = item?.track;
    if (!t || t.is_local || (t.type && t.type !== "track") || !t.name) continue;
    tracks.push({
      title: t.name.slice(0, 200),
      artist:
        (t.artists ?? []).map((a) => a.name).filter(Boolean).join(", ").slice(0, 200) ||
        "Unknown Artist",
      cover_image: posterImage(t.album?.images),
      album_spotify_id: t.album?.id ?? null,
    });
  }
  return { meta, tracks };
}

/* ------------------------------------------------------------------
   Door 2 — the public embed page
   ------------------------------------------------------------------ */

interface EmbedTrack {
  uri?: string;
  title?: string;
  /** The artist line as the player shows it ("Future", "A, B"). */
  subtitle?: string;
  entityType?: string;
}

interface EmbedEntity {
  name?: string;
  subtitle?: string;
  trackList?: EmbedTrack[];
}

async function readViaEmbed(
  playlistId: string
): Promise<{ name: string; owner: string | null; rows: Array<{ id: string | null; title: string; artist: string }> }> {
  const res = await fetch(`https://open.spotify.com/embed/playlist/${playlistId}`, {
    headers: {
      // A browser-shaped UA — the embed is a public page meant for
      // browsers, and it serves the same JSON to any of them.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new PlaylistUnavailableError(EDITORIAL_MESSAGE);
  }
  const html = await res.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match) {
    throw new PlaylistUnavailableError(
      "Couldn't read that playlist's tracks right now — Spotify changed its embed page. Try again later."
    );
  }

  let entity: EmbedEntity | undefined;
  try {
    const json = JSON.parse(match[1]) as {
      props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } };
    };
    entity = json.props?.pageProps?.state?.data?.entity;
  } catch {
    entity = undefined;
  }
  if (!entity) {
    throw new PlaylistUnavailableError(
      "Couldn't read that playlist's tracks right now — Spotify changed its embed page. Try again later."
    );
  }

  const rows = (entity.trackList ?? [])
    .filter((t) => (t.entityType ?? "track") === "track" && t.title)
    .slice(0, PLAYLIST_IMPORT_CAP)
    .map((t) => ({
      id: t.uri?.startsWith("spotify:track:") ? t.uri.slice("spotify:track:".length) : null,
      title: (t.title ?? "").slice(0, 200),
      artist: (t.subtitle ?? "").slice(0, 200) || "Unknown Artist",
    }));

  return {
    name: entity.name ?? "",
    owner: entity.subtitle ?? null,
    rows,
  };
}

/** Album id + cover per track. The batch endpoint (/tracks?ids=) is
    403 for client credentials since Feb 2026 while the single
    GET /tracks/{id} still answers (verified 2026-09-02), so this is
    one call per track, a few in flight at a time, under a time
    budget — spotifyFetch already backs off on 429. Anything that
    fails or runs out of time just leaves that cover empty. */
const COVER_CONCURRENCY = 5;
const COVER_TIME_BUDGET_MS = 12_000;

async function coversForTracks(
  ids: string[]
): Promise<Map<string, { cover: string | null; albumId: string | null }>> {
  const out = new Map<string, { cover: string | null; albumId: string | null }>();
  const started = Date.now();
  let next = 0;

  async function worker() {
    while (next < ids.length && Date.now() - started < COVER_TIME_BUDGET_MS) {
      const id = ids[next++];
      try {
        const t = (await spotifyFetch(`/tracks/${id}`)) as {
          album?: { id: string; images?: SpotifyImage[] } | null;
        };
        out.set(id, {
          cover: posterImage(t.album?.images),
          albumId: t.album?.id ?? null,
        });
      } catch (err) {
        console.warn(
          `playlist covers: ${id} failed —`,
          err instanceof Error ? err.message : err
        );
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(COVER_CONCURRENCY, ids.length) }, worker)
  );
  return out;
}

/* ------------------------------------------------------------------
   The one entry point
   ------------------------------------------------------------------ */

export async function fetchPlaylistSnapshot(
  playlistId: string
): Promise<PlaylistSnapshot> {
  if (!PLAYLIST_ID_RE.test(playlistId)) {
    throw new PlaylistUnavailableError("Invalid playlist id.");
  }

  // Door 1: the API (name/owner always; tracks only if Spotify lets us).
  const { meta, tracks: apiTracks } = await readViaApi(playlistId);
  if (apiTracks && apiTracks.length > 0) {
    return {
      id: meta.id,
      name: (meta.name || "Untitled playlist").slice(0, 120),
      description: meta.description ? meta.description.slice(0, 2000) : null,
      owner: meta.owner?.display_name ?? null,
      total: meta.tracks?.total ?? apiTracks.length,
      tracks: apiTracks.slice(0, PLAYLIST_IMPORT_CAP),
      source: "api",
    };
  }

  // Door 2: the embed page for the rows, then covers via the API.
  const embed = await readViaEmbed(playlistId);
  const ids = embed.rows.map((r) => r.id).filter((x): x is string => !!x);
  const covers = ids.length > 0 ? await coversForTracks(ids) : new Map();

  const tracks: PlaylistTrackRow[] = embed.rows.map((r) => {
    const c = r.id ? covers.get(r.id) : undefined;
    return {
      title: r.title,
      artist: r.artist,
      cover_image: c?.cover ?? null,
      album_spotify_id: c?.albumId ?? null,
    };
  });

  return {
    id: playlistId,
    name: (meta.name || embed.name || "Untitled playlist").slice(0, 120),
    description: meta.description ? meta.description.slice(0, 2000) : null,
    owner: meta.owner?.display_name ?? embed.owner ?? null,
    total: tracks.length,
    tracks,
    source: "embed",
  };
}
