import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  getDiaryEntryById,
  updateDiaryEntry,
  deleteDiaryEntry,
} from "@/lib/db/diary";
import type { DiaryEntry } from "@/lib/types/database";

/* ============================================
   /api/diary/[entryId]
   PATCH  — edit your own diary entry
   DELETE — remove your own diary entry

   Both check ownership in the route (fetch row, compare user_id
   against the session user) AND rely on RLS as the safety net —
   even if this code had a bug, Postgres would refuse to touch
   someone else's row.
   ============================================ */

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Same date rule as the create route: real date, not in the future. */
function isValidPastOrTodayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(value + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime())) return false;
  // Reject impossible dates (2026-02-31 would re-format differently).
  if (parsed.toISOString().slice(0, 10) !== value) return false;

  const todayUtc = new Date().toISOString().slice(0, 10);
  return value <= todayUtc;
}

/**
 * Shared guard for PATCH/DELETE: authenticates, validates the id,
 * loads the entry, and verifies ownership. Returns either the entry
 * or a ready-to-send error response.
 */
async function authorizeEntry(
  entryId: string
): Promise<{ entry: DiaryEntry } | { errorResponse: NextResponse }> {
  const user = await getUser();
  if (!user) {
    return {
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  // Reject junk ids up front — a malformed uuid would otherwise cause
  // a noisy Postgres cast error instead of a clean 400.
  if (!UUID_REGEX.test(entryId)) {
    return {
      errorResponse: NextResponse.json(
        { error: "Invalid entry id." },
        { status: 400 }
      ),
    };
  }

  const entry = await getDiaryEntryById(entryId);
  if (!entry) {
    return {
      errorResponse: NextResponse.json({ error: "Entry not found." }, { status: 404 }),
    };
  }

  // Ownership check: only the author may modify their diary.
  if (entry.user_id !== user.id) {
    return {
      errorResponse: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { entry };
}

/**
 * PATCH /api/diary/[entryId] — partial update.
 * Only fields present in the body are validated and changed;
 * everything else keeps its current value.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;

  const auth = await authorizeEntry(entryId);
  if ("errorResponse" in auth) return auth.errorResponse;

  try {
    const body = await request.json();

    // Collect only the validated fields we're actually changing.
    const updates: Partial<
      Omit<DiaryEntry, "id" | "user_id" | "created_at" | "updated_at">
    > = {};

    // --- title (optional in PATCH, but can't be blanked out) ---
    if (body.title !== undefined) {
      if (
        typeof body.title !== "string" ||
        !body.title.trim() ||
        body.title.trim().length > 200
      ) {
        return NextResponse.json(
          { error: "Title must be a non-empty string (max 200 characters)." },
          { status: 400 }
        );
      }
      updates.title = body.title.trim();
    }

    // --- artist ---
    if (body.artist !== undefined) {
      if (
        typeof body.artist !== "string" ||
        !body.artist.trim() ||
        body.artist.trim().length > 200
      ) {
        return NextResponse.json(
          { error: "Artist must be a non-empty string (max 200 characters)." },
          { status: 400 }
        );
      }
      updates.artist = body.artist.trim();
    }

    // --- rating: number 0–10 (1 decimal) or null to clear it ---
    if (body.rating !== undefined) {
      if (body.rating === null) {
        updates.rating = null;
      } else {
        if (typeof body.rating !== "number" || !Number.isFinite(body.rating)) {
          return NextResponse.json(
            { error: "Rating must be a number." },
            { status: 400 }
          );
        }
        if (body.rating < 0 || body.rating > 10) {
          return NextResponse.json(
            { error: "Rating must be between 0 and 10." },
            { status: 400 }
          );
        }
        updates.rating = Math.round(body.rating * 10) / 10;
      }
    }

    // --- note: string ≤500 chars or null to clear ---
    if (body.note !== undefined) {
      if (body.note === null) {
        updates.note = null;
      } else {
        if (typeof body.note !== "string" || body.note.length > 500) {
          return NextResponse.json(
            { error: "Note must be 500 characters or fewer." },
            { status: 400 }
          );
        }
        updates.note = body.note.trim() || null;
      }
    }

    // --- listened_on: valid non-future date ---
    if (body.listened_on !== undefined) {
      if (
        typeof body.listened_on !== "string" ||
        !isValidPastOrTodayDate(body.listened_on)
      ) {
        return NextResponse.json(
          { error: "listened_on must be a valid date that isn't in the future." },
          { status: 400 }
        );
      }
      updates.listened_on = body.listened_on;
    }

    // --- is_relisten: boolean ---
    if (body.is_relisten !== undefined) {
      if (typeof body.is_relisten !== "boolean") {
        return NextResponse.json(
          { error: "is_relisten must be true or false." },
          { status: 400 }
        );
      }
      updates.is_relisten = body.is_relisten;
    }

    // --- release_id: UUID or null to detach ---
    if (body.release_id !== undefined) {
      if (body.release_id === null) {
        updates.release_id = null;
      } else {
        if (
          typeof body.release_id !== "string" ||
          !UUID_REGEX.test(body.release_id)
        ) {
          return NextResponse.json(
            { error: "release_id must be a valid UUID." },
            { status: 400 }
          );
        }
        updates.release_id = body.release_id;
      }
    }

    // --- cover_image: string or null to clear ---
    if (body.cover_image !== undefined) {
      if (body.cover_image === null) {
        updates.cover_image = null;
      } else {
        if (
          typeof body.cover_image !== "string" ||
          body.cover_image.length > 1000
        ) {
          return NextResponse.json(
            { error: "cover_image must be a URL string." },
            { status: 400 }
          );
        }
        updates.cover_image = body.cover_image.trim() || null;
      }
    }

    // Nothing recognized in the body? Tell the caller instead of
    // silently doing a no-op write.
    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update." },
        { status: 400 }
      );
    }

    const updated = await updateDiaryEntry(entryId, updates);
    if (!updated) {
      return NextResponse.json(
        { error: "Failed to update entry." },
        { status: 500 }
      );
    }

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}

/**
 * DELETE /api/diary/[entryId] — remove an entry you own.
 */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ entryId: string }> }
) {
  const { entryId } = await params;

  const auth = await authorizeEntry(entryId);
  if ("errorResponse" in auth) return auth.errorResponse;

  const success = await deleteDiaryEntry(entryId);
  if (!success) {
    return NextResponse.json(
      { error: "Failed to delete entry." },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
