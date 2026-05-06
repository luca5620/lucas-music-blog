/**
 * Backfill review.release_id by matching reviews to canonical releases.
 *
 * Usage:
 *   node scripts/backfill-review-releases.js          # match mode (default)
 *   node scripts/backfill-review-releases.js --patch  # patch mode (apply matches)
 *
 * Match mode (default):
 *   1. Loads every review with release_id IS NULL.
 *   2. For each: Spotify search by `album:"<title>" artist:"<artist>"`.
 *   3. Scores top 3 candidates with normalized substring + length similarity.
 *   4. Writes matches to scripts/backfill-matches.json:
 *        [{ review_id, review_slug, title, artist,
 *           spotify_album_id, candidate_title, candidate_artist, score },...]
 *      Reviews with score < 0.85 go to scripts/backfill-unmatched.json.
 *
 * Patch mode (--patch):
 *   1. Reads scripts/backfill-matches.json.
 *   2. For each entry: looks up canonical release by spotify_id (must already
 *      be imported via /admin/import). If found, updates reviews.release_id.
 *      If not found, logs and skips.
 *
 * Why two modes?
 *   The full inline import (artist + release rows + junction) gets messy in
 *   JS — the TS pipeline relies on slugify, conflict resolution, and feature
 *   detection. The cleanest split is: this script identifies *what* to
 *   import, the existing /admin/import endpoint handles the import, and a
 *   second script pass patches review.release_id.
 *
 * Idempotent: only processes reviews where release_id IS NULL. Safe to re-run.
 *
 * Run after applying migration 002 in Supabase. Requires SPOTIFY_CLIENT_ID,
 * SPOTIFY_CLIENT_SECRET, NEXT_PUBLIC_SUPABASE_URL, and
 * SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

const fs = require("fs");
const path = require("path");

// ---------------------------------------------------------------------------
// Env loader (reuses pattern from scripts/fetch-album-covers.js)
// ---------------------------------------------------------------------------

const envPath = path.join(__dirname, "..", ".env.local");
if (!fs.existsSync(envPath)) {
  console.error(".env.local not found");
  process.exit(1);
}
const envContent = fs.readFileSync(envPath, "utf-8");
const env = {};
for (const line of envContent.split("\n")) {
  const match = line.match(/^([A-Z0-9_]+)=(.+)$/);
  if (match) env[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
}

const SPOTIFY_CLIENT_ID = env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = env.SPOTIFY_CLIENT_SECRET;
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

const MATCHES_PATH = path.join(__dirname, "backfill-matches.json");
const UNMATCHED_PATH = path.join(__dirname, "backfill-unmatched.json");

// ---------------------------------------------------------------------------
// Lightweight Supabase REST client (avoids needing @supabase/supabase-js
// here since this is a plain Node script).
// ---------------------------------------------------------------------------

async function supabaseFetch(pathname, init = {}) {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in .env.local"
    );
  }
  const url = `${SUPABASE_URL}/rest/v1${pathname}`;
  const headers = {
    apikey: SERVICE_ROLE_KEY,
    Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    "Content-Type": "application/json",
    Prefer: "return=representation",
    ...(init.headers || {}),
  };
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`supabase ${res.status} ${pathname}: ${body.slice(0, 300)}`);
  }
  return res.json();
}

async function getReviewsMissingRelease() {
  return supabaseFetch(
    "/reviews?release_id=is.null&select=id,slug,title,artist&order=created_at.desc"
  );
}

async function getReleaseBySpotifyId(spotifyId) {
  const rows = await supabaseFetch(
    `/releases?spotify_id=eq.${encodeURIComponent(spotifyId)}&select=id&limit=1`
  );
  return rows[0] || null;
}

async function patchReviewReleaseId(reviewId, releaseId) {
  return supabaseFetch(
    `/reviews?id=eq.${encodeURIComponent(reviewId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({ release_id: releaseId }),
    }
  );
}

// ---------------------------------------------------------------------------
// Spotify
// ---------------------------------------------------------------------------

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getSpotifyToken() {
  if (cachedToken && Date.now() < cachedTokenExpiresAt - 60_000) {
    return cachedToken;
  }
  if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET) {
    throw new Error(
      "SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET are required in .env.local"
    );
  }
  const basic = Buffer.from(
    `${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`
  ).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }),
  });
  if (!res.ok) {
    throw new Error(`Spotify token failed: ${res.status}`);
  }
  const data = await res.json();
  cachedToken = data.access_token;
  cachedTokenExpiresAt = Date.now() + (data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function searchSpotifyAlbums(title, artist) {
  const token = await getSpotifyToken();
  // Use field filters per Spotify search docs.
  const q = `album:"${title}" artist:"${artist}"`;
  const url = `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=album&limit=3`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 429) {
    // Honor retry-after; backoff once.
    const retry = Number(res.headers.get("retry-after") || "2");
    await new Promise((r) => setTimeout(r, retry * 1000));
    return searchSpotifyAlbums(title, artist);
  }
  if (!res.ok) return [];
  const data = await res.json();
  return data.albums?.items || [];
}

// ---------------------------------------------------------------------------
// Similarity scoring (substring + length ratio, no external deps)
// ---------------------------------------------------------------------------

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  const x = normalize(a);
  const y = normalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  // Substring containment — generous for "Album (Deluxe)" vs "Album".
  if (x.includes(y) || y.includes(x)) {
    const longer = Math.max(x.length, y.length);
    const shorter = Math.min(x.length, y.length);
    return shorter / longer;
  }
  // Bag-of-words overlap on tokens (cheap fallback).
  const xs = new Set(x.split(" "));
  const ys = new Set(y.split(" "));
  const intersect = [...xs].filter((t) => ys.has(t)).length;
  const union = new Set([...xs, ...ys]).size;
  return union ? intersect / union : 0;
}

function scoreCandidate(review, album) {
  const titleSim = similarity(review.title, album.name);
  const artistSim = similarity(
    review.artist,
    album.artists?.[0]?.name || ""
  );
  // Weight title > artist (artists vary more in capitalization / "feat.").
  return titleSim * 0.6 + artistSim * 0.4;
}

// ---------------------------------------------------------------------------
// Modes
// ---------------------------------------------------------------------------

const MATCH_THRESHOLD = 0.85;

async function runMatch() {
  console.log("Loading reviews with release_id IS NULL...");
  const reviews = await getReviewsMissingRelease();
  console.log(`Found ${reviews.length} reviews to consider.`);

  const matches = [];
  const unmatched = [];
  let errors = 0;

  for (const review of reviews) {
    process.stdout.write(`  ${review.slug}... `);
    try {
      const candidates = await searchSpotifyAlbums(review.title, review.artist);
      if (!candidates.length) {
        unmatched.push({
          review_id: review.id,
          review_slug: review.slug,
          title: review.title,
          artist: review.artist,
          reason: "no spotify results",
        });
        console.log("no results");
        continue;
      }

      let best = null;
      let bestScore = 0;
      for (const album of candidates) {
        const s = scoreCandidate(review, album);
        if (s > bestScore) {
          bestScore = s;
          best = album;
        }
      }

      if (!best || bestScore < MATCH_THRESHOLD) {
        unmatched.push({
          review_id: review.id,
          review_slug: review.slug,
          title: review.title,
          artist: review.artist,
          best_candidate: best
            ? {
                spotify_album_id: best.id,
                title: best.name,
                artist: best.artists?.[0]?.name || "",
                score: Number(bestScore.toFixed(3)),
              }
            : null,
          reason: "score below threshold",
        });
        console.log(`unmatched (best ${bestScore.toFixed(2)})`);
        continue;
      }

      matches.push({
        review_id: review.id,
        review_slug: review.slug,
        title: review.title,
        artist: review.artist,
        spotify_album_id: best.id,
        candidate_title: best.name,
        candidate_artist: best.artists?.[0]?.name || "",
        score: Number(bestScore.toFixed(3)),
      });
      console.log(`matched ${best.id} (${bestScore.toFixed(2)})`);
    } catch (err) {
      errors++;
      console.log(`error: ${err.message}`);
    }
    // gentle pacing for Spotify rate limits
    await new Promise((r) => setTimeout(r, 120));
  }

  fs.writeFileSync(MATCHES_PATH, JSON.stringify(matches, null, 2));
  fs.writeFileSync(UNMATCHED_PATH, JSON.stringify(unmatched, null, 2));

  console.log("");
  console.log("=== summary ===");
  console.log(`  matched:    ${matches.length}`);
  console.log(`  unmatched:  ${unmatched.length}`);
  console.log(`  errors:     ${errors}`);
  console.log(`Wrote ${MATCHES_PATH}`);
  console.log(`Wrote ${UNMATCHED_PATH}`);
  console.log("");
  console.log("Next steps:");
  console.log(
    "  1. Run each spotify_album_id through /admin/import (UI) to seed the canonical release row."
  );
  console.log(
    "  2. Re-run with --patch to set review.release_id from backfill-matches.json."
  );
}

async function runPatch() {
  if (!fs.existsSync(MATCHES_PATH)) {
    console.error(`No ${MATCHES_PATH} — run match mode first.`);
    process.exit(1);
  }
  const matches = JSON.parse(fs.readFileSync(MATCHES_PATH, "utf-8"));
  console.log(`Loaded ${matches.length} matches from ${MATCHES_PATH}.`);

  let patched = 0;
  let skipped = 0;
  let errors = 0;
  const stillMissing = [];

  for (const m of matches) {
    process.stdout.write(`  ${m.review_slug} -> ${m.spotify_album_id}... `);
    try {
      const release = await getReleaseBySpotifyId(m.spotify_album_id);
      if (!release) {
        skipped++;
        stillMissing.push(m);
        console.log("release not yet imported (skipping)");
        continue;
      }
      await patchReviewReleaseId(m.review_id, release.id);
      patched++;
      console.log(`patched -> ${release.id}`);
    } catch (err) {
      errors++;
      console.log(`error: ${err.message}`);
    }
  }

  console.log("");
  console.log("=== summary ===");
  console.log(`  patched:        ${patched}`);
  console.log(`  skipped (need import first): ${skipped}`);
  console.log(`  errors:         ${errors}`);

  if (stillMissing.length > 0) {
    const pendingPath = path.join(__dirname, "backfill-pending-import.json");
    fs.writeFileSync(pendingPath, JSON.stringify(stillMissing, null, 2));
    console.log(`Wrote pending imports to ${pendingPath}`);
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  const mode = process.argv.includes("--patch") ? "patch" : "match";
  if (mode === "patch") {
    await runPatch();
  } else {
    await runMatch();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
