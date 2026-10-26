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
import { searchReleases, getReleaseBySpotifyId } from "@/lib/db/releases";
import { getArtistById } from "@/lib/db/artists";
import { isUpcoming } from "@/lib/upcoming";
import {
  searchGeniusSongs,
  getGeniusSong,
  geniusDateToIso,
  geniusConfigured,
} from "@/lib/genius";
import { foldText, matchScore, artistMatches } from "@/lib/catalog-rank";
import type { Release, ReleaseTrack } from "@/lib/types/database";

/* ---------------------------------------------------------------
   Search
   --------------------------------------------------------------- */

export interface CatalogResult {
  /** Where this result lives right now. Local = already in our DB.
      spotify = an album; spotify_track = a single track (imported as
      a standalone single-track release, like Genius songs). */
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
  /** Release date is in the future — a countdown/pre-save album. */
  upcoming?: boolean;
  /** Community average for local rows (null = no published reviews
      yet) — the pick UI shows it labeled "community avg". */
  avg_rating?: number | null;
  /** Track count for albums/EPs — two editions of the same record
      ("Rappels" vs "Rappels 1 + 2") are told apart by this. */
  tracks?: number;
  /** For song results: the record the song is on. */
  album?: string;
  /** Local rows: the Spotify id the row was imported from (the preview
      player reads it). */
  spotify_id?: string | null;
}

/** An artist result. Tapping one opens their discography. */
export interface CatalogArtist {
  /** Spotify artist id. */
  id: string;
  name: string;
  image: string | null;
  genres: string[];
}

/* ---------------------------------------------------------------
   Spotify link paste — the door for UPCOMING albums.

   Spotify's search API hides albums that haven't dropped yet, but
   GET /albums/{id} happily returns them (full tracklist, cover,
   future release_date) — verified against a real countdown album.
   So the way to get a pre-release album onto the platform is:
   paste its Spotify link into the catalog search. We detect the
   link, resolve it directly, and hand back a single result.
   --------------------------------------------------------------- */

export interface SpotifyLinkRef {
  kind: "album" | "track" | "prerelease";
  id: string;
}

/**
 * Recognize a pasted Spotify link/URI. Handles:
 *   https://open.spotify.com/album/{id}   (+ /intl-xx/ paths, ?si= params)
 *   https://open.spotify.com/track/{id}
 *   https://open.spotify.com/prerelease/{id}  (countdown page — see below)
 *   spotify:album:{id} / spotify:track:{id}
 * Returns null for anything that isn't a Spotify link.
 */
