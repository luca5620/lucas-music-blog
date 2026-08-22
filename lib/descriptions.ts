/**
 * Release descriptions — the Letterboxd-style synopsis (Luca
 * 2026-08-22: "a short description... would increase engagement
 * with releases").
 *
 * Source chain: manual (releases.description, Luca-editable via the
 * SQL editor) → Genius "about" text (song for singles / Genius
 * imports, album for LPs — community-written, wide coverage) →
 * Wikipedia article intro (clean synopses for notable albums).
 *
 * External lookups are cached with unstable_cache for 30 days per
 * release — NOTHING external is ever written to the database, so
 * there's no write path to secure and no migration to run. Lyrics
 * themselves are NOT available through the Genius API (licensing);
 * when we match a Genius page we link out to it instead.
 *
 * Every fetch carries a timeout (the stats.fm lesson: an external
 * host that hangs must never hold a page hostage).
 */

import { unstable_cache } from "next/cache";

const TIMEOUT_MS = 2500;
const MAX_CHARS = 900;
const GENIUS_API = "https://api.genius.com";

export interface ReleaseDescription {
  text: string;
  source: "manual" | "genius" | "wikipedia";
  /** The source's own page (Genius song/album or Wikipedia article). */
  url: string | null;
}

/** Trim, collapse, cap — and reject Genius's "?" empty-description
    marker and anything too short to be a real synopsis. */
function clean(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const text = raw.replace(/\n{3,}/g, "\n\n").trim();
  if (text.length < 40 || text === "?") return null;
  return text.length > MAX_CHARS
    ? `${text.slice(0, MAX_CHARS).trimEnd()}…`
    : text;
}

