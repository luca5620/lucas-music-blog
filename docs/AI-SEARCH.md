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
