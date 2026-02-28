/**
 * Spotify API Helper — handles token refresh and data fetching.
 *
 * How it works:
 * 1. We store a long-lived "refresh token" in env vars (from the one-time OAuth login)
 * 2. Each API call, we exchange the refresh token for a short-lived access token
 * 3. We use the access token to call Spotify's API for now playing / recently played
 *
 * The refresh token never expires unless you revoke it or change your Spotify password.
 */

const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
const SPOTIFY_NOW_PLAYING_URL =
  "https://api.spotify.com/v1/me/player/currently-playing";
const SPOTIFY_RECENTLY_PLAYED_URL =
  "https://api.spotify.com/v1/me/player/recently-played?limit=1";

const client_id = process.env.SPOTIFY_CLIENT_ID!;
const client_secret = process.env.SPOTIFY_CLIENT_SECRET!;
const refresh_token = process.env.SPOTIFY_REFRESH_TOKEN!;

/**
 * Get a fresh access token from Spotify using the stored refresh token.
 * Access tokens expire every hour, so we fetch a new one on each API call.
 */
async function getAccessToken(): Promise<string> {
  const basic = Buffer.from(`${client_id}:${client_secret}`).toString("base64");

  const response = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refresh_token,
    }),
  });

  const data = await response.json();
  return data.access_token;
}

/**
 * Fetch the currently playing track from Spotify.
 * Returns null if nothing is playing (204 response).
 */
export async function getNowPlaying() {
  const access_token = await getAccessToken();

  const response = await fetch(SPOTIFY_NOW_PLAYING_URL, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
    /* Don't cache — we want fresh data each time */
    cache: "no-store",
  });

  /* 204 = nothing is currently playing */
  if (response.status === 204 || response.status > 400) {
    return null;
  }

  const data = await response.json();

  /* If the player exists but nothing is actively playing */
  if (!data.item) {
    return null;
  }

  return {
    isPlaying: data.is_playing,
    title: data.item.name,
    artist: data.item.artists.map((a: { name: string }) => a.name).join(", "),
    album: data.item.album.name,
    albumArt: data.item.album.images[0]?.url ?? null,
    trackUrl: data.item.external_urls.spotify,
    progress: data.progress_ms,
    duration: data.item.duration_ms,
  };
}

/**
 * Fetch the most recently played track from Spotify.
 * Used as a fallback when nothing is currently playing.
 */
export async function getRecentlyPlayed() {
  const access_token = await getAccessToken();

  const response = await fetch(SPOTIFY_RECENTLY_PLAYED_URL, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
    cache: "no-store",
  });

  if (response.status > 400) {
    return null;
  }

  const data = await response.json();

  if (!data.items || data.items.length === 0) {
    return null;
  }

  const track = data.items[0].track;
  const playedAt = data.items[0].played_at;

  return {
    isPlaying: false,
    title: track.name,
    artist: track.artists.map((a: { name: string }) => a.name).join(", "),
    album: track.album.name,
    albumArt: track.album.images[0]?.url ?? null,
    trackUrl: track.external_urls.spotify,
    playedAt: playedAt,
  };
}
