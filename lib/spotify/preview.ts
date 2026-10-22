/**
 * 30-second song previews — SERVER ONLY (Luca 2026-10-22: "you should
 * be able to preview the songs when they select the song or album,
 * cause like maybe they're like huh what does this song sound like
 * again?").
 *
 * WHERE THE AUDIO COMES FROM: Spotify's Web API stopped handing out
 * `preview_url` (it's null on every track for apps like ours), but the
 * public EMBED page — open.spotify.com/embed/{album|track}/{id}, the
 * same page the release page's player iframe loads — still carries a
 * 30s MP3 link per track in its page JSON (`audioPreview.url`, served
 * from p.scdn.co). Same door lib/spotify/playlist.ts already reads for
 * playlists. Verified 2026-10-22 on an album, a track, and even a
 * "dark" album Spotify no longer lists anywhere (Téléphone's Rappels).
 *
 * Nothing private: we only read what the embed shows any visitor, the
 * audio streams from Spotify's CDN straight to the listener, and we
 * never store the files.
 *
 * Genius songs have no Spotify id, so they're matched to a Spotify
 * track by name first (title must match, first artist must match);
 * no confident match → no preview, never a wrong song.
 */

import { spotifyFetch } from "@/lib/spotify-import";
import { foldText } from "@/lib/catalog-rank";

export interface PreviewTrack {
  title: string;
  /** Spotify track id (when known) — lets the UI match a tracklist row. */
  spotify_id: string | null;
  /** 30s MP3, or null when Spotify has no preview for this track. */
  url: string | null;
}

interface EmbedTrack {
  title?: string;
  uri?: string;
  audioPreview?: { url?: string } | null;
}

interface EmbedEntity {
  type?: string;
  title?: string;
  name?: string;
  uri?: string;
  audioPreview?: { url?: string } | null;
  trackList?: EmbedTrack[];
}

/** Only ever hand the browser Spotify's own preview CDN. */
function safePreviewUrl(u: string | undefined | null): string | null {
  return u && /^https:\/\/p\.scdn\.co\/mp3-preview\/[A-Za-z0-9]+/.test(u) ? u : null;
}

function idFromUri(uri: string | undefined): string | null {
  return uri?.match(/^spotify:track:([A-Za-z0-9]+)$/)?.[1] ?? null;
}

async function readEmbed(kind: "album" | "track", id: string): Promise<EmbedEntity | null> {
  const res = await fetch(`https://open.spotify.com/embed/${kind}/${id}`, {
    headers: {
      // Browser-shaped UA — same reason as lib/spotify/playlist.ts.
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "text/html",
    },
    // A day of caching at the fetch layer: previews don't change.
    next: { revalidate: 86_400 },
  });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/
  );
  if (!match) return null;
  try {
    const json = JSON.parse(match[1]) as {
      props?: { pageProps?: { state?: { data?: { entity?: EmbedEntity } } } };
    };
    return json.props?.pageProps?.state?.data?.entity ?? null;
  } catch {
    return null;
  }
}

/** Every track of a Spotify album with its preview, in album order. */
export async function albumPreviews(albumId: string): Promise<PreviewTrack[]> {
  const entity = await readEmbed("album", albumId);
  return (entity?.trackList ?? []).map((t) => ({
    title: t.title ?? "",
    spotify_id: idFromUri(t.uri),
    url: safePreviewUrl(t.audioPreview?.url),
  }));
}

/** One Spotify track's preview. */
export async function trackPreview(trackId: string): Promise<PreviewTrack[]> {
  const entity = await readEmbed("track", trackId);
  if (!entity) return [];
  return [
    {
      title: entity.title ?? entity.name ?? "",
      spotify_id: trackId,
      url: safePreviewUrl(entity.audioPreview?.url),
    },
  ];
}

/**
 * Song known only by name (Genius picks, Genius-imported releases):
 * find the Spotify twin, then read its preview. Strict on purpose —
 * a leak or unreleased song that Spotify doesn't carry must come back
 * EMPTY rather than as some other song with a similar name.
 */
export async function previewByName(title: string, artist: string): Promise<PreviewTrack[]> {
  const t = foldText(title);
  const a = foldText(artist.split(",")[0] ?? "");
  if (!t) return [];
  try {
    const raw = (await spotifyFetch(
      `/search?type=track&limit=5&q=${encodeURIComponent(`track:${title} artist:${artist.split(",")[0] ?? ""}`)}`
    )) as { tracks?: { items?: ({ id: string; name: string; artists: { name: string }[] } | null)[] } };
    const hit = (raw.tracks?.items ?? []).find(
      (x) =>
        !!x &&
        foldText(x.name) === t &&
        (!a || x.artists.some((ar) => foldText(ar.name) === a))
    );
    return hit ? trackPreview(hit.id) : [];
  } catch {
    return [];
  }
}
