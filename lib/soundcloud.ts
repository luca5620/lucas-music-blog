/**
 * SoundCloud — SERVER ONLY.
 *
 * One job (Luca 2026-09-13): Aux Wars — search SoundCloud for a song
 * to put on, and turn a pasted soundcloud.com link into a song card.
 *
 * (It had a second job until 2026-10-24: a SoundCloud preview player
 * on release pages and Your Taste. That sat switched off waiting on
 * SoundCloud's paid API, and Apple's guideline 2.5.19 now bans
 * dormant features, so it was REMOVED — the resolver, the embed
 * component and the Settings option. It's in git history; the
 * soundcloud_url / soundcloud_checked_at columns and
 * catalog_set_soundcloud from migration 042 are still in the
 * database, unused.)
 *
 * What needs a key and what doesn't:
 *   - The EMBED needs nothing: w.soundcloud.com/player/?url=<permalink>
 *     plays any public track or set.
 *   - Reading a pasted link needs nothing either: soundcloud.com/oembed
 *     is open and returns title / author / artwork for a permalink.
 *   - SEARCH needs an API
 *     app: SOUNDCLOUD_CLIENT_ID + SOUNDCLOUD_CLIENT_SECRET from
 *     soundcloud.com/you/apps, exchanged for a client-credentials
 *     token at secure.soundcloud.com/oauth/token. Without them, search
 *     returns nothing and the picker says "paste a link".
 *
 * Every function here fails soft (null / empty) — a SoundCloud hiccup
 * must never take a room or a release page down.
 */

import type { AuxSong } from "@/lib/types/database";

const API = "https://api.soundcloud.com";
const TOKEN_URL = "https://secure.soundcloud.com/oauth/token";
const OEMBED = "https://soundcloud.com/oembed";

/** True when the API app credentials are set (search on). */
export function soundcloudConfigured(): boolean {
  return !!process.env.SOUNDCLOUD_CLIENT_ID && !!process.env.SOUNDCLOUD_CLIENT_SECRET;
}

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
   Search (Aux Wars)
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
