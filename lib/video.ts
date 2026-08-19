/**
 * Video URL parsing for post embeds.
 *
 * Strict allowlist: we recognize exactly the YouTube and TikTok URL
 * shapes below, extract the platform video id, and store ONLY that id —
 * never the raw URL. The embed iframe src is then rebuilt from a fixed
 * template + the validated id, so a pasted URL can never smuggle
 * anything (javascript:, extra params, lookalike hosts) into an href
 * or iframe (XSS defense).
 *
 * Recognized:
 *   YouTube — youtu.be/<id>, youtube.com/watch?v=<id>,
 *             youtube.com/shorts/<id>, youtube.com/embed/<id>,
 *             youtube-nocookie.com/embed/<id>
 *             (id = exactly 11 chars of [A-Za-z0-9_-])
 *   TikTok  — tiktok.com/@user/video/<digits> (id = 15–22 digits)
 *
 * NOT recognized: vm.tiktok.com / vt.tiktok.com share links — those are
 * server-side redirects we can't resolve client-side. parseVideoUrl
 * returns null for them; use isTikTokShortLink() to show the user a
 * "paste the full link" hint instead of a generic error.
 */

export type VideoKind = "youtube" | "tiktok";

export interface ParsedVideo {
  kind: VideoKind;
  id: string;
}

/** Exactly 11 URL-safe chars — the only YouTube id shape that exists. */
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** TikTok's numeric video ids are snowflake-style, 15–22 digits. */
const TIKTOK_ID_RE = /^\d{15,22}$/;

/** Hostname → true if it's one of YouTube's watch/embed hosts. */
function isYouTubeHost(host: string): boolean {
  return (
    host === "youtube.com" ||
    host === "www.youtube.com" ||
    host === "m.youtube.com" ||
    host === "youtube-nocookie.com" ||
    host === "www.youtube-nocookie.com"
  );
}

/**
 * True if the string looks like a TikTok short share link
 * (vm.tiktok.com / vt.tiktok.com). These redirect server-side, so we
 * can't extract the video id — the UI should tell the user to open the
 * link and paste the full tiktok.com/@user/video/… URL instead.
 */
export function isTikTokShortLink(url: string): boolean {
  const parsed = toUrl(url);
  if (!parsed) return false;
  const host = parsed.hostname.toLowerCase();
  return host === "vm.tiktok.com" || host === "vt.tiktok.com";
}

/** Lenient URL construction: tolerate a missing scheme, reject non-http(s). */
function toUrl(raw: string): URL | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > 500) return null;
  const withScheme = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url;
  } catch {
    return null;
  }
}

/**
 * Parse a pasted video URL into { kind, id }, or null if it isn't a
 * recognized YouTube/TikTok video link. The returned id is fully
 * validated against the platform's id shape and safe to store.
 */
export function parseVideoUrl(url: string): ParsedVideo | null {
  const parsed = toUrl(url);
  if (!parsed) return null;

  const host = parsed.hostname.toLowerCase();
  // Path segments without empty strings: "/shorts/x/" → ["shorts", "x"].
  const segments = parsed.pathname.split("/").filter(Boolean);

  // --- YouTube ---
  if (host === "youtu.be") {
    // youtu.be/<id>
    const id = segments[0] ?? "";
    return YOUTUBE_ID_RE.test(id) ? { kind: "youtube", id } : null;
  }

  if (isYouTubeHost(host)) {
    // youtube.com/watch?v=<id>
    if (segments[0] === "watch") {
      const id = parsed.searchParams.get("v") ?? "";
      return YOUTUBE_ID_RE.test(id) ? { kind: "youtube", id } : null;
    }
    // youtube.com/shorts/<id> and youtube(-nocookie).com/embed/<id>
    if (segments[0] === "shorts" || segments[0] === "embed") {
      const id = segments[1] ?? "";
      return YOUTUBE_ID_RE.test(id) ? { kind: "youtube", id } : null;
    }
    return null;
  }

  // --- TikTok ---
  if (host === "tiktok.com" || host === "www.tiktok.com") {
    // tiktok.com/@user/video/<digits>
    if (
      segments.length >= 3 &&
      segments[0].startsWith("@") &&
      segments[1] === "video"
    ) {
      const id = segments[2];
      return TIKTOK_ID_RE.test(id) ? { kind: "tiktok", id } : null;
    }
    return null;
  }

  return null;
}
