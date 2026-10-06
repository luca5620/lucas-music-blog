// ============================================================
// _shared/apns.ts — talking to Apple Push (APNs), shared by every
// push-sending edge function (push-fanout, push-recap). 2026-10-05.
//
// Supabase bundles anything under supabase/functions/_shared into each
// function that imports it (the leading underscore means "not a
// function of its own"), so this is deployed as part of push-fanout
// and push-recap — no separate deploy.
//
// Moved here verbatim-in-spirit from push-fanout/index.ts (2026-08-31)
// so the recap function sends through the exact same, battle-tested
// path: cached ES256 provider token, production-then-sandbox retry,
// and the same "dead token" verdicts.
//
// Required secrets (project-wide — `supabase secrets set` applies to
// every function, so push-recap reuses push-fanout's):
//   APNS_KEY_ID      — 10-char id of the .p8 APNs auth key
//   APNS_TEAM_ID     — Apple Developer team id (82VZZ93GVV)
//   APNS_PRIVATE_KEY — the .p8 file's full PEM contents
//   APNS_TOPIC       — the bundle id: com.peakmusicreviews.app
// ============================================================

// Two environments, and a device token is only ever valid in ONE of
// them. TestFlight and App Store builds get PRODUCTION tokens; a build
// run straight from Xcode onto a phone gets a SANDBOX one. Since the
// token itself doesn't say which it is, we try production and fall
// back — see sendApns.
const APNS_PRODUCTION = "https://api.push.apple.com";
const APNS_SANDBOX = "https://api.sandbox.push.apple.com";

/** What one push says. `title` is the bold first line on iOS. */
export interface PushAlert {
  title: string;
  body: string;
  /** Where tapping it goes — PushRegistration routes the app there. */
  href: string;
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

/** One POST to one APNs host. */
async function postApns(
  host: string,
  token: string,
  alert: PushAlert
): Promise<{ ok: boolean; status: number; reason: string }> {
  const res = await fetch(`${host}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${await apnsJwt()}`,
      "apns-topic": Deno.env.get("APNS_TOPIC")!,
      "apns-push-type": "alert",
      "apns-priority": "10",
    },
    body: JSON.stringify({
      aps: {
        // Two lines, not one: iOS draws `title` bold above `body`, so
        // the banner reads as "Luca" / "liked your review of X" the way
        // every other social app does it, instead of one run-on line.
        alert: { title: alert.title, body: alert.body },
        sound: "default",
      },
      // The tap deep-link — PushRegistration routes to it.
      href: alert.href,
    }),
  });

  if (res.ok) return { ok: true, status: res.status, reason: "" };
  const reason = (await res.json().catch(() => ({})))?.reason ?? "";
  return { ok: false, status: res.status, reason };
}

/**
 * Send one alert to one device. Returns "dead" only when the token is
 * genuinely gone (the caller should delete it from push_tokens).
 *
 * The sandbox retry is what makes on-device testing possible. APNs
 * answers BadDeviceToken both for a token that has been revoked AND for
 * a perfectly good token sent to the wrong environment — and a phone
 * running a build straight from Xcode holds a sandbox token. Without
 * the retry, testing push during a Mac session would look exactly like
 * a broken setup: no notification arrives, and because "dead" tokens
 * get deleted, the device quietly removes itself from push_tokens and
 * has to re-register to try again.
 *
 * Production is tried first because that's every real user.
 */
export async function sendApns(
  token: string,
  alert: PushAlert
): Promise<"ok" | "dead" | "error"> {
  const prod = await postApns(APNS_PRODUCTION, token, alert);
  if (prod.ok) return "ok";

  if (prod.reason === "BadDeviceToken") {
    const sandbox = await postApns(APNS_SANDBOX, token, alert);
    if (sandbox.ok) return "ok";
    // Rejected by both: nothing will ever deliver to it.
    if (
      sandbox.status === 410 ||
      sandbox.reason === "BadDeviceToken" ||
      sandbox.reason === "Unregistered"
    ) {
      return "dead";
    }
    console.error(`APNs sandbox ${sandbox.status}: ${sandbox.reason}`);
    return "error";
  }

  if (prod.status === 410 || prod.reason === "Unregistered") return "dead";

  console.error(`APNs ${prod.status}: ${prod.reason}`);
  return "error";
}

/**
 * The shared-secret gate every push function puts in front of itself.
 * Anyone on the internet can POST to a function URL (they're deployed
 * with --no-verify-jwt so Postgres can call them); without this check
 * a stranger could make the app send real users fake notifications.
 * The database side (032's trigger, 055's recap job) sends the same
 * value in the x-push-secret header.
 */
export function hasPushSecret(req: Request): boolean {
  const expected = Deno.env.get("PUSH_WEBHOOK_SECRET");
  // An unset secret must never mean "anyone may send".
  if (!expected) return false;
  return req.headers.get("x-push-secret") === expected;
}
