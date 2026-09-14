/**
 * YouTube — SERVER ONLY. A song source for aux battles (Luca
 * 2026-09-13): players can put a YouTube video on, and everyone
 * listens through the embedded player.
 *
 *   - A pasted link needs NO key: youtube.com/oembed is open and
 *     returns the title, channel and thumbnail for any public video.
 *   - SEARCH needs YOUTUBE_API_KEY (Google Cloud → YouTube Data API
 *     v3). The free quota is 10,000 units a day and a search costs
 *     100, so ~100 searches a day — fine for us, and link-paste is
 *     always there as the door that never closes.
 *
 * The embed is the privacy-enhanced youtube-nocookie.com player, which
 * next.config.ts already allows in frame-src.
 */

import type { AuxSong } from "@/lib/types/database";

const SEARCH = "https://www.googleapis.com/youtube/v3/search";
const OEMBED = "https://www.youtube.com/oembed";

export function youtubeConfigured(): boolean {
  return !!process.env.YOUTUBE_API_KEY;
}

/** The embed src for a video id. */
export function youtubeEmbedSrc(videoId: string): string {
  // enablejsapi=1 lets the site-wide volume reach the player
  // (components/ui/useEmbedVolume.ts).
  return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&enablejsapi=1`;
}

/**
 * The 11-character video id out of any YouTube link shape — watch,
 * youtu.be, shorts, music.youtube.com, embed — or null.
 */
export function parseYouTubeId(url: string): string | null {
  const m =
    url.match(/(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/) ||
    url.match(/music\.youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

/* ------------------------------------------------------------------
   A pasted link → song card (oEmbed, no key)
   ------------------------------------------------------------------ */

interface OEmbed {
  title?: string;
  author_name?: string;
  thumbnail_url?: string;
}

export async function youtubeSongFromLink(url: string): Promise<AuxSong | null> {
  const id = parseYouTubeId(url);
  if (!id) return null;
  const watch = `https://www.youtube.com/watch?v=${id}`;
  try {
    const res = await fetch(`${OEMBED}?format=json&url=${encodeURIComponent(watch)}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as OEmbed;
    if (!data.title) return null;
    return {
      source: "youtube",
      title: data.title.slice(0, 200),
      artist: data.author_name?.replace(/ - Topic$/, "").slice(0, 120) ?? null,
      artwork: data.thumbnail_url ?? `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
      url: watch,
      embed_id: id,
    };
  } catch (err) {
    console.warn("youtube: oembed failed —", err instanceof Error ? err.message : err);
    return null;
  }
}

/* ------------------------------------------------------------------
   Search (Data API v3, key required)
   ------------------------------------------------------------------ */

interface SearchItem {
  id?: { videoId?: string };
  snippet?: {
    title?: string;
    channelTitle?: string;
    thumbnails?: { high?: { url?: string }; medium?: { url?: string }; default?: { url?: string } };
  };
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

export async function searchYouTube(q: string, limit = 8): Promise<AuxSong[]> {
  const key = process.env.YOUTUBE_API_KEY;
  const query = q.trim();
  if (!key || !query) return [];
  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10", // Music
    videoEmbeddable: "true",
    maxResults: String(limit),
    q: query,
    key,
  });
  try {
    const res = await fetch(`${SEARCH}?${params.toString()}`, { cache: "no-store" });
    if (!res.ok) {
      console.warn("youtube: search failed", res.status);
      return [];
    }
    const data = (await res.json()) as { items?: SearchItem[] };
    return (data.items ?? [])
      .filter((it) => it.id?.videoId && it.snippet?.title)
      .map((it) => {
        const id = it.id!.videoId!;
        const sn = it.snippet!;
        return {
          source: "youtube" as const,
          title: decodeEntities(sn.title ?? "").slice(0, 200),
          artist: sn.channelTitle?.replace(/ - Topic$/, "").slice(0, 120) ?? null,
          artwork:
            sn.thumbnails?.high?.url ??
            sn.thumbnails?.medium?.url ??
            sn.thumbnails?.default?.url ??
            `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${id}`,
          embed_id: id,
        };
      });
  } catch (err) {
    console.warn("youtube: search error —", err instanceof Error ? err.message : err);
    return [];
  }
}
