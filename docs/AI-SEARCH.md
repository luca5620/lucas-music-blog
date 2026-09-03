# Getting recommended by ChatGPT, Claude, Perplexity & co.

*Written 2026-09-02. Luca's ask: "how to rank highly if someone asks
ChatGPT or Claude about music reviewing apps."*

## How an assistant decides what to recommend

When someone asks "what's a good app to rate and review albums?", an
assistant builds its answer from two sources, and we have to work on
both:

1. **What the model already knows (training data).** Snapshots of the
   public web from months ago. Mentions on Reddit, Wikipedia-style
   sites, listicles, app directories and news carry the most weight —
   the model learns "Peak Music Reviews = music rating app, like
   Letterboxd for music" from seeing that sentence in many places.
   Nothing we write on our own site alone fixes this; it needs other
   sites saying it.
2. **Live web search at answer time.** ChatGPT searches through
   **Bing**; Claude and Perplexity use **Brave Search** (Claude also
   has its own Claude-SearchBot index). They then read the top pages
   and quote the ones that answer plainly. This is why Google-only SEO
   isn't enough: **being indexed and ranked on Bing is what puts us in
   ChatGPT answers.**

Either way the assistant needs to be able to state, in one sentence:
what it is, what it costs, what platforms, what's different. Our job
is to make that sentence trivially findable and consistent everywhere.

## What's shipped in the repo (done, 2026-09-02)

- `public/llms.txt` — the plain-text summary AI crawlers look for
  (llmstxt.org convention). One paragraph definition + key facts +
  page links. Keep it updated when facts change (Android launch,
  rebrand).
- `app/robots.ts` — every AI crawler explicitly allowed by name
  (GPTBot, OAI-SearchBot, ChatGPT-User, ClaudeBot, Claude-SearchBot,
  Claude-User, PerplexityBot, Google-Extended, Applebot-Extended,
  CCBot, meta-externalagent, Amazonbot…). Many CDNs block these by
  default; naming them says "read us".
- `SoftwareApplicationSchema` in `app/schema.tsx`, rendered site-wide
  from the root layout: category MusicApplication, free, web + iOS,
  App Store link, feature list.
