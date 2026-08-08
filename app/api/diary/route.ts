import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { createDiaryEntry, getDiaryEntries } from "@/lib/db/diary";
import { getProfileByUsername } from "@/lib/db/profiles";
import { rateLimit } from "@/lib/rate-limit";

/* ============================================
   /api/diary
   POST — log a listen (auth required)
   GET  — list a user's entries by ?username= or ?userId= (public)
   ============================================ */

// Standard UUID shape (8-4-4-4-12 hex). Used for release_id / userId.
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * True when `value` is a real calendar date in YYYY-MM-DD form that is
 * not in the future. The round-trip through Date catches impossible
 * dates like 2026-02-31 (which JS would silently roll into March).
 * "Today" is measured in UTC — close enough for a listening diary.
 */
function isValidPastOrTodayDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;

  const parsed = new Date(value + "T00:00:00Z");
  if (Number.isNaN(parsed.getTime())) return false;

  // Round-trip check: "2026-02-31" parses but re-formats as "2026-03-03".
  if (parsed.toISOString().slice(0, 10) !== value) return false;

  const todayUtc = new Date().toISOString().slice(0, 10);
  // String comparison works because YYYY-MM-DD sorts chronologically.
  return value <= todayUtc;
}

/**
 * POST /api/diary — create a diary entry for the logged-in user.
 * user_id ALWAYS comes from the session, never from the request body,
 * so nobody can write into someone else's diary.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Max 20 diary logs per user per minute.
  const limited = rateLimit(`diary:${user.id}`, 20, 60_000);
  if (limited) return limited;

  try {
    const body = await request.json();
    const {
      title,
      artist,
      cover_image,
      listened_on,
      rating,
      note,
      is_relisten,
      release_id,
    } = body;

    // --- title / artist: required non-empty strings, max 200 chars ---
    if (typeof title !== "string" || !title.trim() || title.trim().length > 200) {
      return NextResponse.json(
        { error: "Title is required (max 200 characters)." },
        { status: 400 }
      );
    }
    if (
      typeof artist !== "string" ||
      !artist.trim() ||
      artist.trim().length > 200
    ) {
      return NextResponse.json(
        { error: "Artist is required (max 200 characters)." },
        { status: 400 }
      );
    }

    // --- rating: optional; when present must be a number 0–10 ---
    // We round to 1 decimal to match the numeric(3,1) column.
    let ratingValue: number | null = null;
    if (rating !== undefined && rating !== null) {
      if (typeof rating !== "number" || !Number.isFinite(rating)) {
        return NextResponse.json(
          { error: "Rating must be a number." },
          { status: 400 }
        );
      }
      if (rating < 0 || rating > 10) {
        return NextResponse.json(
          { error: "Rating must be between 0 and 10." },
          { status: 400 }
        );
      }
      ratingValue = Math.round(rating * 10) / 10;
    }

    // --- note: optional short thought, max 500 chars (matches DB check) ---
    let noteValue: string | null = null;
    if (note !== undefined && note !== null) {
      if (typeof note !== "string" || note.length > 500) {
        return NextResponse.json(
          { error: "Note must be 500 characters or fewer." },
          { status: 400 }
        );
      }
      noteValue = note.trim() || null; // whitespace-only note = no note
    }

    // --- listened_on: defaults to today; must be a valid, non-future date ---
    let listenedOnValue = new Date().toISOString().slice(0, 10);
    if (listened_on !== undefined && listened_on !== null) {
      if (
        typeof listened_on !== "string" ||
        !isValidPastOrTodayDate(listened_on)
      ) {
        return NextResponse.json(
          { error: "listened_on must be a valid date that isn't in the future." },
          { status: 400 }
        );
      }
      listenedOnValue = listened_on;
    }

    // --- is_relisten: optional boolean, defaults to false ---
    if (is_relisten !== undefined && typeof is_relisten !== "boolean") {
      return NextResponse.json(
        { error: "is_relisten must be true or false." },
        { status: 400 }
      );
    }

    // --- release_id: optional link to a catalog release; must be a UUID.
    //     The DB foreign key rejects ids that don't exist. ---
    let releaseIdValue: string | null = null;
    if (release_id !== undefined && release_id !== null) {
      if (typeof release_id !== "string" || !UUID_REGEX.test(release_id)) {
        return NextResponse.json(
          { error: "release_id must be a valid UUID." },
          { status: 400 }
        );
      }
      releaseIdValue = release_id;
    }

    // --- cover_image: optional URL string (kept loose on purpose) ---
    let coverImageValue: string | null = null;
    if (cover_image !== undefined && cover_image !== null) {
      if (typeof cover_image !== "string" || cover_image.length > 1000) {
        return NextResponse.json(
          { error: "cover_image must be a URL string." },
          { status: 400 }
        );
      }
      coverImageValue = cover_image.trim() || null;
    }

    const entry = await createDiaryEntry({
      user_id: user.id, // from the session — NEVER from the body
      release_id: releaseIdValue,
      title: title.trim(),
      artist: artist.trim(),
      cover_image: coverImageValue,
      listened_on: listenedOnValue,
      rating: ratingValue,
      note: noteValue,
      is_relisten: is_relisten ?? false,
    });

    if (!entry) {
      return NextResponse.json(
        { error: "Failed to log listen." },
        { status: 500 }
      );
    }

    return NextResponse.json(entry, { status: 201 });
  } catch {
    // request.json() throws on malformed JSON bodies
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}

/**
 * GET /api/diary?username=luca  (or ?userId=<uuid>)
 * Public listing of a user's diary — entries are world-readable by
 * design (RLS select policy is `using (true)`), like Letterboxd.
 * Supports ?limit= and ?offset= for pagination.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const userIdParam = searchParams.get("userId");

  // Resolve which user's diary we're listing.
  let userId: string | null = null;
  if (userIdParam) {
    if (!UUID_REGEX.test(userIdParam)) {
      return NextResponse.json(
        { error: "userId must be a valid UUID." },
        { status: 400 }
      );
    }
    userId = userIdParam;
  } else if (username) {
    // Look up the profile so callers can use the friendly username.
    const profile = await getProfileByUsername(username);
    if (!profile) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    userId = profile.id;
  } else {
    return NextResponse.json(
      { error: "Provide ?username= or ?userId=." },
      { status: 400 }
    );
  }

  // Pagination: clamp limit to 1–100 (default 50), offset to >= 0,
  // so a bad query string can't request the whole table.
  const rawLimit = parseInt(searchParams.get("limit") ?? "50", 10);
  const rawOffset = parseInt(searchParams.get("offset") ?? "0", 10);
  const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 50 : rawLimit, 1), 100);
  const offset = Math.max(Number.isNaN(rawOffset) ? 0 : rawOffset, 0);

  const entries = await getDiaryEntries(userId, { limit, offset });
  return NextResponse.json({ entries });
}
