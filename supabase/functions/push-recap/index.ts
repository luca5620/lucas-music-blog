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
import { asLocale, recapAlert, type RecapStats } from "../_shared/push-copy.ts";

interface RecapRow extends RecapStats {
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

Deno.serve(async (req) => {
  // Same shared secret as push-fanout: only our own database job may
  // make phones buzz.
  if (!hasPushSecret(req)) {
    return new Response("forbidden", { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  if (payload?.type !== "RECAP" || !Array.isArray(payload.recaps)) {
    return new Response("ignored", { status: 200 });
  }
  const recaps = (payload.recaps as unknown[]).filter(isRecapRow);
  if (recaps.length === 0) return new Response("nothing to send", { status: 200 });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Every device for everyone in this batch, in ONE query (the SQL
  // side sends at most 50 people per call).
  const { data: tokenData, error } = await supabase
    .from("push_tokens")
    .select("id, user_id, token, platform, locale")
    .in("user_id", recaps.map((r) => r.user_id))
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
    recaps.flatMap((recap) =>
      (byUser.get(recap.user_id) ?? []).map(async (device) => {
        // Copy per DEVICE language, like push-fanout.
        const alert = recapAlert(asLocale(device.locale), recap);
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
