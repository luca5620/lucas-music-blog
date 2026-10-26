// ============================================================
// drop-check — Supabase Edge Function (Deno), 2026-10-25.
//
// WHY THIS EXISTS (Luca 2026-10-25): the site used to call every
// record "out now" at midnight Eastern, the US drop moment. Not
// everything drops then — ILLIT's BREAK EVEN said "out now" at
// midnight ET but K-pop comes out at 6pm Korea time (5am ET), so it
// sat there "out" for hours while nobody could play it.
//
// So now we ask Spotify. Migration 064's pg_cron job calls this every
// 5 minutes, for every upcoming record that doesn't have its drop
// moment yet:
//
// 1. THE EXACT TIME (Luca 2026-10-26: "why not just have the accurate
//    countdown? its literally right there"). Spotify's embed page
//    (open.spotify.com/embed/album/<id>) carries the real release
//    moment in its page data: releaseDate.isoString —
//    "2026-10-26T09:00:00Z" for BREAK EVEN, "…T05:00:00Z" (midnight
//    ET) for a US record. → releases.drops_at = that moment, and every
//    countdown on the site runs to the real second.
// 2. FALLBACK, only when the embed has no time (or is down) and the
//    record is due today/tomorrow: ask the Web API (US market) whether
//    the tracks are playable —
//      playable     → drops_at        = now  (it's out)
//      not playable → drop_waiting_at = now  (still waiting)
//    Before release, GET /v1/albums/{id}?market=US returns tracks with
//    is_playable=false (restrictions.reason "market"); once it's out
//    they flip to true (checked by hand 2026-10-25).
//
// The site reads those columns through lib/upcoming.ts. If this
// function ever stops running, waiting reports go stale after 30
// minutes and everything falls back to the old midnight rule.
//
// ⚠️ Deploy by hand (does NOT ship with Vercel):
//     supabase functions deploy drop-check --no-verify-jwt
// Needs the project secrets PUSH_WEBHOOK_SECRET (already set for the
// push functions) + SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET (the
// same app as the website's .env.local).
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { hasPushSecret } from "../_shared/apns.ts";

/** Tomorrow's records are only checked this close to their drop
    (catches a Japanese midnight release, 11am ET the day before). */
const EARLY_WINDOW_MS = 18 * 3_600_000;
/** Records per run — far more than a day's drops. */
const MAX_PER_RUN = 40;

interface Row {
  id: string;
  spotify_id: string;
  release_date: string;
}

/** YYYY-MM-DD as the date currently reads in New York. */
function easternDay(ms: number): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(ms));
}

/** UTC ms of midnight Eastern on a YYYY-MM-DD (same rule as lib/upcoming). */
function easternMidnight(day: string): number {
  for (const offset of ["-04:00", "-05:00"]) {
    const ts = Date.parse(`${day}T00:00:00${offset}`);
    const hour = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      hour: "2-digit",
      hourCycle: "h23",
    }).format(new Date(ts));
    if (easternDay(ts) === day && hour === "00") return ts;
  }
  return Date.parse(`${day}T00:00:00-05:00`);
}

async function spotifyToken(): Promise<string | null> {
  const id = Deno.env.get("SPOTIFY_CLIENT_ID");
  const secret = Deno.env.get("SPOTIFY_CLIENT_SECRET");
  if (!id || !secret) return null;
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${btoa(`${id}:${secret}`)}`,
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) return null;
  const json = await res.json();
  return typeof json.access_token === "string" ? json.access_token : null;
}

/**
 * The exact release moment from Spotify's embed page, or null. Only
 * for records Spotify still calls pre-release — once it's out the
 * embed stops being a countdown and the fallback below takes over.
 */
async function embedReleaseTime(spotifyId: string): Promise<string | null> {
  const res = await fetch(
    `https://open.spotify.com/embed/album/${encodeURIComponent(spotifyId)}`,
    { headers: { "User-Agent": "Mozilla/5.0 (compatible; PeakMusicDropCheck/1.0)" } }
  );
  if (!res.ok) return null;
  const html = await res.text();
  const m = html.match(/"isPreRelease":true,"releaseDate":{"isoString":"([^"]+)"/);
  if (!m) return null;
  return Number.isNaN(Date.parse(m[1])) ? null : new Date(m[1]).toISOString();
}

/** true = playable in the US now, false = not yet, null = couldn't tell. */
async function isPlayable(token: string, spotifyId: string): Promise<boolean | null> {
  const res = await fetch(
    `https://api.spotify.com/v1/albums/${encodeURIComponent(spotifyId)}?market=US`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const album = await res.json();
  const items: { is_playable?: boolean }[] = album?.tracks?.items ?? [];
  if (items.length === 0) return null;
  // Any one playable track counts (some albums keep a bonus track
  // locked, or released a single early).
  return items.some((t) => t.is_playable === true);
}

Deno.serve(async (req) => {
  // Same shared secret the push functions use — only our own cron
  // job may make this write to the catalog.
  if (!hasPushSecret(req)) {
    return new Response("forbidden", { status: 403 });
  }

  const now = Date.now();
  const today = easternDay(now);
  const tomorrow = easternDay(easternMidnight(today) + 36 * 3_600_000);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } }
  );

  // Every upcoming record still missing its drop moment (once set,
  // it leaves this list — one embed fetch per record, usually).
  const { data, error } = await supabase
    .from("releases")
    .select("id, spotify_id, release_date")
    .gte("release_date", today)
    .is("drops_at", null)
    .not("spotify_id", "is", null)
    .order("release_date", { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) return new Response("lookup failed", { status: 500 });

  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return new Response("nothing to check", { status: 200 });

  let exact = 0;
  let out = 0;
  let waiting = 0;
  let token: string | null | undefined;
  for (const r of rows) {
    // 1. The exact time from the embed page.
    const at = await embedReleaseTime(r.spotify_id).catch(() => null);
    if (at) {
      await supabase.from("releases").update({ drops_at: at }).eq("id", r.id);
      exact++;
      continue;
    }

    // 2. Fallback: playable-or-not, only for records due soon
    //    (today, or tomorrow inside the last 18 hours before it).
    const dueSoon =
      r.release_date === today ||
      (r.release_date === tomorrow && now >= easternMidnight(tomorrow) - EARLY_WINDOW_MS);
    if (!dueSoon) continue;
    if (token === undefined) token = await spotifyToken();
    if (!token) continue;
    const playable = await isPlayable(token, r.spotify_id).catch(() => null);
    // Couldn't tell (Spotify error, empty album) → write nothing, so the
    // site's 30-minute fallback takes over instead of a wrong answer.
    if (playable === null) continue;
    const stamp = new Date().toISOString();
    if (playable) {
      await supabase.from("releases").update({ drops_at: stamp }).eq("id", r.id);
      out++;
    } else {
      await supabase.from("releases").update({ drop_waiting_at: stamp }).eq("id", r.id);
      waiting++;
    }
  }

  return new Response(`checked ${rows.length}: ${exact} exact times, ${out} out, ${waiting} waiting`, {
    status: 200,
  });
});
