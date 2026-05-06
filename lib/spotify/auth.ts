/**
 * Spotify client-credentials auth + URL parsing helpers.
 *
 * `getSpotifyToken()` lazily fetches a client-credentials token and
 * caches it in module memory until ~30s before expiry. Reused across
 * the import pipeline (`lib/spotify-import.ts`).
 *
 * `parseSpotifyUrl()` accepts the public web URL formats and the
 * `spotify:artist:...` URI form. A bare ID is rejected because the
 * resource type is ambiguous — caller must specify in that case.
 */

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

let cached: { token: string; expiresAt: number } | null = null;

export async function getSpotifyToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 30_000) {
    return cached.token;
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Spotify auth misconfigured: SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET must be set"
    );
  }

  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Spotify token request failed: ${res.status} ${res.statusText} ${body}`
    );
  }

  const data = (await res.json()) as {
    access_token?: string;
    expires_in?: number;
  };

  if (!data.access_token || typeof data.expires_in !== "number") {
    throw new Error("Spotify token response missing access_token / expires_in");
  }

  cached = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };

  return cached.token;
}

export type SpotifyResourceKind = "artist" | "album";

export interface ParsedSpotifyResource {
  kind: SpotifyResourceKind;
  id: string;
}

/**
 * Parse a Spotify URL or URI into `{ kind, id }`. Returns `null` for
 * bare IDs (ambiguous) or anything that doesn't match.
 *
 * Accepts:
 *  - https://open.spotify.com/artist/{id}      (with or without query)
 *  - https://open.spotify.com/album/{id}
 *  - http://open.spotify.com/intl-en/album/{id}  (locale prefix tolerated)
 *  - spotify:artist:{id}
 *  - spotify:album:{id}
 */
export function parseSpotifyUrl(url: string): ParsedSpotifyResource | null {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // URI form: spotify:artist:abc123
  const uriMatch = trimmed.match(/^spotify:(artist|album):([A-Za-z0-9]+)$/);
  if (uriMatch) {
    return { kind: uriMatch[1] as SpotifyResourceKind, id: uriMatch[2] };
  }

  // Web URL form. Strip query string before matching.
  const noQuery = trimmed.split("?")[0].split("#")[0];
  const urlMatch = noQuery.match(
    /open\.spotify\.com\/(?:[a-z-]+\/)?(artist|album)\/([A-Za-z0-9]+)\/?$/
  );
  if (urlMatch) {
    return { kind: urlMatch[1] as SpotifyResourceKind, id: urlMatch[2] };
  }

  return null;
}