export function parseSpotifyLink(raw: string): SpotifyLinkRef | null {
  const q = raw.trim();

  // spotify:album:xyz URI form
  const uri = q.match(/^spotify:(album|track):([A-Za-z0-9]{10,30})$/);
  if (uri) return { kind: uri[1] as "album" | "track", id: uri[2] };

  if (!/^https?:\/\/(open\.)?spotify\.com\//i.test(q)) return null;

  const path = q.match(
    /spotify\.com\/(?:intl-[a-z-]+\/)?(album|track|prerelease)\/([A-Za-z0-9]{10,30})/i
  );
  if (!path) return null;
  return { kind: path[1].toLowerCase() as SpotifyLinkRef["kind"], id: path[2] };
}

/**
 * Resolve a pasted link straight to catalog results — no text search.
 * Already-imported rows come back as `local` (they have a slug); fresh
 * ones come back as spotify/spotify_track picks that import on click.
 */
async function resolveSpotifyLink(
  ref: SpotifyLinkRef
): Promise<{ results: CatalogResult[]; notice?: string }> {
  // Countdown pages (/prerelease/…) use their own id namespace that the
  // public API can't look up — only the real album link works here.
  if (ref.kind === "prerelease") {
    return {
      results: [],
      notice:
        "That's a Spotify countdown link, which can't be read directly. Open the ARTIST's Spotify page, find the upcoming album in their discography, and share/copy that album link here instead.",
    };
  }

  // Already on PMR? Hand back the local row (it deep-links via slug).
  const existing = await getReleaseBySpotifyId(ref.id);
  if (existing) {
    return {
      results: [
        {
          source: "local",
          id: existing.id,
          title: existing.title,
          artist: (await getArtistById(existing.primary_artist_id))?.name ?? "",
          cover: existing.cover_image,
          year: existing.release_date?.slice(0, 4) ?? null,
          kind: existing.release_type,
          slug: existing.slug,
          unreleased: existing.is_unreleased,
          upcoming: isUpcoming(existing.release_date, existing),
        },
      ],
    };
  }

  if (ref.kind === "album") {
    const album = (await spotifyFetch(`/albums/${ref.id}`)) as SpotifyAlbumFull;
    return {
      results: [
        {
          source: "spotify",
          id: album.id,
          title: album.name,
          artist:
            album.artists?.map((x) => x.name).join(", ") || "Unknown Artist",
          cover: album.images?.[0]?.url ?? null,
          year: album.release_date?.slice(0, 4) ?? null,
          kind:
            album.album_type === "single" && album.tracks.items.length > 3
              ? "EP"
              : album.album_type,
          tracks: album.tracks.items.length,
          upcoming: isUpcoming(album.release_date ?? null),
        },
      ],
    };
  }

  // track link
  const track = (await spotifyFetch(`/tracks/${ref.id}`)) as SpotifyTrackFull;
  return {
    results: [
      {
        source: "spotify_track",
        id: track.id,
        title: track.name,
        artist:
          track.artists?.map((x) => x.name).join(", ") || "Unknown Artist",
        cover: track.album?.images?.[0]?.url ?? null,
        year: track.album?.release_date?.slice(0, 4) ?? null,
        kind: "song",
        upcoming: isUpcoming(track.album?.release_date ?? null),
      },
    ],
  };
}

interface SpotifyAlbumHit {
  id: string;
  name: string;
  album_type: "album" | "single" | "compilation";
  release_date?: string;
  total_tracks?: number;
  artists: { id?: string; name: string }[];
  images?: { url: string; width: number | null }[];
}

/** Spotify album → result row. Shared by search and discographies. */
function albumHitToResult(a: SpotifyAlbumHit): CatalogResult {
  return {
    source: "spotify",
    id: a.id,
    title: a.name,
    artist: a.artists?.map((x) => x.name).join(", ") || "Unknown Artist",
    cover: a.images?.[0]?.url ?? null,
    year: a.release_date?.slice(0, 4) ?? null,
    kind: a.album_type === "single" && (a.total_tracks ?? 1) > 3 ? "EP" : a.album_type,
    tracks: a.total_tracks ?? undefined,
    upcoming: isUpcoming(a.release_date ?? null),
  };
}

// Spotify caps search pages at 10 for apps in development mode (asking
// for more is a 400 "Invalid limit") — every limit below stays ≤ 10.
async function searchSpotifyAlbums(
  query: string,
  limit = 10
): Promise<CatalogResult[]> {
  try {
    const raw = (await spotifyFetch(
      `/search?type=album&limit=${limit}&q=${encodeURIComponent(query)}`
    )) as { albums?: { items?: (SpotifyAlbumHit | null)[] } };

    return (raw.albums?.items ?? [])
      .filter((a): a is SpotifyAlbumHit => !!a)
      .map(albumHitToResult);
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
    name?: string;
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
  limit = 10
): Promise<CatalogResult[]> {
  try {
    const raw = (await spotifyFetch(
      `/search?type=track&limit=${limit}&q=${encodeURIComponent(query)}`
    )) as { tracks?: { items?: (SpotifyTrackHit | null)[] } };

    return (raw.tracks?.items ?? [])
      .filter((t): t is SpotifyTrackHit => !!t)
      .map((t) => ({
        source: "spotify_track" as const,
        id: t.id,
        title: t.name,
        artist: t.artists?.map((x) => x.name).join(", ") || "Unknown Artist",
        cover: t.album?.images?.[0]?.url ?? null,
        year: t.album?.release_date?.slice(0, 4) ?? null,
        kind: "song",
        // Which record the song is on — "La bombe humaine" exists on
        // six Téléphone records; this line is how you tell them apart.
        album: t.album?.name,
      }));
  } catch (err) {
    console.warn(
      "Spotify track search failed:",
      err instanceof Error ? err.message : err
    );
    return [];
  }
}

interface SpotifyArtistHit {
  id: string;
  name: string;
  images?: { url: string; width: number | null }[];
  genres?: string[];
}

/**
 * Artist search — "find by artist" (Luca 2026-10-22). An artist result
 * in the picker opens that artist's discography right there, so you can
 * scroll their records instead of guessing the album's exact name.
 * Loosely related names Spotify pads the answer with are dropped (see
 * artistMatches).
 */
async function searchSpotifyArtists(
  query: string,
  limit = 6
): Promise<CatalogArtist[]> {
  try {
    const raw = (await spotifyFetch(
      `/search?type=artist&limit=${limit}&q=${encodeURIComponent(query)}`
    )) as { artists?: { items?: (SpotifyArtistHit | null)[] } };

    return (raw.artists?.items ?? [])
      .filter((a): a is SpotifyArtistHit => !!a && artistMatches(query, a.name))
      .slice(0, 4)
      .map((a) => ({
        id: a.id,
        name: a.name,
        // Smallest image that's still ≥ 160px — the row thumb is tiny.
        image:
          [...(a.images ?? [])].reverse().find((i) => (i.width ?? 0) >= 160)?.url ??
          a.images?.[0]?.url ??
          null,
        genres: (a.genres ?? []).slice(0, 2),
      }));
  } catch (err) {
    console.warn(
      "Spotify artist search failed:",
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

type LocalRow = Release & {
  artists: { name: string } | { name: string }[] | null;
};

/** Local rows → results, with the community average batched in. */
async function localRowsToResults(rows: LocalRow[]): Promise<CatalogResult[]> {
  // One batched query for the community averages of every hit —
  // cheaper than one get_release_stats RPC per row. Ratings are
  // garnish: any failure here must never sink the search itself.
  const avgByRelease = new Map<string, { sum: number; n: number }>();
  if (rows.length > 0) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("reviews")
        .select("release_id, rating")
        .eq("is_published", true)
        .in(
          "release_id",
          rows.map((r) => r.id)
        );
      ((data ?? []) as { release_id: string | null; rating: number }[]).forEach(
        (rev) => {
          if (!rev.release_id) return;
          const acc = avgByRelease.get(rev.release_id) ?? { sum: 0, n: 0 };
          acc.sum += rev.rating;
          acc.n += 1;
          avgByRelease.set(rev.release_id, acc);
        }
      );
    } catch {
      /* averages stay null — the search result list still renders */
    }
  }

  return rows.map((r) => {
    const joined = Array.isArray(r.artists) ? r.artists[0] : r.artists;
    const acc = avgByRelease.get(r.id);
    return {
      source: "local" as const,
      id: r.id,
      title: r.title,
      artist: joined?.name ?? "",
      cover: r.cover_image,
      year: r.release_date?.slice(0, 4) ?? null,
      kind: r.release_type,
      tracks: Array.isArray(r.tracks) && r.tracks.length > 1 ? r.tracks.length : undefined,
      slug: r.slug,
      unreleased: r.is_unreleased,
      upcoming: isUpcoming(r.release_date),
      avg_rating: acc ? acc.sum / acc.n : null,
      spotify_id: r.spotify_id,
    };
  });
}

const LOCAL_SELECT = "*, artists!releases_primary_artist_id_fkey(name)";

/** Escape LIKE wildcards so a "_" or "%" in the query is literal. */
function likeSafe(s: string): string {
  return s.replace(/[%_\\]/g, "\\$&");
}

/**
 * Records already on PMR. Used to match the TITLE only, so typing
 * "rappels telephone" (title + artist, the natural way to search) found
 * nothing here. Now three small lookups run together and the scorer
 * keeps the ones that actually match:
 *   1. title contains the whole query
 *   2. title contains the longest typed word
 *   3. releases by artists whose name contains a typed word
 */
async function searchLocal(query: string, limit = 8): Promise<CatalogResult[]> {
  const supabase = await createClient();
  const typed = query
    .split(/\s+/)
    .map((w) => w.replace(/[^\p{L}\p{N}'-]/gu, ""))
    .filter((w) => w.length >= 3);
  const longest = [...typed].sort((a, b) => b.length - a.length)[0];

  const [byTitle, byWord, artistIds] = await Promise.all([
    searchReleases(query, limit) as Promise<LocalRow[]>,
    longest && typed.length > 1
      ? supabase
          .from("releases")
          .select(LOCAL_SELECT)
          .ilike("title", `%${likeSafe(longest)}%`)
          .order("popularity", { ascending: false, nullsFirst: false })
          .limit(15)
          .then(({ data }) => (data ?? []) as LocalRow[])
      : Promise.resolve([] as LocalRow[]),
    typed.length > 0
      ? supabase
          .from("artists")
          .select("id")
          .or(typed.slice(0, 4).map((w) => `name.ilike.%${likeSafe(w)}%`).join(","))
          .limit(6)
          .then(({ data }) => ((data ?? []) as { id: string }[]).map((a) => a.id))
      : Promise.resolve([] as string[]),
  ]);

  const byArtist =
    artistIds.length > 0
      ? (((
          await supabase
            .from("releases")
            .select(LOCAL_SELECT)
            .in("primary_artist_id", artistIds)
            .order("popularity", { ascending: false, nullsFirst: false })
            .limit(25)
        ).data ?? []) as LocalRow[])
      : [];

  // Merge, dedupe by id, keep only real matches, best first.
  const seen = new Set<string>();
  const merged = [...byTitle, ...byWord, ...byArtist].filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
  const scored = merged
    .map((r) => {
      const joined = Array.isArray(r.artists) ? r.artists[0] : r.artists;
      return { r, s: matchScore(query, r.title, joined?.name ?? "") };
    })
    // ≥ 50 = every typed word is in the title or artist name.
    .filter((x) => x.s >= 50)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.r);

  return localRowsToResults(scored);
}

/**
 * Swap Spotify/Genius hits that are ALREADY on PMR for their local row
 * (it has a slug, a community average, and its reviews). Before, only
 * album hits were checked — a song somebody already reviewed came back
 * as a fresh Spotify result and looked like it had never been rated.
 */
async function swapInKnown(results: CatalogResult[]): Promise<CatalogResult[]> {
  const spotifyIds = results
    .filter((r) => r.source === "spotify" || r.source === "spotify_track")
    .map((r) => r.id);
  const geniusIds = results.filter((r) => r.source === "genius").map((r) => `song:${r.id}`);
  if (spotifyIds.length === 0 && geniusIds.length === 0) return results;

  const supabase = await createClient();
  const [bySpotify, byGenius] = await Promise.all([
    spotifyIds.length > 0
      ? supabase.from("releases").select(LOCAL_SELECT).in("spotify_id", spotifyIds)
      : Promise.resolve({ data: [] }),
    geniusIds.length > 0
      ? supabase.from("releases").select(LOCAL_SELECT).in("genius_id", geniusIds)
      : Promise.resolve({ data: [] }),
  ]);
  const rows = [
    ...((bySpotify.data ?? []) as LocalRow[]),
    ...((byGenius.data ?? []) as LocalRow[]),
  ];
  if (rows.length === 0) return results;

  const locals = await localRowsToResults(rows);
  const bySourceKey = new Map<string, CatalogResult>();
  rows.forEach((row, i) => {
    if (row.spotify_id) bySourceKey.set(`spotify:${row.spotify_id}`, locals[i]);
    if (row.genius_id) bySourceKey.set(`genius:${row.genius_id.replace(/^song:/, "")}`, locals[i]);
  });

  return results.map((r) => {
    const key =
      r.source === "genius" ? `genius:${r.id}` : r.source === "local" ? "" : `spotify:${r.id}`;
    const local = key ? bySourceKey.get(key) : undefined;
    // Keep the song's album line — the local row doesn't carry it.
    return local ? { ...local, album: r.album } : r;
  });
}

/**
 * One record, several doors: the same song comes back as a Spotify
 * track AND a Genius song, a one-track Spotify "single" album AND that
 * track, a PMR row AND the Spotify hit it came from. Showing all of
 * them made the list look twice as long and half as useful. Keep the
 * first of each — the list is already sorted best-first, and PMR rows
 * sort ahead of their twins.
 */
function dedupe(results: CatalogResult[]): CatalogResult[] {
  const seenIds = new Set<string>();
  const seenSongs = new Set<string>();
  const out: CatalogResult[] = [];
  for (const r of results) {
    const idKey = `${r.source === "spotify_track" ? "spotify" : r.source}:${r.id}`;
    if (seenIds.has(idKey)) continue;
    seenIds.add(idKey);

    // A "song" here = anything that is one song: a song hit, or a
    // single with a single track.
    const isOneSong = r.kind === "song" || (r.kind === "single" && (r.tracks ?? 1) <= 1);
    if (isOneSong) {
      // Main artist only: Spotify says "Lady Gaga, Beyoncé", Genius
      // says "Lady Gaga (Ft. Beyoncé)" — same song, same main artist.
      const firstArtist = foldText(
        r.artist.split(/,|&|\(|\bfeat\.?\s|\bft\.?\s|\bwith\s/i)[0] ?? ""
      );
      const songKey = `${foldText(r.title)}|${firstArtist}`;
      if (seenSongs.has(songKey)) continue;
      seenSongs.add(songKey);
    }
    out.push(r);
  }
  return out;
}

/** Small nudges between equally-good matches. PMR rows first (they
    carry community scores), then albums, then songs. */
const SOURCE_BONUS: Record<CatalogResult["source"], number> = {
  local: 4,
  spotify: 2,
  spotify_track: 1,
  genius: 0,
};

/**
 * Sort by how well each result matches what was typed. Within a source
 * the provider's own order is a weak tiebreaker (Spotify's #1 is usually
 * the popular edition) — worth at most 2 points, never enough to lift a
 * worse match over a better one.
 */
function rank(query: string, lanes: CatalogResult[][]): CatalogResult[] {
  return lanes
    .flatMap((lane) =>
      lane.map((r, i) => ({
        r,
        s:
          matchScore(query, r.title, r.artist, r.album) +
          SOURCE_BONUS[r.source] +
          Math.max(0, 2 - i * 0.2),
      }))
    )
    .sort((a, b) => b.s - a.s)
    .map((x) => x.r);
}

/**
 * Fan out to every source, then rank + dedupe into one list.
 *
 * Lanes: PMR rows, Spotify albums, Spotify songs, Spotify artists,
 * Genius songs. When the query CONTAINS an artist's name ("rappels
 * telephone"), a second, sharper round asks Spotify for
 * `artist:Téléphone rappels` — the plain text search for that query
 * came back full of unrelated "Telephone" singles.
 */
export async function searchCatalog(query: string): Promise<{
  results: CatalogResult[];
  /** Matching artists — tap one to browse their discography. */
  artists: CatalogArtist[];
  geniusEnabled: boolean;
  /** Human hint shown under the search box (e.g. countdown-link help). */
  notice?: string;
}> {
  // Pasted Spotify link? Resolve it directly — this is how UPCOMING
  // albums get in (Spotify search hides them until release day), and
  // how "dark" albums get in: some old records (Téléphone's Rappels,
  // 1YdVwoghaAxlkb5W8oAXHb) still open by id but Spotify has dropped
  // them from search AND from the artist's discography — verified
  // 2026-10-22, no query of ours can surface them.
  const linkRef = parseSpotifyLink(query);
  if (linkRef) {
    try {
      const resolved = await resolveSpotifyLink(linkRef);
      return { ...resolved, artists: [], geniusEnabled: geniusConfigured() };
    } catch (err) {
      console.warn(
        "Spotify link resolve failed:",
        err instanceof Error ? err.message : err
      );
      return {
        results: [],
        artists: [],
        geniusEnabled: geniusConfigured(),
        notice:
          "Couldn't read that Spotify link — double-check it, or try searching by name.",
      };
    }
  }

  const [local, albums, songs, artists, genius] = await Promise.all([
    searchLocal(query),
    searchSpotifyAlbums(query),
    searchSpotifyTracks(query),
    searchSpotifyArtists(query),
    searchGenius(query, 6),
  ]);

  // Round two: the query names an artist AND something else.
  const qFold = foldText(query);
  const named = artists.find((a) => {
    const n = foldText(a.name);
    return n !== qFold && ` ${qFold} `.includes(` ${n} `);
  });
  let sharpAlbums: CatalogResult[] = [];
  let sharpSongs: CatalogResult[] = [];
  if (named) {
    const rest = ` ${qFold} `.replace(` ${foldText(named.name)} `, " ").trim();
    if (rest) {
      const sharp = `artist:${named.name} ${rest}`;
      [sharpAlbums, sharpSongs] = await Promise.all([
        searchSpotifyAlbums(sharp),
        searchSpotifyTracks(sharp, 8),
      ]);
    }
  }

  const ranked = rank(query, [local, sharpAlbums, albums, sharpSongs, songs, genius]);
  const swapped = await swapInKnown(ranked);

  return {
    // Weak tail trimmed: a result where NONE of the typed words
    // appear is noise. Keep 30 so the Albums/Songs tabs stay full.
    results: dedupe(swapped)
      .filter((r) => matchScore(query, r.title, r.artist, r.album) > 0 || r.source === "local")
      .slice(0, 30),
    artists,
    geniusEnabled: geniusConfigured(),
  };
}

/* ---------------------------------------------------------------
   Artist discography — what an artist result opens
   --------------------------------------------------------------- */

/** Display order inside a discography: albums, then EPs, live/
    compilations, then singles; newest first within each. */
const KIND_ORDER: Record<string, number> = {
  album: 0,
  EP: 1,
  compilation: 2,
  single: 3,
};

/**
 * Everything Spotify lists for one artist, as pickable results. Dev-mode
 * pages hold 10, so albums take three pages (30 — more than almost any
 * artist has), singles two, compilations one; all six requests go out
 * together. Rows already on PMR come back as local rows.
 */
export async function getArtistDiscography(
  artistId: string
): Promise<{ artist: CatalogArtist | null; results: CatalogResult[] }> {
  if (!/^[A-Za-z0-9]{10,30}$/.test(artistId)) return { artist: null, results: [] };

  const page = (group: string, offset: number) =>
    spotifyFetch(
      `/artists/${artistId}/albums?include_groups=${group}&limit=10&offset=${offset}`
    )
      .then((raw) => ((raw as { items?: (SpotifyAlbumHit | null)[] }).items ?? []))
      .catch(() => [] as (SpotifyAlbumHit | null)[]);

  const [info, ...pages] = await Promise.all([
    (spotifyFetch(`/artists/${artistId}`) as Promise<SpotifyArtistHit>).catch(() => null),
    page("album", 0),
    page("album", 10),
    page("album", 20),
    page("compilation", 0),
    page("single", 0),
    page("single", 10),
  ]);

  const seen = new Set<string>();
  const albums = pages
    .flat()
    .filter((a): a is SpotifyAlbumHit => !!a && !seen.has(a.id) && !!seen.add(a.id))
    .map(albumHitToResult)
    .sort(
      (a, b) =>
        (KIND_ORDER[a.kind] ?? 9) - (KIND_ORDER[b.kind] ?? 9) ||
        (b.year ?? "").localeCompare(a.year ?? "")
    );

  return {
    artist: info
      ? {
          id: info.id,
          name: info.name,
          image: info.images?.[0]?.url ?? null,
          genres: (info.genres ?? []).slice(0, 2),
        }
      : null,
    results: await swapInKnown(albums),
  };
}

/**
 * "More from this artist" after a review is published: the discography
 * of a PMR release's primary artist, minus that release. Artists that
 * only came in through Genius have no Spotify id → empty list, and the
 * form just doesn't show the row.
 */
export async function getMoreFromArtist(releaseId: string): Promise<{
  artist: CatalogArtist | null;
  results: CatalogResult[];
}> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("id, spotify_id, artists!releases_primary_artist_id_fkey(spotify_id)")
    .eq("id", releaseId)
    .maybeSingle();
  const row = data as
    | {
        id: string;
        spotify_id: string | null;
        artists: { spotify_id: string | null } | { spotify_id: string | null }[] | null;
      }
    | null;
  const joined = Array.isArray(row?.artists) ? row?.artists[0] : row?.artists;
  if (!row || !joined?.spotify_id) return { artist: null, results: [] };

  const disco = await getArtistDiscography(joined.spotify_id);
  return {
    artist: disco.artist,
    results: disco.results.filter(
      (r) => r.id !== row.id && (!row.spotify_id || r.id !== row.spotify_id)
    ),
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

/* ------------------------------------------------------------------ */
/*  Same record, two Spotify doors                                     */
/* ------------------------------------------------------------------ */

/**
 * Loose title equality for "is this album just this song's single?":
 * lowercase, trimmed, whitespace collapsed, trailing "- single" /
 * "(single)" markers dropped.
 */
function sameTitle(a: string, b: string): boolean {
  const norm = (t: string) =>
    t
      .toLowerCase()
      .replace(/\s*[-–(]\s*single\s*\)?\s*$/, "")
      .replace(/\s+/g, " ")
      .trim();
  return norm(a) === norm(b);
}

/**
 * The catalog dedupes on `spotify_id` — but a song reaches us through
 * TWO Spotify doors with two different ids: a TRACK pick stores the
 * track id (a standalone single), an ALBUM import stores the album
 * id. For a single, those are the same record. Luca 2026-09-02:
 * "royal" by fakemink had a page with 2 reviews (track import), then
 * a playlist import resolved its ALBUM id, found nothing, and minted
 * a second, reviewless "royal" — "a no-no".
 *
 * Before either door inserts, it asks here with the OTHER door's ids
 * (the album's track ids, or the track's album id). A hit means the
 * record already exists under its other id — return that row and
 * never insert. Only done when the album IS the song (a single whose
 * title matches the track), so an album track never collapses into
 * its parent LP.
 */
async function findExistingSpotifyAlias(ids: string[]): Promise<Release | null> {
  const unique = ids.filter((id, i) => id && ids.indexOf(id) === i);
  if (unique.length === 0) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("releases")
    .select("*")
    .in("spotify_id", unique)
    .limit(1);
  return (data?.[0] as Release | undefined) ?? null;
}

/**
 * Second net, same bug (Luca 2026-09-02, after the id check shipped:
 * "it just regenerated that same dupe"): Spotify itself carries the
 * SAME song under several track ids (an original single upload and a
 * later re-release each get their own), so the two doors' ids don't
 * always overlap at all. This matches on what IS stable: the primary
 * artist's Spotify id + the title + the kind of release (a single
 * only matches a single, an album only an album — so "Royal" the
 * single never swallows an LP called Royal). Spotify-sourced rows
 * only; Genius rows have no artist id to trust.
 */
async function findExistingByTitle(
  artistSpotifyId: string | undefined,
  title: string,
  kind: "single" | "album"
): Promise<Release | null> {
  if (!artistSpotifyId) return null;
  const supabase = await createClient();
  const { data: artist } = await supabase
    .from("artists")
    .select("id")
    .eq("spotify_id", artistSpotifyId)
    .maybeSingle();
  if (!artist) return null;

  const { data } = await supabase
    .from("releases")
    .select("*")
    .eq("primary_artist_id", (artist as { id: string }).id)
    .eq("source", "spotify")
    // ilike with the wildcards escaped: a plain equality on title
    // would miss "Royal" vs "royal".
    .ilike("title", title.replace(/[%_\\]/g, "\\$&"))
    .limit(10);
  const rows = (data ?? []) as Release[];
  return (
    rows.find(
      (r) =>
        sameTitle(r.title, title) &&
        (kind === "single") === (r.release_type === "single")
    ) ?? null
  );
}

async function ensureFromSpotify(albumId: string): Promise<Release> {
  const album = (await spotifyFetch(`/albums/${albumId}`)) as SpotifyAlbumFull;

  // Already here under a TRACK id? (See findExistingSpotifyAlias.)
  // Only the tracks whose title IS the album title count — for a
  // single that's the title track; for an LP normally nothing.
  const singleAliases = (album.tracks?.items ?? [])
    .filter(
      (t) =>
        sameTitle(t.name, album.name) ||
        (album.album_type === "single" && album.tracks.items.length === 1)
    )
    .map((t) => t.id);
  if (album.album_type !== "album" || singleAliases.length > 0) {
    const existing = await findExistingSpotifyAlias(singleAliases);
    if (existing) return existing;
  }
  // …and under a different id entirely (same song, re-released)?
  const isSingle = album.album_type === "single" && album.tracks.items.length <= 3;
  const byTitle = await findExistingByTitle(
    album.artists?.[0]?.id,
    album.name,
    isSingle ? "single" : "album"
  );
  if (byTitle) return byTitle;

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
      // Fallback ids MUST be lowercased: slugify() empties on fully
      // non-Latin names (Japanese/Korean/Cyrillic/…), and Spotify ids
      // are mixed-case while the RPC's slug regex is lowercase-only —
      // an uppercase fallback slug fails the whole import.
      slug: slugify(`${album.name}-${album.artists?.[0]?.name ?? ""}`) || `release-${albumId.slice(-6).toLowerCase()}`,
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
      // Lowercase for the same reason as the release slug above —
      // this exact line is what broke every all-Japanese artist.
      slug: slugify(a.name) || `artist-${a.id.slice(-6).toLowerCase()}`,
      name: a.name,
      spotify_id: a.id,
      image_url: a.images?.[0]?.url ?? null,
      genres: a.genres ?? [],
      popularity: a.popularity ?? null,
      role: i === 0 ? "primary" : "feature",
    })),
  });
}

interface SpotifyTrackFull {
  id: string;
  name: string;
  duration_ms: number;
  track_number?: number;
  preview_url: string | null;
  popularity?: number;
  artists: { id: string; name: string }[];
  album?: {
    id: string;
    name?: string;
    album_type?: "album" | "single" | "compilation";
    total_tracks?: number;
    images?: { url: string; width: number | null }[];
    release_date?: string;
    release_date_precision?: "year" | "month" | "day";
  };
}

/**
 * A song pick is always THE SONG the user clicked — a Spotify track
 * imports as a standalone single-track release, exactly like a Genius
 * song pick. (It used to import the parent ALBUM, which meant picking
 * a song sometimes attached a whole album — while Genius picks gave
 * you just the song. Luca 2026-08-22: singular-song picks must behave
 * the same in every dropdown. The full album is still one search
 * result away via its Spotify album hit.)
 */
async function ensureFromSpotifyTrack(trackId: string): Promise<Release> {
  const track = (await spotifyFetch(`/tracks/${trackId}`)) as SpotifyTrackFull;

  // Already here under the ALBUM id? Only when the album is this
  // song's own single (same title, or a one-track single) — picking
  // a deep cut off an LP must still give you the song, not the LP.
  if (
    track.album?.id &&
    (sameTitle(track.name, track.album.name ?? "") ||
      (track.album.album_type === "single" && track.album.total_tracks === 1))
  ) {
    const existing = await findExistingSpotifyAlias([track.album.id]);
    if (existing) return existing;
  }
  // Same song already here as a single under another track id?
  const byTitle = await findExistingByTitle(track.artists?.[0]?.id, track.name, "single");
  if (byTitle) return byTitle;

  // Full artist objects for images/genres (cap at 5 to bound latency).
  const artistRefs = (track.artists ?? []).slice(0, 5);
  const fullArtists = await Promise.all(
    artistRefs.map(async (a) => {
      try {
        return (await spotifyFetch(`/artists/${a.id}`)) as SpotifyArtistFull;
      } catch {
        return { id: a.id, name: a.name } as SpotifyArtistFull;
      }
    })
  );

  return importViaRpc({
    release: {
      // Lowercased fallback — see ensureFromSpotify: mixed-case
      // Spotify ids fail the RPC's lowercase-only slug regex.
      slug:
        slugify(`${track.name}-${track.artists?.[0]?.name ?? ""}`) ||
        `track-${trackId.slice(-6).toLowerCase()}`,
      title: track.name,
      release_type: "single",
      release_date: coerceDate(
        track.album?.release_date,
        track.album?.release_date_precision
      ),
      cover_image: track.album?.images?.[0]?.url ?? null,
      // The TRACK id keys the row — re-picking the same song returns
      // this same single (RPC dedupes on spotify_id).
      spotify_id: track.id,
      is_unreleased: false,
      tracks: [
        {
          position: 1,
          title: track.name,
          duration_ms: track.duration_ms,
          spotify_id: track.id,
          preview_url: track.preview_url ?? null,
        },
      ],
      popularity: track.popularity ?? null,
    },
    artists: fullArtists.map((a, i) => ({
      slug: slugify(a.name) || `artist-${a.id.slice(-6).toLowerCase()}`,
      name: a.name,
      spotify_id: a.id,
      image_url: a.images?.[0]?.url ?? null,
      genres: a.genres ?? [],
      popularity: a.popularity ?? null,
      role: i === 0 ? "primary" : "feature",
    })),
  });
}

/**
 * A Genius pick is always THE SONG the user clicked, imported as a
 * standalone single-track release — same intent as the Spotify track
 * flow ("I want this song"), never the album/EP it appears on.
 * (Importing the parent album here surprised people: clicking one
 * song attached their review to a whole EP. The released album is
 * still importable through its Spotify album result in the same
 * search.)
 */
async function ensureFromGenius(songId: number): Promise<Release> {
  const song = await getGeniusSong(songId);
  if (!song) throw new Error(`Genius song ${songId} not found`);

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
      // Song art first; the parent album's cover is only a fallback.
      cover_image: song.song_art_image_url ?? song.album?.cover_art_url ?? null,
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
    // A track pick imports THAT TRACK as a standalone single — the
    // universal "I clicked a song, give me that song" behavior (same
    // as Genius picks). Track-level flows (song of the day, standout
    // tracks, profile song) see a one-track tracklist and just work.
    if (!/^[A-Za-z0-9]{10,30}$/.test(id)) throw new Error("Bad Spotify id");
    return ensureFromSpotifyTrack(id);
  }

  const songId = Number(id);
  if (!Number.isInteger(songId) || songId <= 0) throw new Error("Bad Genius id");
  return ensureFromGenius(songId);
}
