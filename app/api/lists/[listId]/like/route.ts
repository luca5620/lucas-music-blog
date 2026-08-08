import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getListById, toggleListLike } from "@/lib/db/lists";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  const { listId } = await params;

  if (!listId || !UUID_RE.test(listId)) {
    return NextResponse.json({ error: "Invalid list id." }, { status: 400 });
  }

  // Make sure the list exists and is visible to this viewer. Because
  // the query runs with the viewer's session, RLS hides other people's
  // private lists — those come back null and 404 here.
  const list = await getListById(listId);
  if (!list) {
    return NextResponse.json({ error: "List not found." }, { status: 404 });
  }

  const result = await toggleListLike(user.id, listId);

  return NextResponse.json(result);
}
