/**
 * Spotify playlist link parsing — client-safe (no tokens, no fetch).
 *
 * Same posture as lib/video.ts: recognize exactly the playlist URL
 * shapes below, extract the 22-char id, and store ONLY that id. The
 * embed iframe src is rebuilt from a fixed template + the validated
 * id, so a pasted URL can never smuggle anything into an iframe.
 *
 * Recognized:
 *   https://open.spotify.com/playlist/<id>          (+ ?si=… params)
 *   https://open.spotify.com/intl-xx/playlist/<id>  (regional paths)
 *   spotify:playlist:<id>                           (URI form)
 *
 * Spotify ids are 22 base62 characters — the DB check in migration
 * 035 enforces the same shape.
 */

export const PLAYLIST_ID_RE = /^[A-Za-z0-9]{22}$/;

export function parsePlaylistUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return null;

  // spotify:playlist:<id>
  const uri = trimmed.match(/^spotify:playlist:([A-Za-z0-9]{22})$/);
  if (uri) return uri[1];

  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;

  const host = url.hostname.toLowerCase();
  if (host !== "open.spotify.com" && host !== "play.spotify.com") return null;

  // "/intl-de/playlist/<id>" → ["intl-de", "playlist", "<id>"]
  const segments = url.pathname.split("/").filter(Boolean);
  const at = segments.indexOf("playlist");
  if (at === -1) return null;
  const id = segments[at + 1] ?? "";
  return PLAYLIST_ID_RE.test(id) ? id : null;
}

/** The only iframe src we ever build for a playlist. theme=0 = dark. */
export function playlistEmbedSrc(id: string): string {
  return `https://open.spotify.com/embed/playlist/${id}?theme=0`;
}

/** Canonical public link, for "open on Spotify" affordances. */
export function playlistUrl(id: string): string {
  return `https://open.spotify.com/playlist/${id}`;
}