/** Loose string match: lowercase alphanumerics, containment either way. */
function matches(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

async function fetchJson(
  url: string,
  headers?: Record<string, string>,
): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store", // unstable_cache owns caching; see below
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/* ─── Genius ─── */

interface GeniusSongPayload {
  response?: {
    song?: {
      title?: string;
      url?: string;
      description?: { plain?: string };
      album?: { id?: number; name?: string; url?: string };
      primary_artist?: { name?: string };
    };
  };
}
interface GeniusAlbumPayload {
  response?: {
    album?: {
      name?: string;
      url?: string;
      description?: { plain?: string };
      description_annotation?: {
        annotations?: { body?: { plain?: string } }[];
      };
    };
  };
}
interface GeniusSearchPayload {
  response?: {
    hits?: {
      type: string;
      result: { id: number; title: string; primary_artist?: { name?: string } };
    }[];
  };
}

function geniusHeaders(): Record<string, string> | null {
  const token = process.env.GENIUS_ACCESS_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : null;
}

async function geniusSongDescription(
  songId: string | number,
): Promise<{ text: string | null; url: string | null; albumId: number | null; albumName: string | null }> {
  const headers = geniusHeaders();
  if (!headers) return { text: null, url: null, albumId: null, albumName: null };
  const raw = (await fetchJson(
    `${GENIUS_API}/songs/${songId}?text_format=plain`,
    headers,
  )) as GeniusSongPayload | null;
  const song = raw?.response?.song;
  return {
    text: clean(song?.description?.plain),
    url: song?.url ?? null,
    albumId: song?.album?.id ?? null,
    albumName: song?.album?.name ?? null,
  };
}

async function geniusAlbumDescription(
  albumId: number,
): Promise<{ text: string | null; url: string | null }> {
  const headers = geniusHeaders();
  if (!headers) return { text: null, url: null };
  const raw = (await fetchJson(
    `${GENIUS_API}/albums/${albumId}?text_format=plain`,
    headers,
  )) as GeniusAlbumPayload | null;
  const album = raw?.response?.album;
  const text =
    clean(album?.description?.plain) ??
    clean(album?.description_annotation?.annotations?.[0]?.body?.plain);
  return { text, url: album?.url ?? null };
}

async function geniusSearchBestHit(
  title: string,
  artistName: string,
): Promise<number | null> {
  const headers = geniusHeaders();
  if (!headers) return null;
  const raw = (await fetchJson(
    `${GENIUS_API}/search?q=${encodeURIComponent(`${title} ${artistName}`)}`,
    headers,
  )) as GeniusSearchPayload | null;
  const hits = raw?.response?.hits ?? [];
  const hit = hits.find(
    (h) =>
      h.type === "song" &&
      h.result.primary_artist?.name &&
      matches(h.result.primary_artist.name, artistName),
  );
  return hit?.result.id ?? null;
}

/* ─── Wikipedia ─── */

interface WikiSummary {
  type?: string;
  extract?: string;
  content_urls?: { desktop?: { page?: string } };
}

async function wikipediaDescription(
  title: string,
  artistName: string,
  isSingle: boolean,
): Promise<{ text: string; url: string | null } | null> {
  const kind = isSingle ? "song" : "album";
  // "Blonde (Frank Ocean album)" → "Blonde (album)" → "Blonde"; the
  // bare-title candidate must mention the artist in its intro or it's
  // probably a different Blonde entirely.
  const candidates = [
    `${title} (${artistName} ${kind})`,
    `${title} (${kind})`,
    title,
  ];
  for (const candidate of candidates) {
    const raw = (await fetchJson(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(candidate)}`,
      { accept: "application/json" },
    )) as WikiSummary | null;
    if (!raw || raw.type !== "standard") continue;
    const text = clean(raw.extract);
    if (!text) continue;
    const mentionsArtist = matches(text, artistName) ||
      text.toLowerCase().includes(artistName.toLowerCase());
    // The qualified titles already pinned the topic; the bare title
    // needs the intro itself to prove it's about this artist's work.
    if (candidate === title && !mentionsArtist) continue;
    return { text, url: raw.content_urls?.desktop?.page ?? null };
  }
  return null;
}

/* ─── The resolver ─── */

const externalDescription = unstable_cache(
  async (
    title: string,
    artistName: string,
    releaseType: string,
    geniusId: string | null,
  ): Promise<ReleaseDescription | null> => {
    const isSingle = releaseType === "single";

    /* Genius first (Luca: their deep dives cover a wide range). */
    // Direct id (Genius-imported releases store the SONG id).
    if (geniusId) {
      const song = await geniusSongDescription(geniusId);
      if (song.text) return { text: song.text, source: "genius", url: song.url };
    } else {
      const hitId = await geniusSearchBestHit(title, artistName);
      if (hitId) {
        const song = await geniusSongDescription(hitId);
        if (isSingle && song.text) {
          return { text: song.text, source: "genius", url: song.url };
        }
        // Album-shaped release: hop from the matched song to its album.
        if (!isSingle && song.albumId && song.albumName && matches(song.albumName, title)) {
          const album = await geniusAlbumDescription(song.albumId);
          if (album.text) {
            return { text: album.text, source: "genius", url: album.url };
          }
        }
      }
    }

    /* Wikipedia fallback — the cleaner synopsis when it exists. */
    const wiki = await wikipediaDescription(title, artistName, isSingle);
    if (wiki) return { text: wiki.text, source: "wikipedia", url: wiki.url };

    return null;
  },
  ["release-description"],
  { revalidate: 60 * 60 * 24 * 30 }, // 30 days per (title, artist, …) tuple
);

/**
 * The one entry point. Manual description (the releases.description
 * column) always wins; external sources fill the gaps.
 */
export async function getReleaseDescription(release: {
  title: string;
  release_type: string;
  genius_id: string | null;
  description: string | null;
  artistName: string;
}): Promise<ReleaseDescription | null> {
  if (release.description?.trim()) {
    return { text: release.description.trim(), source: "manual", url: null };
  }
  if (!release.artistName) return null;
  try {
    return await externalDescription(
      release.title,
      release.artistName,
      release.release_type,
      release.genius_id,
    );
  } catch {
    return null;
  }
}
