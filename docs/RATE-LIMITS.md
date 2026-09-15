# Rate limits & abuse surface

*Written 2026-09-14, at Luca's ask: "do we have rate limits for aux
wars in general, as well as what are our live chat limits, i would
like to know for security purposes."*

Every number here is **per signed-in user**, keyed on their user id,
and every mutation route on the site calls `rateLimit()` before it
touches the database. This file is the inventory; `lib/rate-limit.ts`
is the implementation.

## How the limiter actually behaves (read this first)

- **Upstash Redis when configured, per-instance memory when not.**
  With `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` set, the
  counter is shared across every Vercel instance and a limit means
  what it says. Without them it falls back to an in-memory `Map` that
  each serverless instance keeps separately — so the real ceiling
  becomes roughly *limit × number of warm instances*.
- **Redis errors FAIL OPEN.** If Upstash is unreachable the request is
  allowed and the error is logged. Deliberate: a hiccup at Upstash
  must not take the API down. It does mean limits are soft during an
  outage.
- **✅ CONFIRMED SET IN PRODUCTION (Luca, 2026-09-14):**
  `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are both
  present in Vercel Production, so the shared-Redis path is the one
  that actually runs and **every number below is a real ceiling across
  all instances**, not a per-instance one. Re-check this if the
  Upstash project is ever rotated, migrated or deleted — the fallback
  is silent, and nothing in the app will tell you it happened.
- **Rate limits are the second wall, not the first.** RLS is the real
  boundary: the app only ever holds the anon key, and every aux table
  has policies (migrations 042–047). A limit stops flooding; RLS stops
  doing things you aren't allowed to do at all.

## Aux Wars

| Action | Limit |
|---|---|
| Host a room | 10 / hour |
| Join with a code | 10 / 10 min |
| Chat message | 20 / min |
| Vote | 40 / min |
| Reaction (🔥/💩) | 20 / min |
| Song search | 30 / min |
| Paste a song link | 30 / min |
| Pick your song | 20 / min |
| Host: call a winner | 30 / min |
| Host: set the topic | 30 / min |
| Host: start a war | 10 / min |
| Host: end a war | 10 / min |
| Host: kick or ban | 60 / min |
| Host: invite a friend | 30 / hour |
| Edit room settings | 30 / min |
| Delete a room | 10 / min |
| Delete a message | 30 / min |
| Change your role | 30 / min |

Notes on the ones that look generous:

- **Vote (40/min) and reaction (20/min) cannot flood anything.**
  `aux_votes` is `PRIMARY KEY (game_id, user_id)` and the route
  upserts, so hammering it only rewrites that person's own single row.
  The high ceiling exists so switching your mind mid-song feels free.
- **Ban (60/min)** is high on purpose: it's the tool against someone
  spam-joining, so it must out-run them.
- **Join with a code (10 / 10 min)** is the brute-force guard on the
  six-character codes. At 10 tries per 10 minutes, guessing one of
  36^6 (~2.2 billion) combinations is not a threat.
- **Song search / link (30/min)** also protects our Spotify quota,
  not just the room.

## Live chat, both kinds

| | Aux Wars chat | Release-room chat |
|---|---|---|
| Messages | 20 / min | 20 / min |
| Length | 1–500 chars | 1–1000 chars |
| Enforced in the API | yes | yes |
| Enforced by a DB constraint | yes | yes |
| Zero-tolerance content filter | yes | yes |
| Who may post | RLS: can see the room, not banned | RLS: signed in |
| Delete your own | 30 / min | 30 / min |

Both chats run the App Store 1.2 content filter (`lib/content-filter.ts`)
before the insert, and both cap length in **two** places — the route
and a `check` constraint on the table — so a hand-rolled request that
skips the API still can't write a novel.

A ban in an Aux War silences the person's chat, votes and reactions
everywhere in that room at once (migration 045), and it outlives the
member row, which is the point against a re-joiner.

## Everywhere else, for context

| Action | Limit |
|---|---|
| Write a review | 5 / 5 min |
| Rate (no text) | 60 / 5 min |
| Write a post | 5 / 5 min |
| Comment | 10 / min |
| Like anything | 30 / min |
| Follow | 30 / min |
| Create a list | 10 / 5 min |
| Edit list items | 60 / min |
| Import a playlist | 3 / 5 min |
| Catalog import | 10 / min |
| Block someone | 30 / hour |
| Report something | 10 / hour |
| Song of the day | 15 / hour |
| Delete your account | 3 / hour |

## Known soft spots

1. **Fail-open during an Upstash outage.** The env vars are set, so
   the counters are shared and correct in normal operation. But a
   Redis error still allows the request through. An Upstash outage is
   therefore an open window, by design — availability was chosen over
   enforcement. Nothing to fix; just know it's the behaviour.
2. **Signed-out traffic is barely limited.** Almost every limit is
   keyed on a user id, so it only exists after sign-in. Public page
   reads are protected by Vercel/CDN rather than by us. The one
   ip-keyed limit is `profile-summary` (120/min).
3. **Auth endpoints are Supabase's, not ours.** See the section below.
4. **No global per-user ceiling.** A determined account can sit near
   the limit on many different endpoints at once. Fine at our size;
   revisit if abuse ever shows up.

## Supabase auth limits (dashboard-owned, not in this repo)

Sign-up, sign-in, password reset and email-confirmation links never
touch `lib/rate-limit.ts`. They are Supabase's endpoints, governed by
**Dashboard → Authentication → Rate Limits** on the project. Nothing
in the repo can read or set them, and they are not in version control,
so this section is the only record.

### Confirmed 2026-09-14

- **Custom SMTP is live: Resend** (`docs/LAUNCH-CHECKLIST.md`). This
  matters more than any number here. On Supabase's built-in sender an
  entire project is capped at roughly **2 auth emails per hour**,
  which on a live app with "confirm email" ON means signups silently
  stop working. Resend lifts that, and the dashboard's own email limit
  becomes the real ceiling.
- **Auth posture**, read from the public `/auth/v1/settings` endpoint
  with the anon key (anyone can read this — it exposes no secrets):

  | Setting | Value |
  |---|---|
  | Signups | enabled |
  | Email confirmation | REQUIRED (`mailer_autoconfirm: false`) |
  | Social providers on | Google, Apple only |
  | Phone / SMS auth | off |
  | Anonymous users | off |
  | Passkeys | off |
  | SAML | off |

  Phone auth being off is worth noting on its own: SMS is the auth
  surface that costs real money per abuse, and we don't expose it.

### ⬜ Still to record — the five numbers

Read off Authentication → Rate Limits and paste them in here. The ones
that matter for us, in order:

1. **Emails sent per hour.** Gates every signup confirmation and
   password reset. The one to watch on a launch day or a marketing
   push, since a burst of new users all need an email at once.
2. **Sign-ups and sign-ins, per 5 min per IP.** Shared IPs (a school,
   an office, mobile carrier NAT) hit this before an attacker does.
3. **Token verifications, per 5 min per IP.** Confirmation-link clicks
   and OTP checks.
4. **Token refreshes, per 5 min per IP.** Every open app session
   refreshes; too low and real users get logged out.
5. **MFA challenges, per 5 min per IP.** Low priority, we don't use MFA.

SMS and anonymous sign-in limits can be skipped — both providers are
off (see the table above).
