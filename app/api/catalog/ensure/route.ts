import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { ensureRelease } from "@/lib/catalog";

/**
 * POST /api/catalog/ensure  { source: "local"|"spotify"|"genius", id: string }
 *
 * Guarantees a release exists in the local catalog, importing it
 * from Spotify or Genius on first touch. Returns the release row
 * ({ id, slug, title, ... }) so the caller can attach a review or
 * list item to it.
 *
 * Writes go through the insert-only catalog_import_release SQL
 * function — users can seed catalog rows but never modify them.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Imports hit external APIs — keep the ceiling low.
  const limited = rateLimit(`catalog-ensure:${user.id}`, 10, 60_000);
  if (limited) return limited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { source, id } = (body ?? {}) as { source?: string; id?: string };

  const validSources = ["local", "spotify", "spotify_track", "genius"];
  if (
    !validSources.includes(source ?? "") ||
    typeof id !== "string" ||
    id.length === 0 ||
    id.length > 64
  ) {
    return NextResponse.json({ error: "Invalid source or id" }, { status: 400 });
  }

  try {
    const release = await ensureRelease(
      source as "local" | "spotify" | "spotify_track" | "genius",
      id
    );
    return NextResponse.json({ release });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Import failed";
    console.error("catalog ensure failed:", msg);
    return NextResponse.json(
      { error: "Couldn't import that release. Try another result." },
      { status: 502 }
    );
  }
}
