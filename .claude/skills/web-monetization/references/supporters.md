# Supporter checkmark ("donator checkmark")

Luca's idea (2026-10-25): a support area on the website; anyone who chips
in gets a checkmark. It fits the existing badge system: share cards and
profiles already draw role checkmarks after the @handle (`ROLE_BADGES` in
lib/share-cards/render.ts: owner gold, admin blue, reviewer green, tester
purple, all with glows).

## 1. The model to copy: Letterboxd Patron (not Patreon)

Letterboxd sells **Pro** (no ads, stats) and **Patron** (everything +
custom backdrops + a listing in the Patrons directory + early features),
on the web and in the app stores. The perk people value is
**recognition**. For Peak Music:

- **Supporter** (one-off or monthly, pay what you want, e.g. $3 minimum):
  - a supporter checkmark next to the @handle (profile, reviews,
    comments, share cards), in its own colour (not owner gold or admin
    blue, e.g. a warm pink/coral glow), with a tooltip "Supports Peak Music"
  - no ads on the website while signed in
  - name on a public "Supporters" page / the About page (opt-out)
  - optional cosmetic extras later (profile frame, early access)
- **Nothing functional** is unlocked: rating, reviewing, Aux Wars and
  rooms stay free. This keeps it in "recognition" territory for Apple
  (see apple-and-eu.md) and matches "never paywall core features".

One-off vs monthly: give the checkmark for **12 months** after a one-off
payment, and while a monthly is active. A "Supporter since 2026" line on
the profile rewards early supporters forever, even after the checkmark
lapses.

## 2. Payment provider

| Option | Fees (2026, verify) | Good | Bad |
|---|---|---|---|
| **Ko-fi** | 0% platform fee on one-off tips (free plan); 5% on memberships unless Ko-fi Gold (~$6–8/mo); plus Stripe/PayPal processing (~2.9% + 30¢) | Zero setup, PayPal + cards, a webhook with a verification token, handles "tips to a creator" which is what this legally is | A hop off-site; matching the payer to a Peak Music account needs a step |
| **Stripe Payment Links / Checkout** | ~2.9% + 30¢, no platform cut | On-site feel, pass the user id in `client_reference_id`, so matching is exact; subscriptions built in | Luca must run a Stripe account (identity, tax info); more code (webhook route, signature check) |
| Buy Me a Coffee | 5% + processing | Simple | Costs more than Ko-fi, no PayPal |

**Recommendation:** start with **Ko-fi** (fastest, no platform fee on
one-off tips). Move to Stripe Checkout when monthly supporters are a real
number.

## 3. Ko-fi → checkmark, how it would work

Ko-fi sends a webhook POST (form-encoded, a `data` field of JSON) on each
Donation / Subscription / Shop Order, with a `verification_token` from
Ko-fi → Settings → Advanced → Webhooks.

1. Supporter page on the site (web only) explains the perks and has a
   "Support on Ko-fi" button. It also shows the user a short **claim code**
   (e.g. `PMR-4F7K`) and asks them to paste it into Ko-fi's message box.
   (Ko-fi sends the message text, the payer's email and name.)
2. `app/api/kofi/route.ts`: check `verification_token` against a server
   env var (constant-time compare); rate-limit like every route; parse
   `data`; find the claim code in `message`, else match `email` against the
   account's auth email (server-side lookup only; never expose emails).
3. Record it in a `supporters` table (user_id, source, amount, currency,
   kofi_transaction_id unique, is_subscription, supported_at, expires_at).
   A unique transaction id makes webhook retries harmless.
4. A new role value or a separate `is_supporter` derived from
   `expires_at > now()`; badge rendering reads it the same way the role
   badges do.
5. Unmatched payments go into an admin list so Luca can attach them by
   hand.

Notes:
- **Migration** needed: a numbered SQL file (check the highest number in
  supabase/migrations/), run by hand in the Supabase SQL Editor. Say so
  in ROADMAP.md.
- **RLS:** users can read their own supporter row; only the webhook (via a
  `security definer` function, since the app has no service-role key) can
  insert. Same pattern as the catalog insert function.
- The anon key can't verify Ko-fi itself, so the token check is the only
  gate. Keep the token out of the repo (Vercel env var).

## 4. Money, tax, legal (plain words, not legal advice)

- This is **income** for Luca, not a donation; it's taxable like any other
  side income. Keep Ko-fi/Stripe statements.
- Call it "support", "tip" or "supporter", not "donation" (that implies a
  charity, and Peak Music isn't one).
- Refunds: say on the page that support is non-refundable except where the
  law requires; Ko-fi handles disputes.
- **Terms page** (app/terms): add a short "Supporters" section (what you
  get, the 12-month rule, perks may change, no core features are sold).
- **Privacy page:** mention Ko-fi/Stripe as processors and what's stored
  (amount, date, transaction id; not card details).

## 5. Later: subscriptions

When there's demand: Stripe subscriptions on the web, and if it's ever
sold *in the app*, Apple IAP plus EU **trader** status first. See
apple-and-eu.md.

## Sources

- https://letterboxd.com/about/pro/
- https://www.ruzuku.com/learn/articles/ko-fi-pricing
- https://schoolmaker.com/blog/buy-me-a-coffee-pricing
- https://apis.apievangelist.com/store/ko-fi-webhook/ (webhook shape)
- https://github.com/sepTN/djanko (token-check example)
