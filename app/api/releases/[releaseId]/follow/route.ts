import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  followRelease,
  isFollowingRelease,
  unfollowRelease,
} from "@/lib/db/releases";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

/**
 * POST /api/releases/[releaseId]/follow — Toggle following a release.
 * Returns `{ following: boolean }` reflecting the new state.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const { releaseId } = await params;

  // Release ids are uuids — anything else is junk and never reaches
  // the database.
  if (!isUuid(releaseId)) {
    return NextResponse.json(
      { error: "releaseId must be a valid id" },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Shares the artist-follow bucket: one 30/min budget for following
  // "things" (artists + releases), separate from following people.
  const limited = await rateLimit(`entity-follow:${user.id}`, 30, 60_000);
  if (limited) return limited;

  try {
    const currentlyFollowing = await isFollowingRelease(user.id, releaseId);

    if (currentlyFollowing) {
      await unfollowRelease(user.id, releaseId);
      return NextResponse.json({ following: false });
    }

    await followRelease(user.id, releaseId);
    return NextResponse.json({ following: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to toggle follow" },
      { status: 500 }
    );
  }
}
