import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { searchCatalog } from "@/lib/catalog";

/**
 * GET /api/search/catalog?q=<text>
 *
 * Unified search across the local catalog, Spotify albums, and
 * Genius songs. This is what powers the review/list "pick a
 * release" flow — nothing is ever typed by hand anymore.
 *
 * Auth-gated (any logged-in user). Short in-memory cache absorbs
 * keystroke bursts; the client should still debounce.
 */

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { data: unknown; expiresAt: number }>();

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limited = await rateLimit(`catalog-search:${user.id}`, 30, 60_000);
  if (limited) return limited;

  // 250 (not 120) so a full pasted Spotify link — intl path + ?si=
  // tracking param — never gets silently dropped.
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2 || q.length > 250) {
    return NextResponse.json({ results: [], geniusEnabled: true });
  }

  const key = q.toLowerCase();
  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json(hit.data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  const payload = await searchCatalog(q);

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
