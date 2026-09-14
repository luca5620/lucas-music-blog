/**
 * SoundCloud — SERVER ONLY.
 *
 * Two jobs (Luca 2026-09-13):
 *   1. Aux battles: search SoundCloud for a song to put on, and turn
 *      a pasted soundcloud.com link into a song card.
 *   2. Release pages: SoundCloud as the THIRD preview player (after
 *      Spotify and Apple Music) for members who pick it in Settings —
 *      the track/set permalink is looked up once and cached on the
 *      release row (migration 042), exactly like Apple's id.
 *
 * What needs a key and what doesn't:
 *   - The EMBED needs nothing: w.soundcloud.com/player/?url=<permalink>
 *     plays any public track or set.
 *   - Reading a pasted link needs nothing either: soundcloud.com/oembed
 *     is open and returns title / author / artwork for a permalink.
 *   - SEARCH (and therefore the release-page resolver) needs an API
 *     app: SOUNDCLOUD_CLIENT_ID + SOUNDCLOUD_CLIENT_SECRET from
 *     soundcloud.com/you/apps, exchanged for a client-credentials
 *     token at secure.soundcloud.com/oauth/token. Without them, search
 *     returns nothing and the picker says "paste a link".
 *
 * Every function here fails soft (null / empty) — a SoundCloud hiccup
 * must never take a room or a release page down.
 */

import { createClient } from "@/lib/supabase/server";
import type { AuxSong, Release } from "@/lib/types/database";
import { soundcloudEmbedSrc } from "@/lib/soundcloud-embed";

const API = "https://api.soundcloud.com";
const TOKEN_URL = "https://secure.soundcloud.com/oauth/token";
const OEMBED = "https://soundcloud.com/oembed";
const RECHECK_AFTER_MS = 7 * 24 * 60 * 60 * 1000;

/** True when the API app credentials are set (search + resolver on). */
export function soundcloudConfigured(): boolean {
  return !!process.env.SOUNDCLOUD_CLIENT_ID && !!process.env.SOUNDCLOUD_CLIENT_SECRET;
}

/* The widget URL builder lives in lib/soundcloud-embed.ts (no
   imports, so client components can use it too) and is re-exported
   here so server callers keep one import. */
export { soundcloudEmbedSrc } from "@/lib/soundcloud-embed";

/**
 * A pasted SoundCloud link, stripped back to the bare permalink.
 *
 * SoundCloud's own SHARE button hands out
 * ".../hold-it-down?si=...&utm_source=clipboard&utm_medium=text&utm_campaign=social_sharing"
 * (Luca 2026-09-14: the address-bar URL worked, the shared one didn't),
 * so the query string and hash come off first, along with www./m. and
 * any trailing slash. Null for anything that isn't a SoundCloud link.
 */
export function soundcloudPermalink(url: string): string | null {
  const clean = url
    .trim()
    .split("#")[0]
    .split("?")[0]
    .replace(/^http:\/\//, "https://")
    .replace(/^https:\/\/(www|m)\.soundcloud\.com/, "https://soundcloud.com")
    .replace(/\/+$/, "");
  if (/^https:\/\/on\.soundcloud\.com\/[A-Za-z0-9]+$/.test(clean)) return clean;
  if (/^https:\/\/soundcloud\.com\/[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)+$/.test(clean)) return clean;
  return null;
}

/** A soundcloud.com permalink we accept (tracks and sets). */
export function isSoundCloudUrl(url: string): boolean {
  return soundcloudPermalink(url) !== null;
}

/* ------------------------------------------------------------------
   Token (client credentials), cached in memory for its lifetime
   ------------------------------------------------------------------ */

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getToken(): Promise<string | null> {
  if (!soundcloudConfigured()) return null;
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) {
    return cachedToken.value;
  }
  try {
    const basic = Buffer.from(
      `${process.env.SOUNDCLOUD_CLIENT_ID}:${process.env.SOUNDCLOUD_CLIENT_SECRET}`
    ).toString("base64");
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json; charset=utf-8",
      },
      body: "grant_type=client_credentials",
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("soundcloud: token request failed", res.status);
      return null;
    }
    const data = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!data.access_token) return null;
    cachedToken = {
      value: data.access_token,
      expiresAt: Date.now() + (data.expires_in ?? 3600) * 1000,
    };
    return cachedToken.value;
  } catch (err) {
    console.warn("soundcloud: token error —", err instanceof Error ? err.message : err);
    return null;
  }
}

