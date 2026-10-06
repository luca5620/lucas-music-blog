import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  followArtist,
  isFollowingArtist,
  unfollowArtist,
} from "@/lib/db/artists";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

/**
 * POST /api/artists/[artistId]/follow — Toggle following an artist.
 * Returns `{ following: boolean }` reflecting the new state.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ artistId: string }> }
) {
  const { artistId } = await params;

  // Artist ids are uuids — anything else is junk and never reaches
  // the database.
  if (!isUuid(artistId)) {
    return NextResponse.json(
      { error: "artistId must be a valid id" },
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

  // Following an artist is a quiet toggle (no bell, no push), but it's
  // still a write. Same 30/min as following people.
  const limited = await rateLimit(`entity-follow:${user.id}`, 30, 60_000);
  if (limited) return limited;

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
