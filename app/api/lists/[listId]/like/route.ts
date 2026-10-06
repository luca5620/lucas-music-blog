import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getListById, toggleListLike } from "@/lib/db/lists";
import { createNotification } from "@/lib/db/notifications";
import { BLOCKED_ACTION_ERROR, isBlockedBy } from "@/lib/db/moderation";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";

/**
 * POST /api/lists/[listId]/like — Toggle like on a list.
 * Returns the updated like count and whether the user has liked.
 * (Mirrors /api/reviews/[reviewId]/like.)
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ listId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Shares the `like:` bucket with review + post likes: 30 like
  // toggles a minute across every content type. This route had NO
  // limit before — and every like fans out a notification + a push,
  // so a like/unlike script could have buzzed someone's phone nonstop.
  const limited = await rateLimit(`like:${user.id}`, 30, 60_000);
  if (limited) return limited;

  const { listId } = await params;

  if (!isUuid(listId)) {
    return NextResponse.json({ error: "Invalid list id." }, { status: 400 });
  }

  // Make sure the list exists and is visible to this viewer. Because
  // the query runs with the viewer's session, RLS hides other people's
  // private lists — those come back null and 404 here.
  const list = await getListById(listId);
  if (!list) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  // Blocked by the list's owner → no new like (migration 052);
  // un-liking stays allowed (same rule as the review-like route).
  if (await isBlockedBy(list.user_id)) {
    const { data: mine } = await supabase
      .from("list_likes")
      .select("id")
      .eq("user_id", user.id)
      .eq("list_id", listId)
      .maybeSingle();
    if (!mine) {
      return NextResponse.json({ error: BLOCKED_ACTION_ERROR }, { status: 403 });
    }
  }

  const result = await toggleListLike(user.id, listId);

  // A LIKE rings the owner's bell. List URLs carry the owner's
  // username, so resolve it for the href.
  if (result.liked) {
    const { data: ownerRow } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", list.user_id)
      .maybeSingle();
    const ownerName = (ownerRow as { username?: string } | null)?.username;
    if (ownerName) {
      await createNotification({
        recipientId: list.user_id,
        actorId: user.id,
        type: "list_like",
        href: `/lists/${ownerName}/${list.slug}`,
        title: list.title,
      });
    }
  }

  return NextResponse.json(result);
}
