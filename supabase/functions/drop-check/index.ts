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
// 5 minutes. It looks at records whose release day is today or
// tomorrow (Eastern) that aren't confirmed out yet, and for each one
// asks Spotify (US market) whether its tracks are playable:
//   playable     → releases.drops_at       = now   (it's out)
//   not playable → releases.drop_waiting_at = now  (still waiting)
// The site reads those two columns (lib/upcoming.ts isWaitingForDrop):
// after midnight ET it shows "Later today" instead of OUT NOW until
// drops_at is set. If this function ever stops running, the waiting
// reports go stale after 30 minutes and everything falls back to the
// old midnight rule — a broken check can only make things look like
// before, never stick a record on "later today".
//
// The signal (checked by hand 2026-10-25): before release,
// GET /v1/albums/{id}?market=US returns tracks with is_playable=false
// (restrictions.reason "market"); once it's out they flip to true.
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
/** Spotify calls per run — far more than a day's drops. */
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

  const { data, error } = await supabase
    .from("releases")
    .select("id, spotify_id, release_date")
    .in("release_date", [today, tomorrow])
    .is("drops_at", null)
    .not("spotify_id", "is", null)
    .order("release_date", { ascending: true })
    .limit(MAX_PER_RUN);
  if (error) return new Response("lookup failed", { status: 500 });

  // Tomorrow's records only inside the last 18 hours before their drop.
  const rows = ((data ?? []) as Row[]).filter(
    (r) => r.release_date === today || now >= easternMidnight(tomorrow) - EARLY_WINDOW_MS
  );
  if (rows.length === 0) return new Response("nothing to check", { status: 200 });

  const token = await spotifyToken();
  if (!token) return new Response("no spotify token", { status: 500 });

  let out = 0;
  let waiting = 0;
  for (const r of rows) {
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

  return new Response(`checked ${rows.length}: ${out} out, ${waiting} waiting`, {
    status: 200,
  });
});
