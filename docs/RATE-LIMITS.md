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
- **⚠️ VERIFY IN VERCEL:** that the two `UPSTASH_*` env vars are
  actually set in Production. If they aren't, every number below is
  per-instance only. This is the single highest-value thing to check
  and it can't be checked from the repo.
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

1. **The fail-open + no-Redis case above.** Check Vercel.
2. **Signed-out traffic is barely limited.** Almost every limit is
   keyed on a user id, so it only exists after sign-in. Public page
   reads are protected by Vercel/CDN rather than by us. The one
   ip-keyed limit is `profile-summary` (120/min).
3. **Auth endpoints are Supabase's, not ours** — sign-up, sign-in and
   password reset are rate limited by Supabase's own settings in the
   dashboard, not by `lib/rate-limit.ts`. Worth a look at the Auth →
   Rate Limits page there.
4. **No global per-user ceiling.** A determined account can sit near
   the limit on many different endpoints at once. Fine at our size;
   revisit if abuse ever shows up.
