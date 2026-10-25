---
name: seo
description: Search playbook for peakmusicreviews.com — current Search Console state, what Google's 2026 core updates and AI Overviews reward, structured-data rules for reviews (MusicAlbum/Review/AggregateRating, the July 2026 fake-review rule), fixing "Discovered – currently not indexed", safe programmatic pages (best-of-year, artist ranked, unreleased hubs) under the scaled-content-abuse policy, and how to measure. Use this skill whenever the task touches Google ranking, indexing, sitemaps, canonicals, meta titles/descriptions, JSON-LD, page speed / Core Web Vitals, AI search visibility, new landing or hub pages, or reading Search Console — even if the user just says "more traffic".
---

# SEO — the Peak Music playbook

## Where things stand (update this block when numbers change)

- **Search Console** lives on Luca's *second* Google account in Chrome:
  `https://search.google.com/u/1/search-console/...?resource_id=sc-domain%3Apeakmusicreviews.com`
  (tables switch with `&breakdown=page|date|country|device`).
- 2026-10-22 (90 days): 135 clicks, 4.71K impressions, 2.9% CTR; weekly
  impressions ~150 → 1,353; avg position ~48 → ~8.5. Mobile does better
  than desktop. US, then UK, France, Canada.
- **What wins:** brand queries (home), /musicboard-alternative,
  **release pages for "release date" / "tracklist" queries** (e.g. Dominic
  Fike's How To Quit Smoking: 744 impressions). Head terms ("music
  reviews", "album ratings") sit at 50–80 and are out of reach for now.
- **Indexing:** 159 indexed, 382 "Discovered – currently not indexed"
  (275 releases, 105 reviews). Sitemap resubmitted + indexing requested
  2026-10-22; **re-check the Pages report ~2026-11-05.**
- Shipped: MusicAlbum + aggregateRating + top-5 Review JSON-LD on release
  pages (Aug); Review JSON-LD on review pages; MusicGroup + breadcrumbs on
  artists; canonical fixes (f71bd7f); /reviews pagination (fba9cae);
  release meta descriptions lead with type + date (078e321); **tracklist
  (numTracks + MusicRecording ItemList) in release JSON-LD and all artist
  pages in sitemap.xml (a8dbb83, 2026-10-25)**.
- Perf: mobile Lighthouse ~66, CLS 0; LCP noisy (H1 font-swap repaint
  suspected; still open).

## How to use this skill

| Task | Read |
|---|---|
| A technical fix: indexing, sitemap, canonicals, JSON-LD, speed | `references/technical.md` |
| A new page type or content play (hubs, charts, ranked lists, unreleased) | `references/content-plays.md` |
| AI Overviews / ChatGPT / Perplexity visibility | `references/content-plays.md` § AI search |

## Rules (Luca's)

- **No more comparison landing pages.** /musicboard-alternative stays;
  /letterboxd-for-music was built and removed the same night.
- **Never claim a competitor is dead** on any page.
- Unreleased music = metadata and ratings **only**, never file links.
- Discuss before changing release-page copy or building a new page type.
- Descriptions come from **Genius or nothing** (description-sourcing
  memory).
- Verify an audit's claim with curl/Lighthouse before acting on it (the
  August expert audit was partly stale).
- Some pages are English-only on purpose (languages memory); don't add
  hreflang for pages that aren't translated.

## The 2026 picture in four lines

1. Core updates (March, May, August 2026) hit interchangeable middlemen
   (aggregators, directories, comparison sites) and thin AI pages; they
   rewarded official sources, specialists, and **original first-hand
   content**. Real user reviews and ratings are exactly that, so lean in.
2. AI Overviews take a big share of clicks on informational queries, but
   pages *cited* inside them get more clicks than plain #1 results.
   Clear, factual, structured pages (release date, tracklist, average
   rating, N reviews) are what gets cited.
3. Programmatic pages are fine **only with unique data per page**. Peak
   Music's ratings are unique data; empty templates are not.
4. Small sites aren't limited by crawl budget. "Discovered, not indexed"
   is fixed with **internal links from indexed pages and better content**,
   not by resubmitting.
