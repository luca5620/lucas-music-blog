import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  isOptionalSafeUrl,
  isText,
  isUuid,
} from "@/lib/validate";
import {
  getProfileFavorites,
  replaceProfileFavorites,
  type FavoriteInput,
} from "@/lib/db/profiles";

/* ============================================
   /api/profile/favorites
   GET — the caller's own four favorites (for the settings editor)
   PUT — replace the caller's favorites wholesale (max 4 slots)

   user_id ALWAYS comes from the session — you can only ever edit
   your own showcase. Follows the validation model of /api/diary.
   ============================================ */

/** GET — return the logged-in user's favorites, ordered by slot. */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const favorites = await getProfileFavorites(user.id);
  return NextResponse.json({ favorites });
}

/**
 * PUT — replace the favorites set.
 * Body: { favorites: [{ position, title, artist, cover_image?, release_id? }] }
 * Slots omitted from the array are deleted; included ones are upserted
 * on (user_id, position).
 */
export async function PUT(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Favorites rarely change — 20 saves/minute is generous and still
  // stops a runaway client loop.
  const limited = await rateLimit(`favorites:${user.id}`, 20, 60_000);
  if (limited) return limited;

  try {
    const body = await request.json();
    const rawFavorites = body?.favorites;

    // --- top-level shape: an array of at most 4 slots ---
    if (!Array.isArray(rawFavorites) || rawFavorites.length > 4) {
      return NextResponse.json(
        { error: "favorites must be an array of at most 4 items." },
        { status: 400 }
      );
    }

    const cleaned: FavoriteInput[] = [];
    const seenPositions = new Set<number>();

    for (const item of rawFavorites) {
      if (typeof item !== "object" || item === null) {
        return NextResponse.json(
          { error: "Each favorite must be an object." },
          { status: 400 }
        );
      }
      const { position, title, artist, cover_image, release_id } = item as {
        position?: unknown;
        title?: unknown;
        artist?: unknown;
        cover_image?: unknown;
        release_id?: unknown;
      };

      // --- position: integer 1–4, no duplicates ---
      if (
        typeof position !== "number" ||
        !Number.isInteger(position) ||
        position < 1 ||
        position > 4
      ) {
        return NextResponse.json(
          { error: "position must be an integer between 1 and 4." },
          { status: 400 }
        );
      }
      if (seenPositions.has(position)) {
        return NextResponse.json(
          { error: `Duplicate position ${position}.` },
          { status: 400 }
        );
      }
      seenPositions.add(position);

      // --- title / artist: required non-empty strings, max 200 chars ---
      if (!isText(title, 200)) {
        return NextResponse.json(
          { error: "Each favorite needs a title (max 200 characters)." },
          { status: 400 }
        );
      }
      if (!isText(artist, 200)) {
        return NextResponse.json(
          { error: "Each favorite needs an artist (max 200 characters)." },
          { status: 400 }
        );
      }

      // --- cover_image: optional, https:// or local /path only —
      //     rendered in an <img src>, so no other schemes allowed ---
      if (!isOptionalSafeUrl(cover_image)) {
        return NextResponse.json(
          { error: "cover_image must be an https:// URL or a local path." },
          { status: 400 }
        );
      }
      if (typeof cover_image === "string" && cover_image.length > 1000) {
        return NextResponse.json(
          { error: "cover_image is too long." },
          { status: 400 }
        );
      }

      // --- release_id: optional catalog link, must be a UUID ---
      if (release_id != null && !isUuid(release_id)) {
        return NextResponse.json(
          { error: "release_id must be a valid UUID." },
          { status: 400 }
        );
      }

      cleaned.push({
        position,
        title: title.trim(),
        artist: artist.trim(),
        cover_image:
          typeof cover_image === "string" && cover_image.length > 0
            ? cover_image
            : null,
        release_id: typeof release_id === "string" ? release_id : null,
      });
    }

    // user.id from the SESSION — never from the body.
    const saved = await replaceProfileFavorites(user.id, cleaned);
    if (saved === null) {
      return NextResponse.json(
        { error: "Failed to save favorites." },
        { status: 500 }
      );
    }

    return NextResponse.json({ favorites: saved });
  } catch {
    // request.json() throws on malformed JSON bodies
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
}
