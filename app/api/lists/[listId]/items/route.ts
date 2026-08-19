import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { addListItem, getListById, reorderListItems } from "@/lib/db/lists";
import { getReleaseById } from "@/lib/db/releases";
import { getArtistById } from "@/lib/db/artists";
import { rateLimit } from "@/lib/rate-limit";
import type { List } from "@/lib/types/database";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Validate the listId, load the list, and require that the signed-in
 * user owns it (items can only be managed by the list owner).
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
 * POST /api/lists/[listId]/items — add an item to a list you own.
 * Body: { release_id, note?, position }
 *
 * Overhaul v2: items can ONLY reference a real catalog release.
 * The client never sends title/artist/cover — we derive them here
 * from the release row, so a tampered request can't invent a fake
 * album or point the cover at a hostile URL.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ listId: string }> }
) {
  const { listId } = await params;

  const guard = await requireOwnedList(listId);
  if ("errorResponse" in guard) return guard.errorResponse;

  // Guard is only reached when signed in, so key the limiter on the
  // list owner. 60 item-adds per minute is plenty for a human.
  const owner = guard.list.user_id;
  const limited = rateLimit(`list-items:${owner}`, 60, 60_000);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { note, position, release_id } = body;

    // --- release_id: REQUIRED — a UUID pointing at a real release ---
    if (typeof release_id !== "string" || !UUID_RE.test(release_id)) {
      return NextResponse.json(
        { error: "Pick a release from the catalog search." },
        { status: 400 }
      );
    }
    const release = await getReleaseById(release_id);
    if (!release) {
      return NextResponse.json(
        { error: "Release not found." },
        { status: 400 }
      );
    }

    // --- note: optional, up to 500 chars (matches the DB check) ---
    if (note !== undefined && note !== null && typeof note !== "string") {
      return NextResponse.json(
        { error: "Note must be text or null." },
        { status: 400 }
      );
    }
    const trimmedNote = typeof note === "string" ? note.trim() : null;
    if (trimmedNote && trimmedNote.length > 500) {
      return NextResponse.json(
        { error: "Note must be 500 characters or fewer." },
        { status: 400 }
      );
    }

    // --- position: required, whole number, 0 or greater ---
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

    // Denormalize title/artist/cover FROM THE CATALOG, never from
    // the request. The artist name comes off the primary artist row.
    const primaryArtist = await getArtistById(release.primary_artist_id);

    const item = await addListItem({
      list_id: listId,
      release_id: release.id,
      title: release.title,
      artist: primaryArtist?.name ?? "Unknown Artist",
      cover_image: release.cover_image,
      note: trimmedNote || null,
      position,
    });

    if (!item) {
      return NextResponse.json(
        { error: "Failed to add item." },
        { status: 500 }
      );
    }

    return NextResponse.json(item, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}

/**
 * PATCH /api/lists/[listId]/items — reorder a list's items.
 * Body: { orderedItemIds: [uuid, uuid, ...] } — first id becomes
 * position 0, second becomes position 1, and so on.
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
    const { orderedItemIds } = body;

    if (
      !Array.isArray(orderedItemIds) ||
      orderedItemIds.length === 0 ||
      !orderedItemIds.every(
        (id) => typeof id === "string" && UUID_RE.test(id)
      )
    ) {
      return NextResponse.json(
        { error: "orderedItemIds must be a non-empty array of UUIDs." },
        { status: 400 }
      );
    }

    const success = await reorderListItems(listId, orderedItemIds as string[]);
    if (!success) {
      return NextResponse.json(
        { error: "Failed to reorder items." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
