/**
 * Per-song ratings (migration 041) — the tracklist's own scores,
 * separate from the review's record-level rating.
 *
 * One read per release page (every row for the release, aggregated
 * here in JS — a release has at most 120 tracks and, at our size,
 * tens of ratings), and one upsert/delete per tap on the release
 * page. Every read fails soft to "no ratings" so a release page never
 * 500s because the migration hasn't run yet.
 */

import { createClient } from "@/lib/supabase/server";

export interface TrackRatingRow {
  user_id: string;
  track_position: number;
  rating: number;
}

/** What the release page renders per track. */
export interface TrackRatingSummary {
  position: number;
  /** Community average, null until someone rates the track. */
  avg: number | null;
  count: number;
  /** The viewer's own score, null when they haven't rated it. */
  mine: number | null;
}

export async function getTrackRatingRows(releaseId: string): Promise<TrackRatingRow[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("track_ratings")
      .select("user_id, track_position, rating")
      .eq("release_id", releaseId);
    if (error) return [];
    return ((data ?? []) as { user_id: string; track_position: number; rating: number | string }[]).map(
      (r) => ({ user_id: r.user_id, track_position: r.track_position, rating: Number(r.rating) })
    );
  } catch {
    return [];
  }
}

/** Fold the rows into one summary per rated position. Positions with
    no ratings are simply absent — callers treat that as unrated. */
export function summarizeTrackRatings(
  rows: TrackRatingRow[],
  viewerId?: string | null
): Record<number, TrackRatingSummary> {
  const out: Record<number, TrackRatingSummary> = {};
  const sums = new Map<number, { total: number; count: number }>();
  for (const r of rows) {
    const s = sums.get(r.track_position) ?? { total: 0, count: 0 };
    s.total += r.rating;
    s.count += 1;
    sums.set(r.track_position, s);
    if (viewerId && r.user_id === viewerId) {
      out[r.track_position] = {
        position: r.track_position,
        avg: null,
        count: 0,
        mine: r.rating,
      };
    }
  }
  for (const [position, s] of sums) {
    const prev = out[position];
    out[position] = {
      position,
      avg: Math.round((s.total / s.count) * 10) / 10,
      count: s.count,
      mine: prev?.mine ?? null,
    };
  }
  return out;
}

export async function getTrackRatingSummaries(
  releaseId: string,
  viewerId?: string | null
): Promise<Record<number, TrackRatingSummary>> {
  return summarizeTrackRatings(await getTrackRatingRows(releaseId), viewerId);
}

/** One member's scores on one release — the review page's "Track by
    Track" card. Position → rating. */
export async function getMemberTrackRatings(
  userId: string,
  releaseId: string
): Promise<Record<number, number>> {
  const rows = await getTrackRatingRows(releaseId);
  const out: Record<number, number> = {};
  for (const r of rows) if (r.user_id === userId) out[r.track_position] = r.rating;
  return out;
}

export async function upsertTrackRating(
  userId: string,
  releaseId: string,
  position: number,
  rating: number
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase.from("track_ratings").upsert(
    {
      user_id: userId,
      release_id: releaseId,
      track_position: position,
      rating,
    } as never,
    { onConflict: "user_id,release_id,track_position" }
  );
  return !error;
}

export async function deleteTrackRating(
  userId: string,
  releaseId: string,
  position: number
): Promise<boolean> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("track_ratings")
    .delete()
    .eq("user_id", userId)
    .eq("release_id", releaseId)
    .eq("track_position", position);
  return !error;
}
