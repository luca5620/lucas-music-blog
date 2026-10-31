// ============================================================
// push-recap — Supabase Edge Function (Deno), 2026-10-05.
//
// The Sunday-evening "your week in music" push. Migration 055's
// pg_cron job runs public.send_weekly_recaps() every Sunday at 6pm
// US Eastern; that SQL function works out each person's week, records
// it in push_recaps_sent (so a second run can never double-send), and
// POSTs the freshly recorded recaps here in batches:
//
//   { "type": "RECAP", "recaps": [ { user_id, kind, username, rated,
//     avg_rating, top_title, top_rating, likes, new_followers }, … ] }
//
// Since 2026-10-25 it also sends the Song of the Day streak saver
// (migration 060, every evening at 6pm Pacific):
//
//   { "type": "STREAK", "streaks": [ { user_id, username, streak }, … ] }
//
// And since migration 062, the "a record you saved is out" push
// (midnight Eastern, the drop moment):
//
//   { "type": "DROP", "drops": [ { user_id, username, title, artist,
//     slug, more }, … ] }
//
// And since migration 063, "your Rewind is ready" (once, December 1):
//
//   { "type": "REWIND", "rewinds": [ { user_id, username, year, total }, … ] }
//
// And since migration 068, the Monday Community Spotlight push:
//
//   { "type": "SPOTLIGHT", "spotlights": [ { user_id, username, title,
//     artist, slug }, … ] }
//
// Same devices, same APNs path, same secret — just different words —
// so it lives here instead of in a third function to deploy.
//
// This function only does the part Postgres can't: look up each
// person's iOS devices (service role — tokens are private), write the
// copy in each DEVICE's language (push_tokens.locale, 052), and talk
// to APNs through the same code push-fanout uses (../_shared/apns.ts).
//
// Recaps deliberately do NOT become rows in `notifications`: that
// table's rows always have an actor who isn't the recipient (025's
// check), and a weekly digest isn't a bell event anyway — it's a
// nudge to open the app.
//
// ⚠️ Deploy by hand (does NOT ship with Vercel):
//     supabase functions deploy push-recap --no-verify-jwt
// Secrets are project-wide, so it reuses push-fanout's
// PUSH_WEBHOOK_SECRET + APNS_* — nothing new to set.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { hasPushSecret, sendApns } from "../_shared/apns.ts";
import {
  asLocale,
  dropAlert,
  recapAlert,
  rewindAlert,
  spotlightAlert,
  streakAlert,
  type Locale,
  type RecapStats,
  type RewindReady,
  type SavedDrop,
  type SpotlightWeek,
  type StreakSave,
} from "../_shared/push-copy.ts";

interface RecapRow extends RecapStats {
  user_id: string;
}

interface StreakRow extends StreakSave {
  user_id: string;
}

interface DropRow extends SavedDrop {
  user_id: string;
}

interface RewindRow extends RewindReady {
  user_id: string;
}

interface SpotlightRow extends SpotlightWeek {
  user_id: string;
}

interface TokenRow {
  id: string;
  user_id: string;
  token: string;
  platform: string;
  locale: string | null;
}

/** Light shape check — the caller is our own SQL, but never trust a body. */
function isRecapRow(value: unknown): value is RecapRow {
  const r = value as Partial<RecapRow> | null;
  return (
    !!r &&
    typeof r.user_id === "string" &&
    (r.kind === "recap" || r.kind === "nudge") &&
    typeof r.username === "string" &&
    typeof r.rated === "number" &&
    typeof r.likes === "number" &&
    typeof r.new_followers === "number"
  );
}

function isStreakRow(value: unknown): value is StreakRow {
  const r = value as Partial<StreakRow> | null;
  return (
    !!r &&
    typeof r.user_id === "string" &&
    typeof r.username === "string" &&
    typeof r.streak === "number"
  );
}

function isDropRow(value: unknown): value is DropRow {
  const r = value as Partial<DropRow> | null;
  return (
    !!r &&
    typeof r.user_id === "string" &&
    typeof r.username === "string" &&
    typeof r.title === "string" &&
    typeof r.artist === "string" &&
    typeof r.slug === "string" &&
    typeof r.more === "number"
  );
}

