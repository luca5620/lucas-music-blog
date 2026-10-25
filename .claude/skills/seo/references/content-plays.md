# Content plays: what to rank for next

The wedge (Strategy, 2026-09-02): **unreleased music**, plus release-day
speed. Head terms are years away; long-tail with unique data is now.

## 1. The scaled-content-abuse line (Google spam policy, revised Aug 2026)

Google targets "many pages made mainly to manipulate rankings", however
they're produced: AI pages without added value, scraped or stitched
content, swap-a-keyword templates. No page-count threshold. The March
2026 crackdown reportedly cut thin templated sites 50–90%. What survives:
pages with **proprietary data or real utility**, fewer and denser.

**Peak Music's test for any new page type:** does each page show data a
searcher can't get anywhere else? Community ratings, Song by song scores,
real reviews, the unreleased catalogue = yes. A Spotify tracklist alone =
no. Set a minimum (e.g. a chart needs ≥5 rated albums, each with ≥2
ratings) and don't publish below it.

## 2. Plays, ranked (all need Luca's OK before building)

1. **Release pages, fast.** They already win "release date" and
   "tracklist" queries. Make sure every big release gets a page
   *before* release day (upcoming releases: midnight Eastern via
   lib/upcoming.ts) and gets internal links from the home page. Tracklist
   JSON-LD shipped 2026-10-25.
2. **Per-artist unreleased hubs** ("<artist> unreleased songs", e.g.
   Carti, Juice WRLD): the vault reframe from 2026-09-05. Genius metadata
   + community ratings, never file links. Unique and on-wedge. The highest
   long-term upside.
3. **"<Artist> albums ranked"** on artist pages: the discography ordered
   by community average, only for albums with ≥2 ratings. AOTY's traffic
   engine. Ranks as the artist page itself (no new URL needed at first).
4. **"Best albums of 2026" by Peak Music users** (/charts/2026): only
   once there are enough ratings to be credible (say ≥30 albums with ≥3
   ratings). Year-end timing (December) also feeds the Rewind idea.
5. **Genre and decade charts:** later; same thresholds.

Already covered or off the table: comparison pages (only
/musicboard-alternative), "Letterboxd for music" (removed).

## 3. Writing for search without sounding like SEO

- Answer-first: the first sentence states the fact the searcher wants
  ("How To Quit Smoking is Dominic Fike's album, released October 9,
  2026. Peak Music users rate it 7/10 from 1 review.").
- Use the words people search ("release date", "tracklist", "unreleased",
  "ranked", "rating"), in sentence case, in Luca's laid-back voice.
- Real numbers with their N ("from 12 ratings").
- Dates in full.

## 4. AI search (AI Overviews, ChatGPT, Perplexity)

- Being **cited** matters more than rank: cited pages reportedly get ~35%
  more clicks than a plain #1. AI answers pull from clear, factual,
  structured pages and from forums (Reddit/Quora are heavily cited).
- What helps: JSON-LD that matches the visible page (done for releases,
  reviews, artists), answer-first summaries, consistent entity names
  ("Peak Music Reviews" / "Peak Music"), an About page saying what the
  site is, and organic mentions on Reddit and music forums (the
  r/peakmusicreviewsapp community; no link spam).
- `docs/AI-SEARCH.md` has the earlier AI-search work; read it before
  changing robots rules for AI crawlers.

## 5. Off-site signals that are actually reachable

- **YouTube music reviewers** (Luca's preferred channel): if they try it
  and like it, a link in a video description is a strong, relevant link.
- Musicboard-refugee and leak/unreleased communities: real mentions.
- App Store listing → website link (already there).
- No paid links, no link farms, no "guest post" schemes.

## Sources

- https://ppc.land/scaled-content-abuse/
- https://alexcloudstar.com/blog/programmatic-seo-2026-indie-hackers/
- https://www.relevantaudience.com/seo/google-core-update-may-2026-what-you-need-to-know/
- https://emarketed.com/seo/google-march-2026-core-update-ai-overviews-agency-guide/
- https://www.seo-kreativ.de/en/blog/google-ai-overviews-updates-2026-en/
- https://www.albumoftheyear.org/ratings/6-highest-rated/2026/1 (chart
  format reference)
