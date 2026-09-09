import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getReleaseById } from "@/lib/db/releases";
import {
  deleteTrackRating,
  getTrackRatingSummaries,
  upsertTrackRating,
} from "@/lib/db/track-ratings";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

/**
 * POST /api/releases/[releaseId]/track-ratings — rate one song.
 * Body: { position: number, rating: number | null }
 *   rating 0–10 (one decimal) sets/replaces the viewer's score;
 *   null clears it.
 * Returns the refreshed summary for that track:
 *   { position, avg, count, mine }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const { releaseId } = await params;
  if (!isUuid(releaseId)) {
    return NextResponse.json({ error: "Bad release id" }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // A whole tracklist rated in one sitting is ~20 taps; 90/min leaves
  // room for slider fiddling without letting a script hammer it.
  const limited = await rateLimit(`track-rating:${user.id}`, 90, 60_000);
  if (limited) return limited;

  let body: { position?: unknown; rating?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const position = body.position;
  if (!Number.isInteger(position) || (position as number) < 1 || (position as number) > 120) {
    return NextResponse.json({ error: "Bad position" }, { status: 400 });
  }

  // The position must name a real track on THIS release — no rating
  // slot 40 on a 12-song album.
  const release = await getReleaseById(releaseId);
  if (!release) {
    return NextResponse.json({ error: "Release not found" }, { status: 404 });
  }
  const tracks = release.tracks ?? [];
  if (!tracks.some((t) => t.position === position)) {
    return NextResponse.json({ error: "No such track" }, { status: 400 });
  }

  let ok: boolean;
  if (body.rating === null) {
    ok = await deleteTrackRating(user.id, releaseId, position as number);
  } else {
    const raw = typeof body.rating === "number" ? body.rating : Number.NaN;
    if (!Number.isFinite(raw) || raw < 0 || raw > 10) {
      return NextResponse.json({ error: "Rating must be 0–10" }, { status: 400 });
    }
    const rating = Math.round(raw * 10) / 10;
    ok = await upsertTrackRating(user.id, releaseId, position as number, rating);
  }
  if (!ok) {
    return NextResponse.json({ error: "Failed to save rating" }, { status: 500 });
  }

  const summaries = await getTrackRatingSummaries(releaseId, user.id);
  return NextResponse.json(
    summaries[position as number] ?? { position, avg: null, count: 0, mine: null }
  );
}