function isRewindRow(value: unknown): value is RewindRow {
  const r = value as Partial<RewindRow> | null;
  return (
    !!r &&
    typeof r.user_id === "string" &&
    typeof r.username === "string" &&
    typeof r.year === "number" &&
    typeof r.total === "number"
  );
}

function isSpotlightRow(value: unknown): value is SpotlightRow {
  const r = value as Partial<SpotlightRow> | null;
  return (
    !!r &&
    typeof r.user_id === "string" &&
    typeof r.username === "string" &&
    typeof r.title === "string" &&
    typeof r.artist === "string" &&
    typeof r.slug === "string"
  );
}

/** One message per person; each device gets it in its own language. */
interface Outgoing {
  user_id: string;
  alertFor: (locale: Locale) => ReturnType<typeof recapAlert>;
}

Deno.serve(async (req) => {
  // Same shared secret as push-fanout: only our own database job may
  // make phones buzz.
  if (!hasPushSecret(req)) {
    return new Response("forbidden", { status: 403 });
  }

  const payload = await req.json().catch(() => null);

  // Turn either message type into the same "who + what to say" list.
  let outgoing: Outgoing[];
  if (payload?.type === "RECAP" && Array.isArray(payload.recaps)) {
    outgoing = (payload.recaps as unknown[]).filter(isRecapRow).map((r) => ({
      user_id: r.user_id,
      alertFor: (locale) => recapAlert(locale, r),
    }));
  } else if (payload?.type === "STREAK" && Array.isArray(payload.streaks)) {
    outgoing = (payload.streaks as unknown[]).filter(isStreakRow).map((s) => ({
      user_id: s.user_id,
      alertFor: (locale) => streakAlert(locale, s),
    }));
  } else if (payload?.type === "DROP" && Array.isArray(payload.drops)) {
    outgoing = (payload.drops as unknown[]).filter(isDropRow).map((d) => ({
      user_id: d.user_id,
      alertFor: (locale) => dropAlert(locale, d),
    }));
  } else if (payload?.type === "REWIND" && Array.isArray(payload.rewinds)) {
    outgoing = (payload.rewinds as unknown[]).filter(isRewindRow).map((r) => ({
      user_id: r.user_id,
      alertFor: (locale) => rewindAlert(locale, r),
    }));
  } else if (payload?.type === "SPOTLIGHT" && Array.isArray(payload.spotlights)) {
    outgoing = (payload.spotlights as unknown[]).filter(isSpotlightRow).map((s) => ({
      user_id: s.user_id,
      alertFor: (locale) => spotlightAlert(locale, s),
    }));
  } else {
    return new Response("ignored", { status: 200 });
  }
  if (outgoing.length === 0) return new Response("nothing to send", { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Every device for everyone in this batch, in ONE query (the SQL
  // side sends at most 50 people per call).
  const { data: tokenData, error } = await supabase
    .from("push_tokens")
    .select("id, user_id, token, platform, locale")
    .in("user_id", outgoing.map((o) => o.user_id))
    .eq("platform", "ios"); // FCM: post-Play-launch
  if (error) {
    console.error("push-recap token lookup failed:", error.message);
    return new Response("token lookup failed", { status: 500 });
  }

  const byUser = new Map<string, TokenRow[]>();
  for (const row of (tokenData ?? []) as TokenRow[]) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const deadIds: string[] = [];
  let sent = 0;
  await Promise.all(
    outgoing.flatMap((msg) =>
      (byUser.get(msg.user_id) ?? []).map(async (device) => {
        // Copy per DEVICE language, like push-fanout.
        const alert = msg.alertFor(asLocale(device.locale));
        if (!alert) return;
        const result = await sendApns(device.token, alert);
        if (result === "ok") sent += 1;
        if (result === "dead") deadIds.push(device.id);
      })
    )
  );

  // Dead tokens out, same as push-fanout.
  if (deadIds.length > 0) {
    await supabase.from("push_tokens").delete().in("id", deadIds);
  }

  return new Response(`sent ${sent}`, { status: 200 });
});
