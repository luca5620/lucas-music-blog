/**
 * Community Spotlight (migration 068, 2026-10-30) — one album a week
 * that everyone listens to, rates and talks about.
 *
 * Why it exists: people joined, rated a few things on their own and
 * drifted off. Of the 203 records reviewed in the 30 days before this
 * shipped, 189 had exactly ONE review — nobody ever overlapped, so
 * there was nothing to talk about. The spotlight gives everyone the
 * same record for a week (idea: michorex on Discord).
 *
 * Reads are anon-safe (the table is public-read); picking a week goes
 * through /api/admin/spotlight, staff only.
 */

import { createClient } from "@/lib/supabase/server";

/** The current week's pick, with what the home section + album page need. */
export interface CurrentSpotlight {
  id: string;
  /** 1 for the first spotlight ever, 2 for the next… */
  weekNumber: number;
  startsAt: string;
  endsAt: string;
  note: string | null;
  release: {
    id: string;
    slug: string;
    title: string;
    cover_image: string | null;
    release_date: string | null;
    trackCount: number;
    artistName: string;
  };
  /** Published ratings of this record since the week started. */
  ratedThisWeek: number;
  /** Up to 4 of those people, newest first — the avatar pile. */
  recentRaters: { username: string; display_name: string | null; avatar_url: string | null }[];
}

type SpotlightRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  note: string | null;
  releases: {
    id: string;
    slug: string;
    title: string;
    cover_image: string | null;
    release_date: string | null;
    tracks: unknown[] | null;
    artists: { name: string } | { name: string }[] | null;
  } | null;
};

/**
 * The spotlight running right now, or null between weeks / before the
 * first pick / if migration 068 hasn't been run yet (every error fails
 * soft to null so the home page and album page just skip it).
 */
export async function getCurrentSpotlight(): Promise<CurrentSpotlight | null> {
  try {
    const supabase = await createClient();
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("spotlight_weeks")
      .select(
        // FK-qualified artist embed, same as the rest of the catalog code.
        "id, starts_at, ends_at, note, releases!inner(id, slug, title, cover_image, release_date, tracks, artists!releases_primary_artist_id_fkey(name))"
      )
      .lte("starts_at", now)
      .gt("ends_at", now)
      .order("starts_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as unknown as SpotlightRow;
    const rel = row.releases;
    if (!rel) return null;
    const artist = Array.isArray(rel.artists) ? rel.artists[0] : rel.artists;

    // Week number + this week's raters, side by side.
    const [{ count: earlier }, { count: rated }, { data: raters }] = await Promise.all([
      supabase
        .from("spotlight_weeks")
        .select("id", { count: "exact", head: true })
        .lte("starts_at", row.starts_at),
      supabase
        .from("reviews")
        .select("id", { count: "exact", head: true })
        .eq("release_id", rel.id)
        .eq("is_published", true)
        .gte("created_at", row.starts_at),
      supabase
        .from("reviews")
        .select("profiles!reviews_user_id_fkey!inner(username, display_name, avatar_url)")
        .eq("release_id", rel.id)
        .eq("is_published", true)
        .gte("created_at", row.starts_at)
        .order("created_at", { ascending: false })
        .limit(4),
    ]);

    type RaterRow = { profiles: CurrentSpotlight["recentRaters"][number] | CurrentSpotlight["recentRaters"] };
    const recentRaters = ((raters ?? []) as unknown as RaterRow[])
      .map((r) => (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles))
      .filter(Boolean);

    return {
      id: row.id,
      weekNumber: earlier ?? 1,
      startsAt: row.starts_at,
      endsAt: row.ends_at,
      note: row.note,
      release: {
        id: rel.id,
        slug: rel.slug,
        title: rel.title,
        cover_image: rel.cover_image,
        release_date: rel.release_date,
        trackCount: Array.isArray(rel.tracks) ? rel.tracks.length : 0,
        artistName: artist?.name ?? "",
      },
      ratedThisWeek: rated ?? 0,
      recentRaters,
    };
  } catch {
    return null;
  }
}

/**
 * Whole days left in the week, rounded up (Monday morning → 7, Sunday
 * afternoon → 1). 1 reads as "last day" in the UI.
 */
export function spotlightDaysLeft(endsAt: string, now: number): number {
  return Math.max(1, Math.ceil((new Date(endsAt).getTime() - now) / 86_400_000));
}

/** The viewer's own published score for a record, or null. */
export async function getViewerRating(
  userId: string,
  releaseId: string
): Promise<number | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("reviews")
    .select("rating")
    .eq("user_id", userId)
    .eq("release_id", releaseId)
    .eq("is_published", true)
    .limit(1)
    .maybeSingle<{ rating: number }>();
  return data ? Number(data.rating) : null;
}
