# Technical SEO for peakmusicreviews.com

Where things live: `app/sitemap.ts`, `app/robots.ts`, `app/schema.tsx`
(all JSON-LD components), per-route `generateMetadata`, root layout
(canonical `"./"`).

## 1. "Discovered – currently not indexed" (382 URLs on 2026-10-22)

Meaning: Google knows the URL and hasn't bothered to crawl it yet. Google
(John Mueller): crawl budget isn't the cause for small sites. Causes, in
order: weak internal linking, thin or near-duplicate pages, redirects.

Playbook:
1. **Internal links from pages that ARE indexed.** Release pages need
   more ways in than the paginated /releases index:
   - artist pages link to every release (now in the sitemap: a8dbb83)
   - "More from <artist>" on release pages
   - "Recently rated" / "Popular this week" blocks on the home page and
     /reviews linking to release pages
   - review pages link to their release page (check this is a plain
     crawlable `<a href>`, not a JS-only click)
   Keep important pages ≤3 clicks from the home page.
2. **Thin pages:** an unreviewed release page is basically a Spotify
   tracklist, which Google can see anywhere. Options: (a) leave it out of
   the sitemap until it has ≥1 review (sitemap = "pages I vouch for"),
   (b) add unique value (Genius description, the community average, Song
   by song scores). Don't noindex them: they win "release date" queries
   right after a release. **Discuss (a) with Luca before changing.**
3. **Redirect hops** (www/http → canonical) are expected; ignore.
4. Request indexing by hand only for a few key URLs; it doesn't scale.
5. Re-check the Pages report about two weeks after each change.

## 2. Structured data rules (Google review snippets, checked 2026-10-25)

- Supported for review snippets include **MusicPlaylist and MusicRecording
  "and their subtypes"**. **MusicAlbum is a subtype of MusicPlaylist**, so
  release pages qualify.
- **AggregateRating** needs `ratingValue` and `ratingCount` or
  `reviewCount`; recommended `bestRating` (10) and `worstRating` (0), which
  Peak Music already sets (0–10 scale). The rating **must be visible on the
  page**.
- **Review** needs `author` (Person, name <100 chars), `reviewRating`
  with `ratingValue`, and `itemReviewed` unless nested. `datePublished`
  recommended.
- Marked-up reviews must be visible on the same page, be about one specific
  item (not a list), and come from real users (not aggregated from other
  sites).
- **July 2026 addition:** "Don't include fake or undisclosed incentivized
  reviews on your page or in your structured data markup." Any future
  "review to win" promo or a reward for reviewing must be disclosed, or
  the markup must leave those reviews out. Violations can get a manual
  action.
- **Self-serving rule:** a business can't mark up reviews *of itself*.
  That's why the SoftwareApplication JSON-LD has no aggregateRating; keep
  it that way (no App Store stars in markup).
- **Lists** (`/lists/...`) are not review targets; use ItemList only.
- Validate with Google's Rich Results Test after any schema change.

## 3. Sitemap

- Static pages + published reviews + releases + artists, each capped at
  2,000. When any group nears 2,000, split into a sitemap index
  (`generateSitemaps` in Next.js).
- `lastModified` comes from `updated_at`. Make sure a new review bumps the
  release's `updated_at` (or compute the max of its reviews), so Google
  sees release pages change.
- Profiles are not in the sitemap on purpose (UGC, thin for most users).

## 4. Metadata

- Title pattern: "<Title> by <Artist> — Reviews & Ratings | Peak Music
  Reviews" (rating-led). Keep ≤60 chars where possible; the brand suffix
  can drop.
- Descriptions ≤160 chars, lead with what the searcher wants: type +
  release date + rating + N reviews + "tracklist and previews".
- Canonical = self for every page, including paginated pages.
- Open Graph image = the share card when one exists.

## 5. Core Web Vitals

- CLS: 0 since the August sprint (liquid blobs vh-anchored, lazy covers).
  **Any ad slot must reserve its height** (web-monetization skill).
- LCP: still noisy; suspect the Chakra Petch font swap repainting the H1.
  Try `font-display: optional` or preloading the font for the H1, then
  re-measure (Lighthouse via `npx lighthouse` with CHROME_PATH; the keyless
  PSI API ran out of quota before).
- Low detail mode is ON by default and keeps the GPU cost down; new
  effects need a `.low-detail` line at the end of globals.css.

## 6. Verifying a change (no test suite)

```bash
curl -s https://peakmusicreviews.com/<path> | grep -o '<script type="application/ld+json"[^>]*>[^<]*'
curl -s https://peakmusicreviews.com/sitemap.xml | grep -c "/artists/"
```
Then the Rich Results Test, then Search Console after 1–2 weeks.

## Sources

- https://developers.google.com/search/docs/appearance/structured-data/review-snippet
- https://www.positional.com/blog/discovered-currently-not-indexed
- https://www.onely.com/?p=10731
- https://library.linkbot.com/indexing-win-discovered-currently-not-indexed/
- https://ppc.land/google-bans-undisclosed-incentivized-reviews-sites-face-manual-action/
