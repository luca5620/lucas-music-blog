import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import {
  createList,
  generateUniqueListSlug,
  getPublicLists,
} from "@/lib/db/lists";
import { rateLimit } from "@/lib/rate-limit";

/**
 * GET /api/lists — recent public lists, paginated.
 * Query params: ?limit=20&offset=0
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  // Parse + clamp pagination so a bad query can't ask for the world.
  const rawLimit = Number(searchParams.get("limit") ?? 20);
  const rawOffset = Number(searchParams.get("offset") ?? 0);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(Math.trunc(rawLimit), 1), 50)
    : 20;
  const offset = Number.isFinite(rawOffset)
    ? Math.max(Math.trunc(rawOffset), 0)
    : 0;

  const lists = await getPublicLists({ limit, offset });
  return NextResponse.json({ lists, limit, offset });
}

/**
 * POST /api/lists — create a new list for the signed-in user.
 * Body: { title, description?, is_ranked?, is_public? }
 * The slug is generated server-side from the title; on collision we
 * append -2, -3, ... (slugs are unique per user).
 */
export async function POST(request: Request) {
  const user = await getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Max 10 new lists per user per 5 minutes.
  const limited = rateLimit(`lists:${user.id}`, 10, 300_000);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { title, description, is_ranked, is_public } = body;

    // --- Validate title: required, 1-120 chars (matches the DB check) ---
    if (typeof title !== "string" || !title.trim()) {
      return NextResponse.json(
        { error: "Title is required." },
        { status: 400 }
      );
    }
    const trimmedTitle = title.trim();
    if (trimmedTitle.length > 120) {
      return NextResponse.json(
        { error: "Title must be 120 characters or fewer." },
        { status: 400 }
      );
    }

    // --- Validate description: optional, up to 2000 chars ---
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return NextResponse.json(
        { error: "Description must be text." },
        { status: 400 }
      );
    }
    const trimmedDescription =
      typeof description === "string" ? description.trim() : null;
    if (trimmedDescription && trimmedDescription.length > 2000) {
      return NextResponse.json(
        { error: "Description must be 2000 characters or fewer." },
        { status: 400 }
      );
    }

    // --- Validate the two toggles: must be booleans when provided ---
    if (is_ranked !== undefined && typeof is_ranked !== "boolean") {
      return NextResponse.json(
        { error: "is_ranked must be true or false." },
        { status: 400 }
      );
    }
    if (is_public !== undefined && typeof is_public !== "boolean") {
      return NextResponse.json(
        { error: "is_public must be true or false." },
        { status: 400 }
      );
    }

    // Slug comes from the title, made unique for this user.
    const slug = await generateUniqueListSlug(user.id, trimmedTitle);

    // user_id always comes from the session — never from the body.
    const list = await createList({
      user_id: user.id,
      slug,
      title: trimmedTitle,
      description: trimmedDescription || null,
      is_ranked: is_ranked ?? false,
      is_public: is_public ?? true,
    });

    if (!list) {
      return NextResponse.json(
        { error: "Failed to create list." },
        { status: 500 }
      );
    }

    return NextResponse.json(list, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }
}