async function scFetch<T>(path: string): Promise<T | null> {
  const token = await getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${API}${path}`, {
      headers: { Authorization: `OAuth ${token}`, Accept: "application/json; charset=utf-8" },
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("soundcloud: request failed", res.status, path);
      return null;
    }
    return (await res.json()) as T;
  } catch (err) {
    console.warn("soundcloud: request error —", err instanceof Error ? err.message : err);
    return null;
  }
}

/* ------------------------------------------------------------------
   Shapes
   ------------------------------------------------------------------ */

interface ScTrack {
  id: number;
  title: string;
  permalink_url: string;
  artwork_url: string | null;
  user?: { username?: string; avatar_url?: string | null };
  kind?: string;
}

interface ScPlaylist {
  id: number;
  title: string;
  permalink_url: string;
  artwork_url: string | null;
  user?: { username?: string };
  track_count?: number;
}

/** SoundCloud's default artwork is 100x100; -t500x500 is the big one. */
function bigArtwork(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.replace("-large.", "-t500x500.");
}

function trackToSong(t: ScTrack): AuxSong {
  return {
    source: "soundcloud",
    title: t.title,
    artist: t.user?.username ?? null,
    artwork: bigArtwork(t.artwork_url ?? t.user?.avatar_url ?? null),
    url: t.permalink_url,
    embed_id: t.permalink_url,
  };
}

/* ------------------------------------------------------------------
   Search (aux battles)
   ------------------------------------------------------------------ */

export async function searchSoundCloudTracks(q: string, limit = 8): Promise<AuxSong[]> {
  const query = q.trim();
  if (!query) return [];
  const rows = await scFetch<ScTrack[] | { collection: ScTrack[] }>(
    `/tracks?q=${encodeURIComponent(query)}&limit=${limit}&access=playable`
  );
  if (!rows) return [];
  const list = Array.isArray(rows) ? rows : rows.collection ?? [];
  return list.filter((t) => t.permalink_url && t.title).map(trackToSong);
}

/* ------------------------------------------------------------------
   A pasted link → song card (no key needed: oEmbed)
   ------------------------------------------------------------------ */

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

/**
 * Follows on.soundcloud.com short links to the real permalink (the
 * oEmbed endpoint wants the full URL). Returns the input unchanged
 * for ordinary soundcloud.com links.
 */
async function expandShortLink(url: string): Promise<string> {
  if (!/^https:\/\/on\.soundcloud\.com\//.test(url)) return url;
  try {
    const res = await fetch(url, { method: "HEAD", redirect: "manual", cache: "no-store" });
    const loc = res.headers.get("location");
    if (loc && /^https:\/\/(www\.)?soundcloud\.com\//.test(loc)) {
      return loc.split("?")[0];
    }
  } catch {
    /* fall through */
  }
  return url;
}

export async function soundcloudSongFromLink(url: string): Promise<AuxSong | null> {
  const pasted = soundcloudPermalink(url);
  if (!pasted) return null;
  const permalink = soundcloudPermalink(await expandShortLink(pasted));
  if (!permalink || /^https:\/\/on\.soundcloud\.com\//.test(permalink)) {
    return null;
  }
  try {
    const res = await fetch(
      `${OEMBED}?format=json&url=${encodeURIComponent(permalink)}`,
      { cache: "no-store" }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as OEmbed;
    if (!data.title) return null;
    // oEmbed titles come as "Song by Artist"; split once, from the end.
    const m = data.title.match(/^(.*) by (.+)$/);
    return {
      source: "soundcloud",
      title: (m ? m[1] : data.title).slice(0, 200),
      artist: (m ? m[2] : data.author_name ?? null)?.slice(0, 120) ?? null,
      artwork: data.thumbnail_url ?? null,
      url: permalink,
      embed_id: permalink,
    };
  } catch (err) {
    console.warn("soundcloud: oembed failed —", err instanceof Error ? err.message : err);
    return null;
  }
}

/* ------------------------------------------------------------------
   Release pages: the preview player (migration 042)
   ------------------------------------------------------------------ */

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\(.*?\)|\[.*?\]/g, " ")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loose "is this the same record" check on a search hit. */
function looksLike(hitTitle: string, hitUser: string | undefined, title: string, artist: string): boolean {
  const ht = norm(hitTitle);
  const nt = norm(title);
  const na = norm(artist);
  const hu = norm(hitUser ?? "");
  const titleOk = ht.includes(nt) || nt.includes(ht);
  const artistOk = !na || hu.includes(na) || na.includes(hu) || ht.includes(na);
  return titleOk && artistOk;
}

/**
 * The SoundCloud permalink for a release — cached, or looked up now
 * and cached. Singles look for a track, everything else for a set
 * (playlist) first and a track second. Null when SoundCloud doesn't
 * carry it (or search is not configured); a miss is remembered for a
 * week. Never throws.
 */
export async function resolveSoundCloud(
  release: Release,
  artistName: string
): Promise<string | null> {
  if (release.soundcloud_url) return release.soundcloud_url;
  if (!soundcloudConfigured()) return null;

  if (release.soundcloud_checked_at) {
    const age = Date.now() - new Date(release.soundcloud_checked_at).getTime();
    if (age < RECHECK_AFTER_MS) return null;
  }

  const q = `${artistName} ${release.title}`.trim();
  let found: string | null = null;
  try {
    const single = release.release_type === "single" || (release.tracks ?? []).length === 1;
    if (!single) {
      const sets = await scFetch<ScPlaylist[] | { collection: ScPlaylist[] }>(
        `/playlists?q=${encodeURIComponent(q)}&limit=6`
      );
      const list = sets ? (Array.isArray(sets) ? sets : sets.collection ?? []) : [];
      const hit = list.find((p) => looksLike(p.title, p.user?.username, release.title, artistName));
      if (hit?.permalink_url) found = hit.permalink_url;
    }
    if (!found) {
      const tracks = await scFetch<ScTrack[] | { collection: ScTrack[] }>(
        `/tracks?q=${encodeURIComponent(q)}&limit=6&access=playable`
      );
      const list = tracks ? (Array.isArray(tracks) ? tracks : tracks.collection ?? []) : [];
      const hit = list.find((t) => looksLike(t.title, t.user?.username, release.title, artistName));
      if (hit?.permalink_url) found = hit.permalink_url;
    }
  } catch (err) {
    console.warn("soundcloud: resolve failed —", err instanceof Error ? err.message : err);
    found = null;
  }

  // The DB check wants a bare soundcloud.com link.
  if (found && !/^https:\/\/soundcloud\.com\/[A-Za-z0-9_./-]{3,300}$/.test(found)) {
    found = null;
  }

  try {
    const supabase = await createClient();
    await supabase.rpc("catalog_set_soundcloud", {
      p_release_id: release.id,
      p_url: found,
    } as never);
  } catch (err) {
    console.warn("soundcloud: cache write failed —", err instanceof Error ? err.message : err);
  }

  return found;
}

/**
 * Release id → SoundCloud embed src for the /your-taste pager, same
 * budget rule as resolveAppleEmbedsForReleases: cached links are
 * free, at most `maxLookups` fresh searches per call.
 */
export async function resolveSoundCloudEmbedsForReleases(
  releaseIds: string[],
  maxLookups = 4
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const ids = [...new Set(releaseIds.filter(Boolean))];
  if (ids.length === 0) return out;

  let rows: (Release & { artists?: { name: string } | { name: string }[] | null })[] = [];
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("releases")
      .select("*, artists!releases_primary_artist_id_fkey(name)")
      .in("id", ids);
    rows = (data ?? []) as typeof rows;
  } catch {
    return out;
  }

  const pending: (typeof rows)[number][] = [];
  for (const row of rows) {
    if (row.soundcloud_url) {
      out.set(row.id, soundcloudEmbedSrc(row.soundcloud_url));
      continue;
    }
    if (row.soundcloud_checked_at) {
      const age = Date.now() - new Date(row.soundcloud_checked_at).getTime();
      if (age < RECHECK_AFTER_MS) continue;
    }
    if (pending.length < maxLookups) pending.push(row);
  }

  if (!soundcloudConfigured()) return out;

  await Promise.allSettled(
    pending.map(async (row) => {
      const a = Array.isArray(row.artists) ? row.artists[0] : row.artists;
      const url = await resolveSoundCloud(row, a?.name ?? "");
      if (url) out.set(row.id, soundcloudEmbedSrc(url));
    })
  );

  return out;
}
