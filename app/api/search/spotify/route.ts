import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { searchReleases } from "@/lib/db/releases";
import type { Release } from "@/lib/types/database";

/**
 * GET /api/search/spotify?q=<text>&type=release
 *
 * Phase 2a-3: this endpoint searches the LOCAL releases table only.
 * The `/spotify` path segment is forward-looking — once we add a real
 * Spotify external lookup it can fall through here or move to
 * /api/search/external. For now, only `type=release` is supported.
 *
 * Auth-gated: any logged-in user can hit it. Returns 401 otherwise.
 * Cached briefly per (query) in-memory to absorb keystroke bursts.
 */

export interface AutocompleteResult {
  id: string;
  slug: string;
  title: string;
  artist_name: string;
  release_type: string;
  release_date: string | null;
  cover_image: string | null;
}

interface ResponseShape {
  results: AutocompleteResult[];
}

// Module-level LRU-ish cache keyed by query string. 60s TTL. Single-instance
// only — fine for a Vercel serverless worker. We cap entries to keep the map
// small if the worker is long-lived.
const CACHE_TTL_MS = 60_000;
const CACHE_MAX_ENTRIES = 100;
const cache = new Map<string, { data: ResponseShape; expiresAt: number }>();

function cacheGet(key: string): ResponseShape | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  // bump recency
  cache.delete(key);
  cache.set(key, entry);
  return entry.data;
}

function cacheSet(key: string, data: ResponseShape): void {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// Row shape returned by searchReleases — Release plus the joined artist name.
type JoinedArtist = { name: string } | { name: string }[] | null;
type ReleaseRow = Release & { artists: JoinedArtist };

function pickArtistName(joined: JoinedArtist): string {
  if (!joined) return "";
  if (Array.isArray(joined)) return joined[0]?.name ?? "";
  return joined.name ?? "";
}

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const type = searchParams.get("type") ?? "release";

  if (type !== "release") {
    return NextResponse.json(
      { error: `Unsupported search type "${type}". Only "release" is supported.` },
      { status: 400 }
    );
  }

  const rawQ = searchParams.get("q") ?? "";
  // searchParams.get already URL-decodes the value.
  const q = rawQ.trim();

  if (q.length < 2) {
    return NextResponse.json(
      { results: [] } satisfies ResponseShape,
      { headers: { "Cache-Control": "private, max-age=60" } }
    );
  }

  const cacheKey = `release:${q.toLowerCase()}`;
  const cached = cacheGet(cacheKey);
  if (cached) {
    return NextResponse.json(cached, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  }

  const rows = (await searchReleases(q, 10)) as ReleaseRow[];

  // searchReleases joins the primary artist via
  // `artists!releases_primary_artist_id_fkey(name)`. If for any reason a row
  // is missing the join, fall back to a batch lookup.
  const missingArtistFor: string[] = [];
  const partial: AutocompleteResult[] = rows.map((row) => {
    const artistName = pickArtistName(row.artists);
    if (!artistName && row.primary_artist_id) {
      missingArtistFor.push(row.primary_artist_id);
    }
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      artist_name: artistName,
      release_type: row.release_type,
      release_date: row.release_date,
      cover_image: row.cover_image,
    };
  });

  if (missingArtistFor.length > 0) {
    const { data: artists } = await supabase
      .from("artists")
      .select("id, name")
      .in("id", Array.from(new Set(missingArtistFor)));

    const byId = new Map<string, string>();
    (artists ?? []).forEach((a) => {
      const r = a as { id: string; name: string };
      byId.set(r.id, r.name);
    });

    rows.forEach((row, i) => {
      if (!partial[i].artist_name && row.primary_artist_id) {
        partial[i].artist_name = byId.get(row.primary_artist_id) ?? "";
      }
    });
  }

  const payload: ResponseShape = { results: partial };
  cacheSet(cacheKey, payload);

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "private, max-age=60" },
  });
}
