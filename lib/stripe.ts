import { createHmac, timingSafeEqual } from "crypto";

/**
 * Stripe — the two things the supporter checkmark needs (2026-10-25).
 *
 * No Stripe SDK on purpose: we only ever (1) create a Checkout Session
 * and (2) check a webhook's signature, and both are one plain HTTPS
 * call / one HMAC. Fewer dependencies = fewer things to update.
 *
 * Server-only (it reads secret env vars). Env (see .env.example):
 *   STRIPE_SECRET_KEY      sk_live_… (or sk_test_… while testing)
 *   STRIPE_WEBHOOK_SECRET  whsec_…   (Stripe → Developers → Webhooks)
 *
 * WEBSITE ONLY: the iOS/Android shell never shows the support page's
 * button (isNativeApp gate in components/support/SupportPanel.tsx) —
 * Apple 3.1.1 wants in-app purchases to go through Apple, and keeping
 * money out of the app keeps the EU listing non-trader.
 */

const STRIPE_API = "https://api.stripe.com/v1";
// Pinned to the SAME API version as the webhook destination
// (Dashboard → Webhooks), so the Checkout Session we create and the
// one the webhook hands back always have the same shape — an account
// default upgrade can't silently change either. Bump both together.
const STRIPE_VERSION = "2026-09-30.endive";

/** Smallest/largest support we accept, in cents. Stripe's own floor is
    50¢; $1 keeps card fees from eating the whole thing. */
export const SUPPORT_MIN_CENTS = 100;
export const SUPPORT_MAX_CENTS = 50_000;

export function stripeConfigured(): boolean {
  return !!process.env.STRIPE_SECRET_KEY;
}

/**
 * Create a one-off "Support Peak Music" Checkout Session for any
 * amount and return Stripe's hosted payment page URL.
 * client_reference_id = the signed-in user's id: that's how the
 * webhook knows whose profile gets the checkmark.
 */
export async function createSupportCheckout(opts: {
  userId: string;
  amountCents: number;
  origin: string;
}): Promise<string | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;

  // Stripe's API takes form-encoded bodies with bracket keys.
  const form = new URLSearchParams({
    mode: "payment",
    // OFF on purpose. The account has Managed Payments (Stripe as the
    // seller of record) on by default, and then Stripe REFUSES any
    // session whose product has no Managed-Payments tax code — that
    // was the "Couldn't reach the payment page" error on 2026-10-25.
    // A cosmetic badge doesn't map cleanly onto any eligible code, so
    // these stay plain Stripe payments (Peak Music is the seller).
    "managed_payments[enabled]": "false",
    client_reference_id: opts.userId,
    "metadata[user_id]": opts.userId,
    "metadata[kind]": "supporter",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": "usd",
    "line_items[0][price_data][unit_amount]": String(opts.amountCents),
    "line_items[0][price_data][product_data][name]": "Support Peak Music",
    "line_items[0][price_data][product_data][description]":
      "A one-time thank-you. You get the silver supporter checkmark for good.",
    success_url: `${opts.origin}/support?thanks=1`,
    cancel_url: `${opts.origin}/support`,
    // Not submit_type "donate": Peak Music isn't a charity, so the
    // button says "Pay" (web-monetization skill: never "donation").
  });

  const res = await fetch(`${STRIPE_API}/checkout/sessions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": STRIPE_VERSION,
    },
    body: form,
  });
  if (!res.ok) {
    console.error("stripe checkout failed:", res.status, await res.text().catch(() => ""));
    return null;
  }
  const session = (await res.json()) as { url?: string };
  return session.url ?? null;
}

/**
 * Check a webhook's Stripe-Signature header the way Stripe documents
 * it: header "t=<unix>,v1=<hex>[,v1=…]", signed payload "<t>.<raw body>",
 * HMAC-SHA256 with the endpoint's whsec_ secret. Also rejects anything
 * older than 5 minutes so a captured request can't be replayed later.
 */
export function verifyStripeSignature(
  rawBody: string,
  header: string | null,
  secret: string,
  toleranceSeconds = 300
): boolean {
  if (!header) return false;
  let timestamp: string | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = v ?? null;
    if (k === "v1" && v) signatures.push(v);
  }
  if (!timestamp || signatures.length === 0) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`, "utf8")
    .digest();
  // Constant-time compare against every v1 (Stripe sends several
  // while a secret is being rolled).
  return signatures.some((sig) => {
    const given = Buffer.from(sig, "hex");
    return given.length === expected.length && timingSafeEqual(given, expected);
  });
}
