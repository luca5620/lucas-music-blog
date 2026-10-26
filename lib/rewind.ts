import { createClient } from "@/lib/supabase/server";

/**
 * Peak Music Rewind — the December year-in-review (Luca 2026-10-25,
 * "Mix 1: Late-night broadcast"). This file works out one member's
 * year from their published reviews and Song of the Day picks; the
 * story itself is components/rewind/RewindStory.tsx.
 *
 * WHEN IT'S OPEN: December 1 through January 15 (the year that just
 * ended, in January). Before that only the Founder, admins and Early
 * Testers can open it, so it can be checked on real accounts.
 */

/** Roles that can open Rewind before December. */
const PREVIEW_ROLES = new Set(["owner", "admin", "tester"]);

/**
 * Which year Rewind shows right now, or null when it's closed.
 * Plain server-clock dates: a few hours either side of midnight on
 * Dec 1 doesn't matter for a once-a-year page.
 */
export function rewindYear(now = new Date(), role: string | null = null): number | null {
  const m = now.getMonth(); // 0 = January
  if (m === 11) return now.getFullYear();
  if (m === 0 && now.getDate() <= 15) return now.getFullYear() - 1;
  return role && PREVIEW_ROLES.has(role) ? now.getFullYear() : null;
}

/** One record as the story shows it. */
export interface RewindRecord {
  title: string;
  artist: string;
  rating: number;
  cover: string | null;
}

export interface RewindData {
  year: number;
  name: string;
  handle: string;
  role: string | null;
  avatarUrl: string | null;
  /** Published reviews dated this year. */
  total: number;
  average: number;
  /** Reviews per month, January first. */
  months: number[];
  /** The year's best 10, highest first (ties → most recent first). */
  top: RewindRecord[];
  /** How many records got a perfect 10. */
  tens: number;
  /** The two lowest scores — only with 4+ records, and only when they
      sit clearly under the average (otherwise there's no "cold take"). */
  coldest: RewindRecord[];
  /** Most-rated artist (2+ records), with up to 3 of their covers. */
  artist: { name: string; count: number; covers: (string | null)[] } | null;
  runnerUp: { name: string; count: number } | null;
  /** Top artists by how many of their records were rated (up to 5),
      for the summary screen. Ties → the higher average first. */
  artists: { name: string; count: number; cover: string | null }[];
  /** Best song scores given this year (track_ratings, up to 5) — the
      summary shows these as "Top songs" when there are at least 3. */
  songs: { title: string; artist: string; rating: number; cover: string | null }[];
  /** Song of the Day: days picked this year + the longest run. */
  sotd: { days: number; longest: number; picked: string[]; from: string; to: string } | null;
}

interface SongRow {
  track_position: number;
  rating: number | string;
  updated_at: string;
  releases:
    | { artist: { name: string } | null; cover_image: string | null; tracks: { position: number; title: string }[] | null }
    | { artist: { name: string } | null; cover_image: string | null; tracks: { position: number; title: string }[] | null }[]
    | null;
}

interface ReviewRow {
  title: string;
  artist: string;
  rating: number | string;
  cover_image: string | null;
  review_date: string | null;
  created_at: string;
}

/**
 * The whole year for one member. A review belongs to its review_date
 * (the member's own local day); old rows without one fall back to when
 * they were created — the same rule as The Log and the month card.
 */
