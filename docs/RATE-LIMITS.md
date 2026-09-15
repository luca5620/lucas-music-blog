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

### Recorded 2026-09-14 (Luca, off the dashboard)

| Limit | Value | Scope | Verdict |
|---|---|---|---|
| Emails sent | **200 / hour** (raised from 30, 2026-09-14) | whole project | no longer the binding limit — Resend is, see below |
| Sign-ups + sign-ins | 30 / 5 min | per IP | fine |
| Token verifications | 30 / 5 min | per IP | fine |
| Token refreshes | 150 / 5 min | per IP | fine, generous |
| MFA challenges | not present | — | MFA isn't enabled on the project, so the field doesn't render. Nothing to set. |

**Emails: raised to 200/hour, which means Supabase is no longer the
constraint. Resend is.** There are two ceilings on auth email and only
the lower one matters:

| Ceiling | Allows | Effective per day |
|---|---|---|
| Supabase, 200/hour | project-wide | ~4,800 |
| **Resend FREE plan** | 100/day, 3,000/month | **100** |

So the real cap is **~100 auth emails a day**, and Supabase's number
could be raised to a million without changing that. One signup spends
one email. Password resets spend from the same pool, and so does the
"resend confirmation" button on the signup screen (60-second cooldown,
so a confused person can burn several by themselves).

**What happens at the cap:** Resend refuses, Supabase's send fails,
and `supabase.auth.signUp` comes back with an error. `app/signup/page.tsx`
has friendly copy for "already registered" and falls through to
printing `authError.message` raw for everything else — so the person
would see something like *"Error sending confirmation email"*. Not a
crash, but not language a normal user can act on either. Worth a
friendly branch next to the existing one if we ever expect to get
near the cap. (Six locales, so it's a small task, not a one-liner.)

**Recommendation, in order:**

1. **Do nothing yet.** 100/day is comfortably above current signup
   volume. Paying now would be a bill for a problem we don't have,
   and ROADMAP's line on monetization is "dormant until real bills."
2. **Stagger the marketing posts.** One community at a time rather
   than Reddit + the leak Discords + Android testers in one evening.
   That keeps the daily total under 100 for free, and it's better
   marketing regardless: the first post teaches you what to change in
   the second.
3. **Only if a push is expected to be big:** Resend's paid tier lifts
   the daily cap for about $20/month, and can be dropped again after.
   Check their current pricing rather than trusting this number.
4. **Look at the Resend dashboard the day after any post.** It shows
   sends against quota. That's the early warning, and nothing in our
   app will surface it.

The other three are fine and need no action:

- **Sign-ins, 30 per 5 min per IP** is also the password brute-force
  guard. Permissive-ish (360/hour from one IP) but acceptable next to
  Supabase's password rules, and lowering it would start punishing
  shared networks.
- **Verifications, 30 per 5 min per IP** only gates clicking a
  confirmation link or entering an OTP. Nobody legitimate does that
  thirty times.
- **Refreshes, 150 per 5 min per IP** is generous, which is what you
  want. A session refreshes about once an hour, so this only becomes
  visible behind heavy carrier NAT — far beyond our size. Too LOW here
  is what logs real users out, so leave it alone.

