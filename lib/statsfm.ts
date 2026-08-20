/**
 * stats.fm integration (server-only, zero-setup for users).
 *
 * Users already store a stats.fm profile link on their profile.
 * stats.fm exposes public listening data for accounts whose profile
 * is public: the currently-playing track, recent streams, and
 * lifetime totals (minutes listened / stream count — the numbers
 * Spotify itself never exposes through its API).
 *
 * Everything here is defensive: the API is unofficial, users may be
 * private, links may be stale — any failure returns nulls and the
 * profile section simply shows less. Small in-memory caches keep us
 * from hammering their API on every profile view.
 */

const BASE = "https://api.stats.fm/api/v1";

/* ---------------------------------------------------------------
   Username parsing — accepts the URL shapes people actually paste:
   https://stats.fm/lucap, https://stats.fm/user/lucap,
   https://spotistats.app/user/lucap, with or without trailing junk.
   --------------------------------------------------------------- */
export function parseStatsfmUsername(url: string | null): string | null {
  if (!url) return null;
  const m = url
    .trim()
    .match(
      /(?:stats\.fm|spotistats\.app)\/(?:user\/)?([A-Za-z0-9_-]{2,64})/
    );
  if (!m) return null;
  // Guard against picking up path words like "share" or "plus".
  const blocked = new Set(["user", "share", "plus", "import", "login"]);
  return blocked.has(m[1].toLowerCase()) ? null : m[1];
}

/* ---------------------------------------------------------------
   Tiny TTL cache (per warm serverless instance — same tradeoff as
   lib/rate-limit.ts, and fine for profile-page traffic).
   --------------------------------------------------------------- */
const cache = new Map<string, { data: unknown; expiresAt: number }>();

async function cachedFetch(
  path: string,
  ttlMs: number
): Promise<unknown | null> {
  const hit = cache.get(path);
  if (hit && hit.expiresAt > Date.now()) return hit.data;

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": "peakmusicreviews.com profile widget" },
      cache: "no-store",
      // Hard deadline: this API is unofficial and sometimes hangs from
      // datacenter IPs — without it, ONE slow call held the entire
      // profile page hostage for 10+ seconds.
      signal: AbortSignal.timeout(2500),
    });
    // 204 = "nothing playing"; 403/404 = private or unknown user.
    const data = res.ok && res.status !== 204 ? await res.json() : null;
    if (cache.size > 500) cache.clear(); // crude but sufficient bound
    cache.set(path, { data, expiresAt: Date.now() + ttlMs });
    return data;
  } catch {
    cache.set(path, { data: null, expiresAt: Date.now() + ttlMs });
    return null;
  }
}

/* ---------------------------------------------------------------
   Shapes — only the fields we read, everything optional because
   the API is undocumented.
   --------------------------------------------------------------- */

interface RawTrack {
  name?: string;
  artists?: { name?: string }[];
  albums?: { image?: string }[];
}

export interface ListeningTrack {
  name: string;
  artists: string;
  image: string | null;
  /** true = playing right now; false = this was the last stream */
  isPlaying: boolean;
  /** For last-played: ISO timestamp of when the stream ended. */
  endedAt: string | null;
}

export interface ListeningStats {
  minutes: number;
  streams: number;
}

export interface ListeningSnapshot {
  track: ListeningTrack | null;
  stats: ListeningStats | null;
}

function mapTrack(
  raw: RawTrack | undefined,
  isPlaying: boolean,
  endedAt: string | null
): ListeningTrack | null {
  if (!raw?.name) return null;
  return {
    name: raw.name,
    artists: (raw.artists ?? [])
      .map((a) => a?.name)
      .filter(Boolean)
      .join(", "),
    image: raw.albums?.[0]?.image ?? null,
    isPlaying,
    endedAt,
  };
}

/** One call the profile page can await: now-playing (or last played) + lifetime stats. */
export async function getListeningSnapshot(
  username: string
): Promise<ListeningSnapshot> {
  const u = encodeURIComponent(username);

  const [currentRaw, recentRaw, statsRaw] = await Promise.all([
    cachedFetch(`/users/${u}/streams/current`, 30_000),
    cachedFetch(`/users/${u}/streams/recent?limit=1`, 60_000),
    // Lifetime numbers move slowly — cache for 6 hours.
    cachedFetch(`/users/${u}/streams/stats?range=lifetime`, 6 * 3600_000),
  ]);

  // Currently playing?
  const currentItem = (currentRaw as { item?: { isPlaying?: boolean; track?: RawTrack } } | null)
    ?.item;
  let track: ListeningTrack | null = null;
  if (currentItem?.track && currentItem.isPlaying !== false) {
    track = mapTrack(currentItem.track, true, null);
  }

  // Fall back to the most recent stream.
  if (!track) {
    const recentItem = (
      recentRaw as { items?: { endTime?: string; track?: RawTrack }[] } | null
    )?.items?.[0];
    if (recentItem?.track) {
      track = mapTrack(recentItem.track, false, recentItem.endTime ?? null);
    }
  }

  // Lifetime totals.
  const s = (statsRaw as { items?: { count?: number; durationMs?: number } } | null)
    ?.items;
  const stats: ListeningStats | null =
    s && (typeof s.count === "number" || typeof s.durationMs === "number")
      ? {
          minutes: Math.round((s.durationMs ?? 0) / 60_000),
          streams: s.count ?? 0,
        }
      : null;

  return { track, stats };
}
