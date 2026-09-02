import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { deleteList, getListById, updateList } from "@/lib/db/lists";
import type { List } from "@/lib/types/database";
import { checkContent } from "@/lib/content-filter";

// Basic UUID shape check so obviously-bad ids fail fast with a 400
// instead of hitting the database.
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shared guard for both handlers: validate the id, load the list,
 * and make sure the signed-in user owns it. Returns either the list
 * or a ready-to-send error response.
 */
async function requireOwnedList(
  listId: string
): Promise<{ list: List } | { errorResponse: NextResponse }> {
  const user = await getUser();
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  if (!UUID_RE.test(listId)) {
    return {
      errorResponse: NextResponse.json(
        { error: "Invalid list id." },
        { status: 400 }
      ),
    };
  }

  const list = await getListById(listId);
  if (!list) {
    return {
      errorResponse: NextResponse.json(
        { error: "List not found." },
        { status: 404 }
      ),
    };
  }

  if (list.user_id !== user.id) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { list };
}

/**
 * PATCH /api/lists/[listId] — update title / description /
 * is_ranked / is_public. Only fields present in the body change.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;

  const guard = await requireOwnedList(listId);
  if ("errorResponse" in guard) return guard.errorResponse;

  try {
    const body = await request.json();
    const { title, description, is_ranked, is_public } = body;

    // Build the updates object field by field, validating each one.
    const updates: Partial<
      Pick<List, "title" | "description" | "is_ranked" | "is_public">
    > = {};

    if (title !== undefined) {
      if (typeof title !== "string" || !title.trim()) {
        return NextResponse.json(
          { error: "Title cannot be empty." },
          { status: 400 }
        );
      }
      if (title.trim().length > 120) {
        return NextResponse.json(
          { error: "Title must be 120 characters or fewer." },
          { status: 400 }
        );
      }
      updates.title = title.trim();
      // Note: we intentionally do NOT regenerate the slug on rename,
      // so existing links to the list keep working.
    }

    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return NextResponse.json(
          { error: "Description must be text or null." },
          { status: 400 }
        );
      }
      const trimmed = typeof description === "string" ? description.trim() : null;
      if (trimmed && trimmed.length > 2000) {
        return NextResponse.json(
          { error: "Description must be 2000 characters or fewer." },
          { status: 400 }
        );
      }
      updates.description = trimmed || null;
    }

    // Zero-tolerance filter (App Store 1.2) — slurs never hit the DB.
    const dirty = checkContent(updates.title, updates.description);
    if (dirty) return NextResponse.json({ error: dirty }, { status: 400 });

    if (is_ranked !== undefined) {
      if (typeof is_ranked !== "boolean") {
        return NextResponse.json(
          { error: "is_ranked must be true or false." },
          { status: 400 }
        );
      }
      updates.is_ranked = is_ranked;
    }

    if (is_public !== undefined) {
      if (typeof is_public !== "boolean") {
        return NextResponse.json(
          { error: "is_public must be true or false." },
          { status: 400 }
        );
      }
      updates.is_public = is_public;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 }
      );
    }

    const updated = await updateList(listId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update list." },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}

/**
 * DELETE /api/lists/[listId] — delete a list (items and likes
 * cascade-delete in the database).
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;

  const guard = await requireOwnedList(listId);
  if ("errorResponse" in guard) return guard.errorResponse;

  const success = await deleteList(listId);
  if (!success) {
    // deleteList now distinguishes "zero rows went" from a real error
    // and returns false for both. The ownership guard above already
    // passed, so a silent zero-row delete means an RLS policy refused
    // it — before migration 038 that was every staff session without
    // the admin email code deleting its OWN list. Say so instead of a
    // generic 500 so the next person hitting it isn't guessing.
    return NextResponse.json(
      {
        error:
          "The list wasn't deleted — a database policy refused it. If you're staff, sign in through the admin flow (or make sure migration 038 has been run).",
      },
      { status: 403 }
    );
  }

  return NextResponse.json({ success: true });
}
