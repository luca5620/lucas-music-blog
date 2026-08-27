/**
 * Release descriptions — the Letterboxd-style synopsis (Luca
 * 2026-08-22: "a short description... would increase engagement
 * with releases").
 *
 * Source chain: manual (releases.description, Luca-editable via the
 * SQL editor) → Genius "about" text (song for singles / Genius
 * imports, album for LPs — community-written, wide coverage) →
 * Wikipedia article intro (clean synopses for notable albums).
 * Genius-imported releases (genius_id set — the unreleased/deep-
 * catalog stuff) NEVER fall through to Wikipedia: if Genius has no
 * description we show none rather than someone else's (Luca
 * 2026-08-23).
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

// 4s: cold Genius calls regularly blow past 2.5s (a timeout here is
// what left Graduation description-less — see LookupCtx below). The
// description block streams via Suspense, so a slow lookup delays
// only itself, never the page.
const TIMEOUT_MS = 4000;
const MAX_CHARS = 900;
const GENIUS_API = "https://api.genius.com";

/**
 * Tracks whether any external call failed TRANSIENTLY (timeout,
 * network error, 5xx/429) during one resolve. A null result with a
 * transient failure must NOT be cached — unstable_cache would freeze
 * it for 30 days, which is exactly how Graduation showed nothing for
 * weeks while both Genius and Wikipedia had it. Definitive misses
 * (every source answered, none had text — 404s included) still cache.
 */
interface LookupCtx {
  transientFailure: boolean;
}

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

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** "TITLE (Deluxe)" / "(Digital Deluxe)" / "[Deluxe Edition]" → the
    base title, for LOOKUP only — display keeps the full name. Deluxe
    releases share the base album's story, but the qualified name
    strict-matches (sameName) nothing on Genius/Wikipedia, so their
    bios came back empty (Luca 2026-08-26). Only parentheticals that
    say "deluxe" are stripped — "(20th Anniversary Edition)" etc.
    stay, those reissues are their own works with their own pages. */
