# Push notifications — setup runbook

*Created 2026-08-31, the session the app went live. The CODE side is
done and committed; this file is the list of human-hands steps that
turn it on. Until every step is done, nothing breaks — the app simply
doesn't receive pushes and the in-app bell keeps working as before.*

## What's already built (no action needed)

| Piece | Where |
| --- | --- |
| Capacitor plugin (v7-line, pods installed) | `@capacitor/push-notifications` in package.json, `ios/App/Podfile` |
| APNs token forwarding | `ios/App/App/AppDelegate.swift` |
| Push entitlement (`aps-environment`) | `ios/App/App/App.entitlements`, wired in `project.pbxproj` |
| In-app registration + deep-link on tap | `components/ui/PushRegistration.tsx` (mounted in `app/layout.tsx`) |
| Token storage API | `POST /api/push/register` |
| Token table + RLS | `supabase/migrations/029-push-tokens.sql` |
| APNs fan-out (service-role side) | `supabase/functions/push-fanout/index.ts` |

Delivery flow: someone likes/follows/comments → the existing
`createNotification` inserts a `notifications` row → a **Database
Webhook** on that insert calls the **push-fanout edge function** → it
reads the recipient's `push_tokens` rows and posts to APNs → tapping
the push opens the app at the same `href` the bell uses.

## Human steps, in order

### 1. Run migration 029
Supabase SQL Editor → run `supabase/migrations/029-push-tokens.sql`
(after 028).

> **Done 2026-09-02** — steps 1 and 2 are complete. Migration 029 is
> run, and the APNs key exists and has been probed against Apple
> (accepted on both the production and sandbox hosts). The key is a
> SECOND key, separate from the Sign in with Apple one, because Apple
> keys carry per-service capabilities and the sign-in key had only
> that service enabled. Both keys must be kept: the sign-in secret has
> to be re-minted from the older one every 6 months.
> ⚠️ When creating an APNs key, do NOT restrict it to one environment
> — a sandbox-only key works in Xcode builds and dies on the App Store.

### 2. Create an APNs Auth Key (Apple Developer, ~2 min)
1. [developer.apple.com](https://developer.apple.com) → Certificates,
   Identifiers & Profiles → **Keys** → **+**.
2. Name it (e.g. `PMR Push`), tick **Apple Push Notifications service
   (APNs)**, Continue → Register.
3. **Download the `.p8` file — one chance only** — and note the
   **Key ID** (10 chars) shown next to it. Team ID is `82VZZ93GVV`
   (top-right of the developer portal).

### 3. Deploy the edge function + secrets (Supabase)
With the Supabase CLI (or paste the function in the dashboard's Edge
Functions editor):

```bash
supabase functions deploy push-fanout --no-verify-jwt
```

Then set the secrets (Dashboard → Edge Functions → push-fanout →
Secrets, or `supabase secrets set`):

- `APNS_KEY_ID` — from step 2
- `APNS_TEAM_ID` — `82VZZ93GVV`
- `APNS_PRIVATE_KEY` — the full text of the `.p8` file (open it in a
  text editor, copy everything including the BEGIN/END lines)
- `APNS_TOPIC` — `com.peakmusicreviews.app`
- `PUSH_WEBHOOK_SECRET` — any long random string; generate one with
  `openssl rand -hex 32` and keep it for step 4

### 4. Create the Database Webhook (Supabase dashboard)
Database → Webhooks → **Create a new hook**:
- Table: `notifications`, Events: **Insert** only
- Type: HTTP Request, Method: POST
- URL: the push-fanout function URL (shown on its dashboard page)
- HTTP Headers: add `x-push-secret` = the `PUSH_WEBHOOK_SECRET` value

### 5. Rebuild + submit the app
The plugin/entitlement/AppDelegate changes are NATIVE — they ship with
the next binary, not a web deploy:
1. `npm run mobile:ios`, select the App target → Signing &
   Capabilities and confirm **Push Notifications** shows (the
   entitlement is already wired; Xcode may just need a signing
   refresh).
2. Archive → upload → TestFlight → submit. (Same flow as launch,
   docs/MACBOOK-IOS-SETUP.md.)

### 6. Verify
- Fresh install from TestFlight, sign in → iOS permission prompt →
  Allow.
- Testing from a build run straight out of Xcode works too: that
  phone holds a SANDBOX token, and push-fanout retries the sandbox
  host whenever production answers BadDeviceToken. (Without that
  retry a wrong-environment token is indistinguishable from a revoked
  one, and the function would delete the device from push_tokens.)
- From another account, like one of your reviews → push arrives;
  tapping it opens the review.
- Supabase: `select count(*) from push_tokens;` should be ≥ 1.

## 2026-10-05 — dedup, blocks, six languages, Sunday recap

What changed (code on the branch; DB + functions need the hand steps
below):

- **Dedup works now** (migration 052). The old "already notified?"
  check ran as the actor and could never see the recipient's rows, so
  like/unlike loops re-buzzed phones. A partial unique index + the
  `notify_user()` / `notify_followers()` SQL functions (insert … on
  conflict do nothing) fix it, and the 032 trigger only fires for rows
  actually inserted — no duplicate row, no duplicate push.
- **Blocks** suppress notifications both ways (in the SQL functions and
  again in push-fanout), hide a blocked person's old rows from the bell,
  and stop the blocked person from following / liking / commenting /
  replying / being invited (API checks + restrictive RLS policies).
- **Language per device**: `push_tokens.locale` (052), filled by
  `/api/push/register` from the `pmr-lang` cookie on every launch and
  by the language picker (PATCH) on a switch. Copy for every
  notification type in all six languages lives in
  `supabase/functions/_shared/push-copy.ts` (mirrors the bell's
  `notifications.*` strings in messages/*.json — change both together).
- **Sunday recap** (migration 055 + new function `push-recap`): 6pm US
  Eastern every Sunday, pg_cron → `send_weekly_recaps()` → push-recap.
  Details and test commands are in the header of
  `supabase/migrations/055-weekly-recap-push.sql`.
- APNs code is shared in `supabase/functions/_shared/apns.ts`.
- **Android never registers for push** (PushRegistration gates to iOS):
  without `google-services.json` the plugin crashes the app natively.

Hand steps, in order:
1. SQL Editor: run `052-notification-dedup-blocks-push-locale.sql`.
2. Deploy both functions (Edge Functions do NOT ship with Vercel):
   ```bash
   supabase functions deploy push-fanout --no-verify-jwt
   supabase functions deploy push-recap --no-verify-jwt
   ```
   No new secrets — Supabase secrets are project-wide.
3. Make sure pg_cron is enabled (Database → Extensions → pg_cron), then
   replace `__PUSH_WEBHOOK_SECRET__` in
   `055-weekly-recap-push.sql` with the same value as in 032 and run it.
4. `select * from public.weekly_recap_candidates();` to preview; test
   on yourself with `select public.send_weekly_recaps(true, '<your
   uuid>');` (see the 055 header for the cleanup line).

## Android / FCM — later
The fan-out skips `platform = 'android'` tokens for now, and since
2026-10-05 the app doesn't even ask Android for a token (it would
crash without Firebase config). When the Play launch happens: create a
Firebase project, add `google-services.json`, extend push-fanout +
push-recap with FCM HTTP v1 (service-account JWT, same pattern as the
APNs half), and widen the platform gate in
`components/ui/PushRegistration.tsx` — gated on a build number, so old
Android binaries without the config never call register(). The comment
at that gate has the details.
