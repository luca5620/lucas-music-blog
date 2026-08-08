import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { followUser, unfollowUser, isFollowing } from "@/lib/db/profiles";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

/**
 * POST /api/follow — Follow a user.
 * Body: { followingId: string }
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Max 30 follow actions per user per minute (stops follow-spam loops).
  const limited = rateLimit(`follow:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const body = await request.json();
  const { followingId } = body;

  if (!isUuid(followingId)) {
    return NextResponse.json(
      { error: "followingId must be a valid id" },
      { status: 400 }
    );
  }

  if (user.id === followingId) {
    return NextResponse.json(
      { error: "Cannot follow yourself" },
      { status: 400 }
    );
  }

  const success = await followUser(user.id, followingId);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to follow user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ following: true });
}

/**
 * DELETE /api/follow — Unfollow a user.
 * Body: { followingId: string }
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { followingId } = body;

  if (!isUuid(followingId)) {
    return NextResponse.json(
      { error: "followingId must be a valid id" },
      { status: 400 }
    );
  }

  const success = await unfollowUser(user.id, followingId);

  if (!success) {
    return NextResponse.json(
      { error: "Failed to unfollow user" },
      { status: 500 }
    );
  }

  return NextResponse.json({ following: false });
}
