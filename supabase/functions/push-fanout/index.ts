// ============================================================
// push-fanout — Supabase Edge Function (Deno), 2026-08-31.
// Reworked 2026-10-05: six languages, blocks respected, APNs code
// moved to ../_shared/apns.ts (shared with push-recap).
//
// The delivery half of push notifications. The 032 trigger on
// `notifications` INSERT calls this with the new row; we look up the
// recipient's device tokens (push_tokens, migration 029) and send an
// APNs alert per iOS device. Android/FCM is a stub until the Play
// launch (see docs/PUSH-NOTIFICATIONS.md).
//
// WHY AN EDGE FUNCTION: reading the RECIPIENT's tokens needs the
// service-role key, and the app's standing rule is that the key never
// ships in the app. Here it stays inside Supabase's own infra —
// injected automatically as SUPABASE_SERVICE_ROLE_KEY.
//
// ⚠️ This does NOT deploy with Vercel. After changing it (or anything
// in ../_shared), deploy by hand:
//     supabase functions deploy push-fanout --no-verify-jwt
//
// Secrets: PUSH_WEBHOOK_SECRET (the x-push-secret header the trigger
// sends) + the APNS_* ones listed in ../_shared/apns.ts.
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";
import { hasPushSecret, sendApns } from "../_shared/apns.ts";
import { asLocale, notificationBody, someone } from "../_shared/push-copy.ts";

interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  href: string;
  title: string | null;
}

interface TokenRow {
  id: string;
  token: string;
  platform: string;
  /** Migration 052. Missing on a database where 052 hasn't run. */
  locale?: string | null;
}

Deno.serve(async (req) => {
  // Gate: only the database trigger (which sends the shared secret)
  // may trigger sends.
  if (!hasPushSecret(req)) {
    return new Response("forbidden", { status: 403 });
  }

  const payload = await req.json().catch(() => null);
  const record = payload?.record as NotificationRecord | undefined;
  if (payload?.type !== "INSERT" || !record?.user_id) {
    return new Response("ignored", { status: 200 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Recipient's devices, the actor's name, and "is there a block
  // between them?" — in parallel.
  const [tokensRes, actorRes, blockRes] = await Promise.all([
    supabase
      .from("push_tokens")
      .select("id, token, platform, locale")
      .eq("user_id", record.user_id),
    supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", record.actor_id)
      .maybeSingle(),
    // Either direction. notify_user()/notify_followers() (052) already
    // refuse to create rows across a block — this is the backstop for
    // any row that got in some other way (an old deploy, a direct
    // insert under 025's policy). Service role reads everyone's blocks.
    supabase
      .from("user_blocks")
      .select("blocker_id")
      .or(
        `and(blocker_id.eq.${record.user_id},blocked_id.eq.${record.actor_id}),` +
          `and(blocker_id.eq.${record.actor_id},blocked_id.eq.${record.user_id})`
      )
      .limit(1),
  ]);

  if ((blockRes.data ?? []).length > 0) {
    return new Response("blocked", { status: 200 });
  }

  let tokens = (tokensRes.data ?? []) as TokenRow[];
  // Before migration 052 the `locale` column doesn't exist and the
  // select above errors — retry without it so pushes keep flowing
  // (in English) instead of silently stopping.
  if (tokensRes.error) {
    const retry = await supabase
      .from("push_tokens")
      .select("id, token, platform")
      .eq("user_id", record.user_id);
    tokens = (retry.data ?? []) as TokenRow[];
  }
  if (tokens.length === 0) return new Response("no devices", { status: 200 });

  const actorName = actorRes.data?.display_name || actorRes.data?.username || null;

  const deadIds: string[] = [];
  await Promise.all(
    tokens.map(async (row) => {
      if (row.platform !== "ios") return; // FCM: post-Play-launch
      // Each DEVICE speaks its own language (a phone set to Dutch gets
      // Dutch even if the same account's iPad is in English).
      const locale = asLocale(row.locale);
      const result = await sendApns(row.token, {
        // The actor's name is the bold title line; the verb phrase is
        // the body (the name is NOT repeated in it).
        title: actorName ?? someone(locale),
        body: notificationBody(locale, record.type, record.title),
        href: record.href,
      });
      if (result === "dead") deadIds.push(row.id);
    })
  );

  // Tokens APNs declared dead never work again — drop them so the
  // fan-out stays lean (this is also what frees a token to re-register
  // under a new account after a logout/login on the same phone).
  if (deadIds.length > 0) {
    await supabase.from("push_tokens").delete().in("id", deadIds);
  }

  return new Response("sent", { status: 200 });
});