export async function getRewind(
  profile: {
    id: string;
    username: string;
    display_name: string | null;
    role: string | null;
    avatar_url: string | null;
  },
  year: number
): Promise<RewindData> {
  const supabase = await createClient();
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;

  const [reviewsRes, sotdRes, songsRes] = await Promise.all([
    supabase
      .from("reviews")
      .select("title, artist, rating, cover_image, review_date, created_at")
      .eq("user_id", profile.id)
      .eq("is_published", true)
      .or(
        `and(review_date.gte.${from},review_date.lt.${to}),and(review_date.is.null,created_at.gte.${from},created_at.lt.${to})`
      )
      .limit(2000),
    supabase
      .from("song_of_day")
      .select("picked_on")
      .eq("user_id", profile.id)
      .gte("picked_on", from)
      .lt("picked_on", to)
      .order("picked_on", { ascending: true })
      .limit(400),
    // Song-by-song scores given this year (migration 041), best first.
    // Song titles live on the release's tracklist, matched by position.
    supabase
      .from("track_ratings")
      .select("track_position, rating, updated_at, releases(cover_image, tracks, artist:artists!releases_primary_artist_id_fkey(name))")
      .eq("user_id", profile.id)
      .gte("updated_at", from)
      .lt("updated_at", to)
      .order("rating", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(40),
  ]);

  const rows = ((reviewsRes.data ?? []) as ReviewRow[]).map((r) => ({
    title: r.title,
    artist: r.artist,
    rating: Number(r.rating),
    cover: r.cover_image,
    day: r.review_date ?? r.created_at.slice(0, 10),
  }));

  const months = Array.from({ length: 12 }, () => 0);
  for (const r of rows) months[Number(r.day.slice(5, 7)) - 1] += 1;

  const ranked = [...rows]
    .sort((a, b) => b.rating - a.rating || b.day.localeCompare(a.day))
    .map(({ title, artist, rating, cover }) => ({ title, artist, rating, cover }));

  const average = rows.length
    ? Math.round((rows.reduce((s, r) => s + r.rating, 0) / rows.length) * 100) / 100
    : 0;

  // Most-rated artist. The artist text can hold features ("A, B"), so
  // count the lead name only.
  const byArtist = new Map<string, RewindRecord[]>();
  for (const r of ranked) {
    const lead = r.artist.split(/,| & | feat\. | ft\. /i)[0].trim();
    if (!lead) continue;
    byArtist.set(lead, [...(byArtist.get(lead) ?? []), r]);
  }
  // Most records first; a tie goes to the higher average.
  const avgOf = (rs: RewindRecord[]) => rs.reduce((s, r) => s + r.rating, 0) / rs.length;
  const artists = [...byArtist.entries()].sort((a, b) => b[1].length - a[1].length || avgOf(b[1]) - avgOf(a[1]));
  const topArtists = artists
    .slice(0, 5)
    .map(([name, rs]) => ({ name, count: rs.length, cover: rs[0].cover }));
  const top = artists[0];
  const second = artists[1];

  // Top songs: one row per song (a re-scored song counts once).
  const songs: RewindData["songs"] = [];
  const seenSongs = new Set<string>();
  for (const row of (songsRes.data ?? []) as unknown as SongRow[]) {
    const rel = Array.isArray(row.releases) ? row.releases[0] : row.releases;
    const track = rel?.tracks?.find((t) => t.position === row.track_position);
    if (!rel || !track) continue;
    const artist = rel.artist?.name ?? "";
    // Same song on a single and the album, or a " - Remix" / "(Live)"
    // version → counts once, under the best score.
    const base = track.title.split(" - ")[0].replace(/\s*[([].*$/, "");
    const key = `${artist}|${base}`.toLowerCase();
    if (seenSongs.has(key)) continue;
    seenSongs.add(key);
    songs.push({ title: track.title, artist, rating: Number(row.rating), cover: rel.cover_image });
    if (songs.length === 5) break;
  }

  // Song of the Day: count + longest run of consecutive days.
  const picked = ((sotdRes.data ?? []) as { picked_on: string }[]).map((r) => r.picked_on);
  let longest = 0;
  let run = 0;
  let prev: number | null = null;
  for (const day of picked) {
    const t = Date.parse(`${day}T00:00:00Z`);
    run = prev !== null && t - prev === 86_400_000 ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = t;
  }

  return {
    year,
    name: profile.display_name?.trim() || profile.username,
    handle: profile.username,
    role: profile.role,
    avatarUrl: profile.avatar_url,
    total: rows.length,
    average,
    months,
    top: ranked.slice(0, 10),
    tens: ranked.filter((r) => r.rating >= 10).length,
    coldest:
      ranked.length >= 4
        ? ranked
            .slice(-2)
            .reverse()
            .filter((r) => r.rating <= average - 1.5)
        : [],
    artist:
      top && top[1].length >= 2
        ? { name: top[0], count: top[1].length, covers: top[1].slice(0, 3).map((r) => r.cover) }
        : null,
    runnerUp:
      top && top[1].length >= 2 && second && second[1].length >= 2
        ? { name: second[0], count: second[1].length }
        : null,
    artists: topArtists,
    songs,
    sotd:
      picked.length >= 3
        ? { days: picked.length, longest, picked, from: picked[0], to: picked[picked.length - 1] }
        : null,
  };
}

/**
 * For the home page's Rewind card + one-time popup
 * (components/rewind/RewindPrompt.tsx): the year and their 9 best
 * covers, or null when Rewind is closed for this member or they rated
 * fewer than 3 records that year (/rewind would only say "not enough").
 * One small query; fails soft to null.
 */
export async function getRewindTeaser(
  userId: string,
  role: string | null
): Promise<{ year: number; covers: (string | null)[] } | null> {
  const year = rewindYear(new Date(), role);
  if (year === null) return null;
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;
  try {
    const supabase = await createClient();
    const { data, count } = await supabase
      .from("reviews")
      .select("cover_image", { count: "exact" })
      .eq("user_id", userId)
      .eq("is_published", true)
      .or(
        `and(review_date.gte.${from},review_date.lt.${to}),and(review_date.is.null,created_at.gte.${from},created_at.lt.${to})`
      )
      .order("rating", { ascending: false })
      .limit(9);
    if (!count || count < 3) return null;
    const rows = (data ?? []) as { cover_image: string | null }[];
    return { year, covers: rows.map((r) => r.cover_image) };
  } catch {
    return null;
  }
}
