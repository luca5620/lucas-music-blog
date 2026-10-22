import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  searchCatalog,
  getArtistDiscography,
  getMoreFromArtist,
} from "@/lib/catalog";

/**
 * GET /api/search/catalog?q=<text>          ranked search (all sources)
 * GET /api/search/catalog?artist=<spotify>  one artist's discography
 * GET /api/search/catalog?moreFrom=<uuid>   discography of a PMR
 *                                           release's artist, minus it
 *
 * Unified search across the local catalog, Spotify (albums, songs,
 * artists) and Genius songs. Powers every "pick a release" box AND,
 * since 2026-10-22, the /search page's music results — so it's open to
 * signed-out visitors too (Luca: "when people search it should still
 * find whatever album or music in general that they want"). Reading
 * is harmless; IMPORTING still needs an account (/api/catalog/ensure
 * and /catalog/open both check).
 *
 * Rate limited per member, or per IP when signed out. Short in-memory
 * cache absorbs keystroke bursts; the client should still debounce.
 */

const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 200;
const cache = new Map<string, { data: unknown; expiresAt: number }>();

const ARTIST_RE = /^[A-Za-z0-9]{10,30}$/;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const who =
    user?.id ??
    `ip:${request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon"}`;
  // Each search fans out to ~6 provider calls — 30 a minute per person
  // is plenty with the 300ms debounce (it was the limit before, too).
  const limited = await rateLimit(`catalog-search:${who}`, 30, 60_000);
  if (limited) return limited;

  const sp = request.nextUrl.searchParams;
  const artist = sp.get("artist");
  const moreFrom = sp.get("moreFrom");
  // 250 (not 120) so a full pasted Spotify link — intl path + ?si=
  // tracking param — never gets silently dropped.
  const q = (sp.get("q") ?? "").trim();

  let key: string;
  let run: () => Promise<unknown>;
  if (artist) {
    if (!ARTIST_RE.test(artist)) {
      return NextResponse.json({ error: "Invalid artist" }, { status: 400 });
    }
    key = `artist:${artist}`;
    run = () => getArtistDiscography(artist);
  } else if (moreFrom) {
    if (!UUID_RE.test(moreFrom)) {
      return NextResponse.json({ error: "Invalid release" }, { status: 400 });
    }
    key = `more:${moreFrom}`;
    run = () => getMoreFromArtist(moreFrom);
  } else {
    if (q.length < 2 || q.length > 250) {
      return NextResponse.json({ results: [], artists: [], geniusEnabled: true });
    }
    key = `q:${q.toLowerCase()}`;
    run = () => searchCatalog(q);
  }

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json(hit.data, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  const payload = await run();

  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { data: payload, expiresAt: Date.now() + CACHE_TTL_MS });

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