- `/about` rewritten answer-first: definition sentence, a facts grid,
  a "what's different" list, and a visible FAQ that is also FAQPage
  JSON-LD (`aboutFAQs` in `lib/faq-data.ts`, now with "is it free /
  what platforms" and "is it a Musicboard alternative").
- Middleware skips `/llms.txt` so it's served as a plain static file.

## Luca's hands — in priority order

### 1. Bing Webmaster Tools (30 min, biggest single lever for ChatGPT)
- https://www.bing.com/webmasters → add peakmusicreviews.com. Use
  "Import from Google Search Console" — it copies the verification.
- Submit `https://peakmusicreviews.com/sitemap.xml`.
- Turn on **IndexNow** (Bing → Settings → IndexNow, get an API key).
  Note it in ROADMAP; a tiny ping on new release/review pages can be
  added later so Bing indexes them within minutes instead of weeks.
- Check "URL inspection" for `/`, `/about`, `/musicboard-alternative`
  a week later — they should all be indexed.

### 2. Get listed where "alternatives" answers come from (2–3 hours, once)
These directories are heavily present in training data AND rank on
Bing/Brave for "X alternative" queries. Use the same one-sentence
description everywhere (copy from llms.txt):
- **AlternativeTo** (alternativeto.net) — add Peak Music Reviews, mark
  it as an alternative to Musicboard, RateYourMusic, Album of the Year,
  Letterboxd. This is the single most-cited source for "alternatives".
- **Product Hunt** — a launch post (also a marketing moment; pair it
  with the Musicboard-refugee outreach in docs/MARKETING.md).
- **SaaSHub**, **Slant** ("What are the best apps to rate music?" —
  answer the existing question), **Crunchbase** (free company profile).
- **Wikidata** — create an item: instance of "mobile app" / "website",
  genre "music", official website, App Store ID 6803279876. Assistants
  lean on Wikidata for entity facts.
- App Store listing: keep "music reviews", "rate albums", "music social
  network", "musicboard", "letterboxd for music" in the keyword field
  (already partly done for 1.1 — verify).

### 3. Reddit (ongoing, the marketing plan's channel anyway)
Models weight Reddit heavily. When the Musicboard-refugee posts go out
(docs/MARKETING.md), make sure the description sentence appears in the
post body, not just a link. Good threads to answer honestly (no spam,
one comment, disclose you built it): "what app do you use to rate
albums", "letterboxd for music", "musicboard alternative" in
r/musicsuggestions, r/LetsTalkMusic, r/hiphopheads, r/popheads,
r/Musicboard.

### 4. Get written about (slow, compounding)
One honest write-up on a music blog, a YouTube "apps for music nerds"
video, or a newsletter mention is worth more than anything on-site.
The unreleased angle is the pitch — nobody else has it.

### 5. Measure (monthly, 10 min)
Ask each of ChatGPT (with search on), Claude, Perplexity, Gemini:
- "best apps to rate and review music albums"
- "letterboxd for music"
- "musicboard alternative"
- "app to rate unreleased music / leaks"
Log in ROADMAP whether we're mentioned, and what source they cite. The
cited source tells you where to push next. Expect: the "musicboard
alternative" and "unreleased" queries first (we own those pages),
the generic one last (needs directory + Reddit presence).

## Don'ts (standing rules that also apply here)
- No standalone "X vs Y" comparison pages — ⛔ per ROADMAP. The
  Musicboard page is the one exception and already exists.
- Never adopt "Rate & Review" phrasing (the clone tell). "Music review
  app" / "music social network" / "Letterboxd for music" are fine.
- Don't ask friends to post fake reviews/listings — assistants cite
  sources, and a thin astroturf trail is worse than none.

## Baseline — 2026-09-03 (Bing/Brave-style web search, four queries)

We appear in **none** of them. What does, and therefore where the
assistants get their answers:

| Query | Who shows up | Source type |
| --- | --- | --- |
| "musicboard alternative" | Product Hunt alternatives page, SaaSHub, AlternativeTo, StartupHub.ai, Semrush competitors | directories |
| "letterboxd for music app" | POPBOXD, Musicboard, RYM, Crate, MusicBox, achriom.com listicle "6 apps that pull it off (2026)", pi.fyi recs, TikTok | listicles + app stores |
| "best app to rate and review albums 2026" | Rate Music, AOTY, Musicboard, Musis, rate.fm, wavemusic.app blog "best album rating apps 2026", RYM, RecordScratch | listicles + app stores |
| "peak music reviews app" | Peak Player (a music player), two "The Peak" radio stations, a Peak Music podcast | name collision |

Takeaways:
1. **Directories are the whole game** for "alternative" queries.
   AlternativeTo + Product Hunt + SaaSHub listings are the fastest
   possible win — those three pages are literally what the assistants
   read.
2. **Two blogs own the listicles**: achriom.com and wavemusic.app.
   Email both — "you missed one, here's the unreleased angle." One
   inclusion puts us in every assistant answer that cites them.
3. **The name collides.** "Peak Music Reviews" returns radio stations
   and a music player. The rebrand to Peak Music won't fix that
   (worse, if anything); what fixes it is entity presence — Wikidata,
   Crunchbase, the directories — so the assistant has a record that
   says which "Peak Music" is the app.
4. POPBOXD, Crate, rate.fm, RecordScratch and MusicBox are the new
   competitors in this space that weren't on the radar. None of them
   touch unreleased music.

## Code shipped 2026-09-03

- **IndexNow** (`lib/indexnow.ts`): new review pages and freshly
  imported release pages are pinged to Bing the moment they exist.
  `/<key>.txt` ownership file is served by a rewrite → `/api/indexnow/key`.
  Off until `INDEXNOW_KEY` is set on Vercel (then redeploy).
- **Verification tags**: `NEXT_PUBLIC_BING_VERIFICATION` and
  `NEXT_PUBLIC_GOOGLE_VERIFICATION` render the meta tags from the
  root layout when set.
- `public/llms-full.txt`: the long-form description + FAQ; llms.txt
  refreshed (Android closed testing, unreleased filter, badges,
  players, small-artist angle).

## Setup steps (Luca, in order — 30 min total)

1. https://www.bing.com/webmasters → Sign in → **Import from Google
   Search Console** (copies verification; no tag needed). If it
   refuses, pick "HTML meta tag", copy the content value, add it on
   Vercel as `NEXT_PUBLIC_BING_VERIFICATION`, redeploy, then Verify.
2. Sitemaps → submit `https://peakmusicreviews.com/sitemap.xml`.
3. Settings → **IndexNow** → generate a key → copy it → Vercel env
   `INDEXNOW_KEY` → redeploy. Check `https://peakmusicreviews.com/<key>.txt`
   returns the key. From then on every new review/release is pinged.
4. URL Inspection → request indexing for `/`, `/about`,
   `/musicboard-alternative`, `/releases?unreleased=1`.
5. Directories, same sentence everywhere (first paragraph of llms.txt):
   AlternativeTo (alternative to Musicboard, RYM, AOTY, Letterboxd),
   Product Hunt, SaaSHub, Slant, Crunchbase, Wikidata.
6. Email achriom.com and wavemusic.app about their listicles.
