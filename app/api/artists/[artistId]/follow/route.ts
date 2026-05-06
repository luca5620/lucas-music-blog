import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  followArtist,
  isFollowingArtist,
  unfollowArtist,
} from "@/lib/db/artists";

/**
 * POST /api/artists/[artistId]/follow — Toggle following an artist.
 * Returns `{ following: boolean }` reflecting the new state.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const { artistId } = await params;

  if (!artistId) {
    return NextResponse.json(
      { error: "artistId is required" },
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
    const currentlyFollowing = await isFollowingArtist(user.id, artistId);

    if (currentlyFollowing) {
      await unfollowArtist(user.id, artistId);
      return NextResponse.json({ following: false });
    }

    await followArtist(user.id, artistId);
    return NextResponse.json({ following: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to toggle follow" },
      { status: 500 }
    );
  }
}