function stripDeluxe(title: string): string {
  const stripped = title
    .replace(/\s*[(\[][^()[\]]*deluxe[^()[\]]*[)\]]/gi, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  return stripped || title;
}

/** Loose string match: lowercase alphanumerics, containment either way. */
function matches(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  if (!na || !nb) return false;
  return na.includes(nb) || nb.includes(na);
}

/** Strict match: normalized EQUALITY. Album names need this — by
    containment, "MM..FOOD (20th Anniversary Edition)" matches
    "MM..FOOD" and the reissue's blurb replaces the album's (Luca
    2026-08-24, the MM..FOOD review). */
function sameName(a: string, b: string): boolean {
  const na = norm(a);
  const nb = norm(b);
  return !!na && na === nb;
}

async function fetchJson(
  url: string,
  ctx: LookupCtx,
  headers?: Record<string, string>,
): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers,
      cache: "no-store", // unstable_cache owns caching; see below
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // 5xx/429 = the source hiccupped (retry next visit); other 4xx
      // (wiki 404s a nonexistent page title, etc.) = definitive no.
      if (res.status >= 500 || res.status === 429) ctx.transientFailure = true;
      return null;
    }
    return await res.json();
  } catch {
    ctx.transientFailure = true; // timeout / network error
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
  ctx: LookupCtx,
): Promise<{ text: string | null; url: string | null; albumId: number | null; albumName: string | null }> {
  const headers = geniusHeaders();
  if (!headers) return { text: null, url: null, albumId: null, albumName: null };
  const raw = (await fetchJson(
    `${GENIUS_API}/songs/${songId}?text_format=plain`,
    ctx,
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
  ctx: LookupCtx,
): Promise<{ text: string | null; url: string | null }> {
  const headers = geniusHeaders();
  if (!headers) return { text: null, url: null };
  const raw = (await fetchJson(
    `${GENIUS_API}/albums/${albumId}?text_format=plain`,
    ctx,
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
  ctx: LookupCtx,
): Promise<number | null> {
  const headers = geniusHeaders();
  if (!headers) return null;
  const raw = (await fetchJson(
    `${GENIUS_API}/search?q=${encodeURIComponent(`${title} ${artistName}`)}`,
    ctx,
    headers,
  )) as GeniusSearchPayload | null;
  const hits = raw?.response?.hits ?? [];
  // Both title AND artist must match (Luca 2026-08-23: an artist-only
  // match let any song by the artist supply a wrong description).
  // Prefer an exact title; fall back to containment, which covers
  // Genius's feat./version suffixes but can also net "The Making of X"
  // pages — callers guard against those downstream.
  const songHits = hits.filter(
    (h) =>
      h.type === "song" &&
      h.result.primary_artist?.name &&
      matches(h.result.primary_artist.name, artistName),
  );
  const hit =
    songHits.find((h) => sameName(h.result.title, title)) ??
    songHits.find((h) => matches(h.result.title, title));
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
  ctx: LookupCtx,
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
      ctx,
      { accept: "application/json" },
    )) as WikiSummary | null;
    if (!raw || raw.type !== "standard") continue;
    const text = clean(raw.extract);
    if (!text) continue;
    const mentionsArtist = matches(text, artistName) ||
      text.toLowerCase().includes(artistName.toLowerCase());
    // Only the artist-qualified title pins the topic by itself; the
    // "(song)"/"(album)" and bare-title candidates can be a different
    // artist's work entirely, so their intro must prove the artist.
    if (candidate !== candidates[0] && !mentionsArtist) continue;
    return { text, url: raw.content_urls?.desktop?.page ?? null };
  }
  return null;
}

/* ─── The resolver ─── */

async function resolveDescription(
  title: string,
  artistName: string,
  releaseType: string,
  geniusId: string | null,
  firstTrack: string | null,
  ctx: LookupCtx,
): Promise<ReleaseDescription | null> {
  const isSingle = releaseType === "single";

  /* Genius first (Luca: their deep dives cover a wide range). */
  // Genius-imported releases (catalog stores the SONG id as
  // "song:<id>" — pass the bare id or the API 404s, which is how
  // Hold It Down lost its bio). These are the unreleased/leaked/
  // deep-catalog imports — Wikipedia has no article for them, so
  // its fallback can only ever match some OTHER work with the same
  // name. Genius or nothing (Luca 2026-08-23).
  if (geniusId) {
    const songId = geniusId.replace(/^song:/, "");
    const song = await geniusSongDescription(songId, ctx);
    if (song.text) return { text: song.text, source: "genius", url: song.url };
    // Leaks often have duplicate Genius pages; if the imported page
    // is blank, search may land on the twin that carries the bio.
    // Still Genius-only — never Wikipedia for these.
    const hitId = await geniusSearchBestHit(title, artistName, ctx);
    if (hitId && String(hitId) !== songId) {
      const dup = await geniusSongDescription(hitId, ctx);
      if (dup.text) return { text: dup.text, source: "genius", url: dup.url };
    }
    return null;
  }

  if (isSingle) {
    const hitId = await geniusSearchBestHit(title, artistName, ctx);
    if (hitId) {
      const song = await geniusSongDescription(hitId, ctx);
      if (song.text) {
        return { text: song.text, source: "genius", url: song.url };
      }
    }
  } else {
    // Album-shaped release. Searching the album TITLE returns junk
    // (making-of pages, users' listening logs), so anchor on the
    // first track when we have one — its song page points straight
    // at the real album. Either way the landed-on album's name must
    // EQUAL the release title, so a "(20th Anniversary Edition)"
    // page can never describe the original.
    const anchors = firstTrack ? [firstTrack, title] : [title];
    for (const anchor of anchors) {
      const hitId = await geniusSearchBestHit(anchor, artistName, ctx);
      if (!hitId) continue;
      const song = await geniusSongDescription(hitId, ctx);
      if (song.albumId && song.albumName && sameName(song.albumName, title)) {
        const album = await geniusAlbumDescription(song.albumId, ctx);
        if (album.text) {
          return { text: album.text, source: "genius", url: album.url };
        }
        break; // right album found, it just has no text — don't re-hop
      }
    }
  }

  /* Wikipedia fallback — the cleaner synopsis when it exists. */
  const wiki = await wikipediaDescription(title, artistName, isSingle, ctx);
  if (wiki) return { text: wiki.text, source: "wikipedia", url: wiki.url };

  return null;
}

const externalDescription = unstable_cache(
  async (
    title: string,
    artistName: string,
    releaseType: string,
    geniusId: string | null,
    firstTrack: string | null,
  ): Promise<ReleaseDescription | null> => {
    const ctx: LookupCtx = { transientFailure: false };
    const result = await resolveDescription(
      title,
      artistName,
      releaseType,
      geniusId,
      firstTrack,
      ctx,
    );
    // A miss caused (even possibly) by a timeout/outage must not be
    // frozen for 30 days — throwing here keeps unstable_cache from
    // storing it, and getReleaseDescription's catch turns it into a
    // no-description render for THIS view only; the next visit
    // retries. Genuine "no source has text" misses still cache.
    if (!result && ctx.transientFailure) {
      throw new Error("transient external-lookup failure — not caching");
    }
    return result;
  },
  // v4: flushes the nulls frozen by transient failures under v3 (the
  // Graduation bug) — and before that, v3 flushed the wrong-match
  // blurbs of earlier versions.
  ["release-description-v4"],
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
  /** First track's title — anchors the Genius album lookup (albums only). */
  firstTrack?: string | null;
}): Promise<ReleaseDescription | null> {
  if (release.description?.trim()) {
    return { text: release.description.trim(), source: "manual", url: null };
  }
  if (!release.artistName) return null;
  try {
    // Deluxe variants look up under the base title (stripDeluxe) —
    // the qualified name matches nothing external.
    return await externalDescription(
      stripDeluxe(release.title),
      release.artistName,
      release.release_type,
      release.genius_id,
      release.firstTrack ?? null,
    );
  } catch {
    return null;
  }
}
