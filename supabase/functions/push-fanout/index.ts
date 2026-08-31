// ============================================================
// push-fanout — Supabase Edge Function (Deno), 2026-08-31.
//
// The delivery half of push notifications. A Database Webhook on
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
// Deploy + secrets: see docs/PUSH-NOTIFICATIONS.md. Required secrets:
//   PUSH_WEBHOOK_SECRET — shared secret the webhook sends in the
//                         x-push-secret header (anyone can hit a
//                         function URL; this gate makes spoofing
//                         notifications-that-never-happened useless)
//   APNS_KEY_ID         — 10-char id of the .p8 APNs auth key
//   APNS_TEAM_ID        — Apple Developer team id (82VZZ93GVV)
//   APNS_PRIVATE_KEY    — the .p8 file's full PEM contents
//   APNS_TOPIC          — the bundle id: com.peakmusicreviews.app
// ============================================================

import { createClient } from "npm:@supabase/supabase-js@2";

const APNS_HOST = "https://api.push.apple.com";

interface NotificationRecord {
  id: string;
  user_id: string;
  actor_id: string;
  type: string;
  href: string;
  title: string | null;
}

/** Same verb lines as the in-app bell (NotificationsBell.message). */
function messageFor(type: string, title: string | null): string {
  const t = title ? ` "${title}"` : "";
  switch (type) {
    case "follow":
      return "started following you";
    case "review_like":
      return `liked your review of${t}`;
    case "comment":
      return `commented on your review of${t}`;
    case "comment_reply":
      return `replied to your comment on${t}`;
    case "post_like":
      return `liked your post${t}`;
    case "list_like":
      return `liked your list${t}`;
    default:
      return "did something";
  }
}

/* ---------- APNs ES256 provider token, cached ~50 min ---------- */

let cachedJwt: { value: string; issuedAt: number } | null = null;

function b64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function apnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  // Apple rejects tokens older than 1h and refreshing more than every
  // 20 min is discouraged — 50 min cache threads that needle.
  if (cachedJwt && now - cachedJwt.issuedAt < 50 * 60) return cachedJwt.value;

  const keyId = Deno.env.get("APNS_KEY_ID")!;
  const teamId = Deno.env.get("APNS_TEAM_ID")!;
  const pem = Deno.env.get("APNS_PRIVATE_KEY")!;

  const pkcs8 = Uint8Array.from(
    atob(pem.replace(/-----[A-Z ]+-----/g, "").replace(/\s/g, "")),
    (c) => c.charCodeAt(0)
  );
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pkcs8,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const enc = new TextEncoder();
  const header = b64url(enc.encode(JSON.stringify({ alg: "ES256", kid: keyId })));
  const claims = b64url(enc.encode(JSON.stringify({ iss: teamId, iat: now })));
  const signature = new Uint8Array(
    await crypto.subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      enc.encode(`${header}.${claims}`)
    )
  );

  const jwt = `${header}.${claims}.${b64url(signature)}`;
  cachedJwt = { value: jwt, issuedAt: now };
  return jwt;
}

/** Send one alert. Returns "dead" when APNs says the token is gone. */
async function sendApns(
  token: string,
  body: string,
  href: string
): Promise<"ok" | "dead" | "error"> {
  const res = await fetch(`${APNS_HOST}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await apnsJwt()}`,
      "apns-topic": Deno.env.get("APNS_TOPIC")!,
      "apns-push-type": "alert",
      "apns-priority": "10",
    },
    body: JSON.stringify({
      aps: {
        alert: { body },
        sound: "default",
      },
      // The tap deep-link — PushRegistration routes to it.
      href,
    }),
  });

  if (res.ok) return "ok";
  const reason = (await res.json().catch(() => ({})))?.reason ?? "";
  if (res.status === 410 || reason === "BadDeviceToken" || reason === "Unregistered") {
    return "dead";
  }
  console.error(`APNs ${res.status}: ${reason}`);
  return "error";
}

/* ---------- The webhook handler ---------- */

Deno.serve(async (req) => {
  // Gate: only the Database Webhook (which sends the shared secret)
  // may trigger sends.
  if (req.headers.get("x-push-secret") !== Deno.env.get("PUSH_WEBHOOK_SECRET")) {
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

  // Recipient's devices + the actor's name, in parallel.
  const [tokensRes, actorRes] = await Promise.all([
    supabase
      .from("push_tokens")
      .select("id, token, platform")
      .eq("user_id", record.user_id),
    supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", record.actor_id)
      .maybeSingle(),
  ]);

  const tokens = tokensRes.data ?? [];
  if (tokens.length === 0) return new Response("no devices", { status: 200 });

  const actor =
    actorRes.data?.display_name || actorRes.data?.username || "Someone";
  const body = `${actor} ${messageFor(record.type, record.title)}`;

  const deadIds: string[] = [];
  await Promise.all(
    tokens.map(async (row) => {
      if (row.platform !== "ios") return; // FCM: post-Play-launch
      const result = await sendApns(row.token, body, record.href);
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
