import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import { isUuid } from "@/lib/validate";
import { verifyStripeSignature } from "@/lib/stripe";

/**
 * POST /api/stripe/webhook — Stripe tells us a payment went through.
 *
 * In Stripe → Developers → Webhooks, add an endpoint
 *   https://peakmusicreviews.com/api/stripe/webhook   (no www — Stripe
 *   doesn't follow the www → apex redirect)
 * listening to `checkout.session.completed` AND
 * `checkout.session.async_payment_succeeded`, and put its signing
 * secret (whsec_…) in Vercel as STRIPE_WEBHOOK_SECRET.
 *
 * Three gates before anything is written:
 *   1. the Stripe-Signature HMAC (lib/stripe.ts) — only Stripe can
 *      produce it, and it expires after 5 minutes;
 *   2. it must be a PAID supporter session for a real user id;
 *   3. record_supporter (migration 061) checks SUPPORTER_RPC_SECRET
 *      itself — this route only has the anon key, like the whole app.
 * Stripe retries a webhook until it gets a 2xx, and the session id is
 * the payments table's primary key, so a retry can't double-count.
 */
export async function POST(request: NextRequest) {
  // Generous: Stripe itself is the only legit caller, but a flood of
  // junk shouldn't cost HMAC work forever.
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anon";
  const limited = await rateLimit(`stripe-webhook:${ip}`, 120, 60_000);
  if (limited) return limited;

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const rpcSecret = process.env.SUPPORTER_RPC_SECRET;
  if (!webhookSecret || !rpcSecret) {
    // Not set up yet — a 503 makes Stripe retry later instead of
    // dropping the event, so nobody's checkmark is lost.
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  // The signature covers the EXACT bytes Stripe sent, so read the raw
  // text — never request.json() before verifying.
  const raw = await request.text();
  if (!verifyStripeSignature(raw, request.headers.get("stripe-signature"), webhookSecret)) {
    return NextResponse.json({ error: "Bad signature" }, { status: 400 });
  }

  let event: {
    type?: string;
    data?: {
      object?: {
        id?: string;
        client_reference_id?: string | null;
        payment_status?: string;
        amount_total?: number | null;
        currency?: string | null;
        metadata?: Record<string, string> | null;
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Anything else (Stripe sends whatever the endpoint subscribes to):
  // acknowledge and ignore.
  // Two ways a supporter payment finishes (Stripe's fulfillment guide):
  //  • checkout.session.completed — cards, Apple Pay, Link… already
  //    paid when the customer finishes Checkout;
  //  • checkout.session.async_payment_succeeded — bank debits (SEPA,
  //    Bacs, …) that Stripe's dynamic payment methods / Adaptive
  //    Pricing can offer: "completed" arrives first with
  //    payment_status "unpaid", the money days later. Both carry the
  //    same Checkout Session, and the session id makes a repeat a no-op.
  const session = event.data?.object;
  if (
    (event.type !== "checkout.session.completed" &&
      event.type !== "checkout.session.async_payment_succeeded") ||
    !session ||
    session.metadata?.kind !== "supporter"
  ) {
    return NextResponse.json({ received: true });
  }
  // Only grant once the money is actually in ("unpaid" = a bank debit
  // still on its way; its async_payment_succeeded event comes later).
  if (session.payment_status !== "paid") {
    return NextResponse.json({ received: true });
  }

  const userId = session.client_reference_id ?? session.metadata?.user_id;
  const amount = session.amount_total ?? 0;
  if (!isUuid(userId) || typeof session.id !== "string" || amount <= 0) {
    console.error("stripe webhook: supporter session without a usable user/amount", session.id);
    return NextResponse.json({ received: true });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("record_supporter", {
    p_secret: rpcSecret,
    p_user_id: userId,
    p_session_id: session.id,
    p_amount_cents: amount,
    p_currency: session.currency ?? "usd",
  } as never);

  if (error || data !== true) {
    // 500 → Stripe retries (for up to 3 days), so a DB blip or a
    // secret mismatch can be fixed without losing the payment.
    console.error("stripe webhook: record_supporter failed", error?.message ?? data);
    return NextResponse.json({ error: "Could not record" }, { status: 500 });
  }
  return NextResponse.json({ received: true });
}
