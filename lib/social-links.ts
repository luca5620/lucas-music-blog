/**
 * Connected platforms — the ONE registry for every social / streaming
 * link a profile can carry (Luca 2026-09-02: "choose which social
 * media and streaming platforms connected … people just drop a
 * compatible link, reject others, allow specific ones to be shown as
 * well as being able to order them from left to right").
 *
 * Three consumers read this file so they can never disagree:
 *   - the Settings page (which fields exist, placeholder, validation)
 *   - the profile page (which icons show, in what order)
 *   - migration 039's domain constraints mirror `hosts` (defence in
 *     depth — the DB rejects a link the UI somehow let through)
 *
 * Adding a platform = one entry here + one column in a migration +
 * one icon in components/profile/PlatformIcons.tsx.
 */

import type { Profile } from "@/lib/types/database";

export type PlatformKey =
  | "spotify"
  | "apple_music"
  | "youtube_music"
  | "amazon_music"
  | "soundcloud"
  | "statsfm"
  | "instagram"
  | "x"
  | "discord";

export interface Platform {
  key: PlatformKey;
  /** The profiles column that stores the link. */
  column: keyof Profile;
  label: string;
  /** Hosts a link may live on — anything else is rejected, not saved. */
  hosts: string[];
  placeholder: string;
  /** "streaming" platforms first in the default order, then social. */
  group: "streaming" | "social";
  /** Present before migration 039 (so no capability probe needed). */
  legacy?: boolean;
}

/**
 * Default left-to-right order — also the order the Settings list
 * starts in. A member's `visible_links` overrides this entirely.
 */
export const PLATFORMS: Platform[] = [
  {
    key: "spotify",
    column: "spotify_url",
    label: "Spotify",
    hosts: ["open.spotify.com"],
    placeholder: "https://open.spotify.com/user/…",
    group: "streaming",
    legacy: true,
  },
  {
    key: "apple_music",
    column: "apple_music_url",
    label: "Apple Music",
    hosts: ["music.apple.com"],
    placeholder: "https://music.apple.com/…",
    group: "streaming",
    legacy: true,
  },
  {
    key: "youtube_music",
    column: "youtube_music_url",
    label: "YouTube Music",
    hosts: ["music.youtube.com", "www.youtube.com", "youtube.com"],
    placeholder: "https://music.youtube.com/channel/…",
    group: "streaming",
  },
  {
    key: "amazon_music",
    column: "amazon_music_url",
    label: "Amazon Music",
    // music.amazon.com / .co.uk / .de … — any Amazon Music storefront.
    hosts: ["music.amazon.*"],
    placeholder: "https://music.amazon.com/…",
    group: "streaming",
  },
  {
    key: "soundcloud",
    column: "soundcloud_url",
    label: "SoundCloud",
    hosts: ["soundcloud.com", "www.soundcloud.com", "on.soundcloud.com"],
    placeholder: "https://soundcloud.com/…",
    group: "streaming",
    legacy: true,
  },
  {
    key: "statsfm",
    column: "statsfm_url",
    label: "stats.fm",
    hosts: ["stats.fm", "www.stats.fm", "spotistats.app"],
    placeholder: "https://stats.fm/user/…",
    group: "streaming",
    legacy: true,
  },
  {
    key: "instagram",
    column: "instagram_url",
    label: "Instagram",
    hosts: ["instagram.com", "www.instagram.com"],
    placeholder: "https://instagram.com/yourname",
    group: "social",
  },
  {
    key: "x",
    column: "x_url",
    label: "X",
    hosts: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
    placeholder: "https://x.com/yourname",
    group: "social",
  },
  {
    key: "discord",
    column: "discord_url",
    label: "Discord",
    // An invite (discord.gg/abc) or a user/server link.
    hosts: ["discord.gg", "discord.com", "www.discord.com", "discordapp.com"],
    placeholder: "https://discord.gg/… or https://discord.com/users/…",
    group: "social",
  },
];

export const PLATFORM_KEYS = PLATFORMS.map((p) => p.key);

export function isPlatformKey(value: unknown): value is PlatformKey {
  return typeof value === "string" && (PLATFORM_KEYS as string[]).includes(value);
}

export function getPlatform(key: PlatformKey): Platform {
  return PLATFORMS.find((p) => p.key === key)!;
}

/**
 * Is this URL a link to the platform it claims to be? https only
 * (a stored javascript: URI would be XSS on every visitor's click),
 * host must be on the allow-list. "music.amazon.*" matches any
 * Amazon Music storefront TLD.
 */
export function isValidPlatformUrl(platform: Platform, url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname.toLowerCase();
  return platform.hosts.some((allowed) =>
    allowed.endsWith(".*")
      ? host.startsWith(allowed.slice(0, -1)) // "music.amazon." prefix
      : host === allowed
  );
}

/** A display-ready link: which platform, and where it goes. */
export interface ResolvedLink {
  platform: Platform;
  url: string;
}

/**
 * The links a PROFILE PAGE should show, in order. Honors:
 *   - `visible_links` (ordered keys) when set; NULL = legacy = every
 *     saved link in PLATFORMS order (rows that predate 039 keep
 *     looking exactly as they did)
 *   - the domain allow-list (a bad stored value renders nothing)
 * `hide_streaming_links` is the caller's business — it hides the
 * whole row for visitors and is checked on the page.
 */
export function resolveVisibleLinks(profile: Profile): ResolvedLink[] {
  const raw = profile.visible_links;
  const order: PlatformKey[] = Array.isArray(raw)
    ? raw.filter(isPlatformKey)
    : PLATFORM_KEYS;

  const out: ResolvedLink[] = [];
  for (const key of order) {
    if (out.some((l) => l.platform.key === key)) continue; // dedupe
    const platform = getPlatform(key);
    const url = (profile as unknown as Record<string, unknown>)[platform.column];
    if (typeof url !== "string" || !isValidPlatformUrl(platform, url)) continue;
    out.push({ platform, url });
  }
  return out;
}
