import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  getListById,
  getListItemById,
  removeListItem,
  updateListItem,
} from "@/lib/db/lists";
import type { ListItem } from "@/lib/types/database";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Shared guard: validate both ids, load the item, make sure it really
 * belongs to this list, and that the signed-in user owns the parent
 * list. Ownership always flows through the parent list — items don't
 * have their own user_id column.
 */
async function requireOwnedItem(
  listId: string,
  itemId: string
): Promise<{ item: ListItem } | { errorResponse: NextResponse }> {
  const user = await getUser();
  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      ),
    };
  }

  if (!UUID_RE.test(listId) || !UUID_RE.test(itemId)) {
    return {
      errorResponse: NextResponse.json(
        { error: "Invalid id." },
        { status: 400 }
      ),
    };
  }

  const item = await getListItemById(itemId);
  // The item must exist AND live inside the list from the URL.
  if (!item || item.list_id !== listId) {
    return {
      errorResponse: NextResponse.json(
        { error: "Item not found." },
        { status: 404 }
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

  return { item };
}

/**
 * PATCH /api/lists/[listId]/items/[itemId] — update an item's note
 * and/or position. Body: { note?, position? }
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  const { listId, itemId } = await params;

  const guard = await requireOwnedItem(listId, itemId);
  if ("errorResponse" in guard) return guard.errorResponse;

  try {
    const body = await request.json();
    const { note, position } = body;

    const updates: Partial<Pick<ListItem, "note" | "position">> = {};

    if (note !== undefined) {
      if (note !== null && typeof note !== "string") {
        return NextResponse.json(
          { error: "Note must be text or null." },
          { status: 400 }
        );
      }
      const trimmed = typeof note === "string" ? note.trim() : null;
      if (trimmed && trimmed.length > 500) {
        return NextResponse.json(
          { error: "Note must be 500 characters or fewer." },
          { status: 400 }
        );
      }
      updates.note = trimmed || null;
    }

    if (position !== undefined) {
      if (
        typeof position !== "number" ||
        !Number.isInteger(position) ||
        position < 0
      ) {
        return NextResponse.json(
          { error: "Position must be a whole number of 0 or more." },
          { status: 400 }
        );
      }
      updates.position = position;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "Nothing to update." },
        { status: 400 }
      );
    }

    const updated = await updateListItem(itemId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update item." },
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
 * DELETE /api/lists/[listId]/items/[itemId] — remove an item from a
 * list you own.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ listId: string; itemId: string }> }
) {
  const { listId, itemId } = await params;

  const guard = await requireOwnedItem(listId, itemId);
  if ("errorResponse" in guard) return guard.errorResponse;

  const success = await removeListItem(itemId);
  if (!success) {
    return NextResponse.json(
      { error: "Failed to remove item." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
