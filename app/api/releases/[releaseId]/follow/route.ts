import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  followRelease,
  isFollowingRelease,
  unfollowRelease,
} from "@/lib/db/releases";

/**
 * POST /api/releases/[releaseId]/follow — Toggle following a release.
 * Returns `{ following: boolean }` reflecting the new state.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ releaseId: string }> }
) {
  const { releaseId } = await params;

  if (!releaseId) {
    return NextResponse.json(
      { error: "releaseId is required" },
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
