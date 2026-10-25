import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";
import {
  createSupportCheckout,
  stripeConfigured,
  SUPPORT_MAX_CENTS,
  SUPPORT_MIN_CENTS,
} from "@/lib/stripe";

/**
 * POST /api/support/checkout  { amount_cents }
 *
 * Starts a "Support Peak Music" payment (2026-10-25): makes a Stripe
 * Checkout Session for the signed-in member and hands back Stripe's
 * hosted payment page URL; the browser goes there. The checkmark is
 * NOT granted here — only the signed webhook (/api/stripe/webhook)
 * does that, once Stripe says the money actually arrived.
 *
 * Signed-in only, so the payment is tied to an account (the user id
 * comes from the session, never the body — same rule as every route).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Log in to support Peak Music." }, { status: 401 });
  }

  // A handful of tries an hour is plenty — each one is a real Stripe
  // session, and nobody needs to open fifty.
  const limited = await rateLimit(`support-checkout:${user.id}`, 10, 3600_000);
  if (limited) return limited;

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: "Supporting isn't switched on yet. Check back soon." },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const amount = (body as { amount_cents?: unknown } | null)?.amount_cents;
  if (
    typeof amount !== "number" ||
    !Number.isInteger(amount) ||
    amount < SUPPORT_MIN_CENTS ||
    amount > SUPPORT_MAX_CENTS
  ) {
    return NextResponse.json(
      {
        error: `Pick an amount between $${SUPPORT_MIN_CENTS / 100} and $${SUPPORT_MAX_CENTS / 100}.`,
      },
      { status: 400 }
    );
  }

  const url = await createSupportCheckout({
    userId: user.id,
    amountCents: amount,
    origin: request.nextUrl.origin,
  });
  if (!url) {
    return NextResponse.json(
      { error: "Couldn't reach the payment page. Try again in a minute." },
      { status: 502 }
    );
  }
  return NextResponse.json({ url });
}
