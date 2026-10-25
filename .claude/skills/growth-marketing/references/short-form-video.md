# Short-form video: formats, hooks, and the reference video

Luca makes the edits himself on the Windows desktop (TikTok + Reels). His
rules first: no face or voice from him, sentence case, "Peak Music" never
"Peak", laid-back tone, no filler captions, 15–30s for ads, real lyrics in
order, ~4s outro with the App Store badge, vary the formula. Marketing
images = real screenshot + AI plate + frame, never 100% AI.

## 1. The reference video Luca sent (2026-10-25)

`C:\random shit\v15044gf0000db7d0mnog65ur68tg6pg.mov` — a TikTok by the
developer **@ayoships**: "Block Blast makes over $100 million… decompiled".
69s, 576×1024, ~30fps.

**Story arc (the part to steal):**
1. **Money hook, 0–4s:** App Store card (4.9★, #7 chart) → "Block Blast
   makes over $100 million". A bar chart B-roll: "that's more than" Candy
   Crush. A big, checkable number plus a familiar name.
2. **Promise of a secret:** "…has less to do with how well you do and more
   to do with how much your past ads [earned] on your phone."
3. **Proof on screen:** decompiled code with a highlighter sweeping over
   the key identifiers (`ad_revenue_recent`, `HIGH_PRICE_MULTIPLIER = 3.5`,
   `deathAlgorithm`). Viewers can't read the code, but they believe it.
4. **Villain twist:** "secretly makes it easier right up until you hit a
   really expensive ad… then it turns on you", "the death algorithm",
   "to survive is an offer to revive".
5. **Moral:** "it isn't really a game, it's an ad harvest… every penny out
   of you."
6. **Series CTA:** "to see [the next app] decompiled next, follow" with
   the handle in a TikTok search bar.

**Editing grammar:**
- A cut every 1–2 seconds; alternates talking head with B-roll (store
  card, chart, gameplay, code).
- Captions are 2–3 words at a time, heavy uppercase sans, white with
  **one keyword in the brand colour** (purple), centred in the lower third,
  always on screen. (Luca's own ads stay sentence case. The rule is one
  coloured keyword per caption, not the caps.)
- Code shots: dark editor, monospace, a highlight box that slides onto the
  important word right when it's said.
- Watermark-safe: nothing important in the bottom 20% or the right edge
  (TikTok's buttons). Same rule as the scorecard share card.

**How to use it at Peak Music without a face or voice:**
- Replace the talking head with **screen recordings of the app**, the
  **penguin**, or full-screen kinetic captions. Use trending audio or a beat
  instead of narration; captions carry the story.
- Luca **owns real code**, which is the format's authenticity engine:
  - "Your taste match % on Peak Music is literally this formula" → the
    actual function on screen, with highlights.
  - "Why your 7.5 doesn't count the same as everyone's" → the community
    average code (only if it's true; never invent mechanics).
  - "How Peak Music knows an album drops at midnight Eastern"
    (lib/upcoming.ts) → release-day hype.
- **Data exposés from real ratings** (the bar chart B-roll):
  - "The most overrated album on Peak Music, by [N] ratings"
  - "Critics gave it [x]. Our users gave it [y]." (Critic scores are public;
    name the publication, never make claims about a competitor *app*.)
  - "The album nobody rates below 9"
- Series CTA: "follow for the next one". Series give people a reason to
  follow, not just watch.

**Do NOT copy:** the manipulation it exposes. That video is a warning
about dark patterns (difficulty rigged to ad value, fake "near-win" revive
offers). Apple 2.5.18 also bans ads that "manipulate or trick users". The
web-monetization skill keeps ads honest.

## 2. Formats that fit Peak Music (no face needed)

| Format | Example | Notes |
|---|---|---|
| Scorecard video | Export from the share sheet, add trending audio | Already built; 60fps; one tap to TikTok once Share Kit is approved |
| Code exposé | Taste-match formula, see above | Reference-video grammar |
| Data exposé | Overrated/underrated by real ratings | Needs ~10+ ratings per album to be honest; say the N |
| Era homage ads | K-pop/brakence-style ad batches | Existing process: see the `ad-options-dropdowns` memory |
| Carousel | 100-members, community posts series | Info ON slides; Reprised = idea only, never copy |
| One-liner roundup | Best short reviews of the week | Credit users, ask first |
| Release-day countdown | "Midnight Eastern, rate it first" | Ties to release rooms |
| Unreleased vault | "Rate Carti's unreleased discography" | The wedge only Peak Music has; metadata only, never file links |
| Ambassadors (later) | Students posting lo-fi hooks | Airbuds model; must disclose paid posts |

## 3. Hooks

Rules from Airbuds and the reference video: the hook is a **text overlay in
the first second**, specific, a little provocative, and about the
*viewer's* identity or a checkable fact.

Hook patterns with Peak Music examples:
- **Big number + familiar name:** "This album has a 9.4 from 37 ratings
  on Peak Music."
- **Secret/mechanism:** "Here's the actual code that decides your taste
  match."
- **Identity:** "Me pretending my favourite [artist] song isn't the most
  hated one on Peak Music."
- **Challenge:** "Rate this album before you scroll."
- **Unpopular opinion:** "The most controversial album of 2026, by the
  numbers."
- **Series:** "Rating every [artist] album, day 3."

Test 3–5 hooks for the same video over a week; keep the format of
anything that beats the account's median views by 2x+; drop the rest.

## 4. Platform rules that bite

- **Paid creators/ambassadors** must disclose (TikTok's branded-content
  toggle; FTC #ad). Airbuds creators tag #ad.
- **Originality:** TikTok keeps reposted or unoriginal content off the For
  You feed. Make your own slides and edits; don't re-upload others' clips.
- **Music rights:** brand/business accounts only get the Commercial Music
  Library. Ads (not organic posts) need licensed audio.
- **Lyrics** in ads: Luca's rule is real lyrics in order. Keep it to short
  quotes.
- **Multiple accounts:** fine if they're transparent (named like
  "x.peakmusic") and post original content; never fake reviews or
  pretend to be unaffiliated fans.
- **Instagram/Reddit:** no link-heavy posts; the Reddit spam filter
  already banned one sub.

## 5. Cadence at Peak Music's size

- Aim for **1 post a day across TikTok + Reels** (same edit, both places)
  rather than one polished post a week. Duolingo's team ran a two-day
  cycle with two people; Airbuds' creators spend ~10 minutes a video.
- Batch on one evening: 5–7 edits from one template, schedule them.
- Every week, note which hook won (views vs. the account's median) in
  `docs/marketing/`.

## Sources

- The reference video above (frames reviewed 2026-10-25).
- Coverage of @ayoships' Block Blast findings:
  https://techradar.com/pro/the-dark-side-of-free-mobile-games-how-developers-reverse-engineer-your-patience-to-milk-ad-revenue
- https://www.shortimize.com/blog/airbuds-300-tiktok-a-day-strategy-to-2-on-the-appstore
- https://www.reelcarousel.app/blog/faceless-tiktok-accounts-promoting-apps
- https://technical.ly/company-culture/duolingo-viral-marketing-strategy-lessons.md
