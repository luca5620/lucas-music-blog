# Display ads on peakmusicreviews.com (website only)

Researched 2026-10-25. Network thresholds change often, so check each
network's own requirements page before applying.

## 1. The network ladder

| Stage | Network | Bar to get in (2026) | Notes |
|---|---|---|---|
| Now | **Google AdSense** | No published traffic minimum; site must be policy-clean (some say 6 months old: the domain is older) | 68% rev share on content ads. Easiest start. |
| ~1,000 sessions/mo from US/CA/UK/AU | **Journey by Mediavine** | 1,000 tier-1 sessions in 30 days; Grow script runs 30 days first | ~70% share; far better RPM than AdSense |
| ~$5,000/yr ad revenue | **Mediavine** (full) | $5K annual ad revenue (replaced the 50K-session rule); good AdSense standing | |
| ~25,000 pageviews/mo, 50%+ tier-1 | **Raptive** | 25K PV (lowered Oct 2025); domain 6+ months | |
| — | Ezoic | 250K monthly users for new sites since Feb 2026 | Closed to small sites (Incubator only) |

AdSense policy problems follow you to Mediavine, so keep AdSense clean.

## 2. Before applying to AdSense

- **Privacy policy** (app/privacy) must say: third-party vendors incl.
  Google use cookies to serve ads based on prior visits; how to opt out
  (Google Ads Settings / aboutads.info). Update the date.
- **Consent in the EEA, UK and Switzerland:** Google requires a
  **Google-certified CMP integrated with IAB TCF** to serve personalised
  ads there (since Jan 2024; Switzerland since July 2024). AdSense has a
  built-in free "Privacy & messaging" CMP; turn it on rather than adding a
  third-party banner. Without it, EEA/UK traffic gets only limited ads.
- **US state privacy laws** (California etc.): the same AdSense messaging
  tool has a US-states option ("Do not sell or share"). Turn it on.
- **ads.txt** at the domain root: Google calls it "highly recommended",
  not mandatory, but AdSense flags its absence and unauthorised sellers
  steal revenue. In Next.js: `public/ads.txt` with
  `google.com, pub-XXXXXXXXXXXXXXXX, DIRECT, f08c47fec0942fa0`.
- **User-generated content:** publishers answer for UGC on pages with ads.
  Peak Music already has report/block/moderation (built for Apple 1.2).
  Keep ads **off** pages that are mostly UGC with no moderation yet
  (e.g. brand-new comment threads), and off admin, auth and settings pages.
- **"Low value content" rejections** are common for thin sites: make sure
  the crawlable pages Google samples (home, /reviews, release pages) have
  real text (reviews, descriptions), not just covers.

## 3. Where ads may go (proposal; ask Luca before placing)

Good:
- Between feed items on /reviews and /releases (every ~8 items), styled
  as a labelled "sponsor" card in the physical-media look.
- Below the reviews on a release page.
- The bottom of long review pages, after the comments.

Never:
- Inside the rating flow, the share sheet, Aux Wars voting, release rooms,
  or the /start first-rating screen (the activation funnel that went
  21% → 67%).
- Anything that looks like a review, a rating badge, or a nav button.
- Sticky or interstitial ads on mobile web (Google's mobile interstitial
  penalty and bad UX).

## 4. Implementation notes (Next.js 16 App Router)

- One client component `components/ads/AdSlot.tsx`:
  - returns `null` when `isNativeApp()` is true (lib/native.ts). That
    check reads `window.Capacitor`, so it can't run on the server: render
    a reserved-height placeholder on the server, decide on mount. Use the
    same `useLayoutEffect` + ref trick as `BackLink` (no setState in an
    effect, which the lint rule flags).
  - **Reserves its height** (fixed min-height per slot) so loading never
    shifts layout (CLS stayed 0 after the August SEO sprint; keep it).
  - Lazy-loads when within ~1 screen of the viewport.
  - Honors Low detail mode: no animated frame effects. Any new effect
    needs a `.low-detail` line at the END of globals.css.
- Load the AdSense script once, `afterInteractive` via `next/script`, and
  only on the web.
- Don't load ads for signed-in **supporters** (a perk; see supporters.md).
- Double-check the native check on a real device build before shipping:
  if ads ever show in the app, Apple 2.5.18 applies (report-an-ad button,
  show targeting info, age-appropriate) and the EU trader question
  reopens.

## 5. Rewarded ads (later, optional)

Duolingo's newest format is opt-in: watch 30 seconds, get 30 minutes of
unlimited Energy. On the web, **Google Ad Manager** supports rewarded ads
via GPT (`rewardedSlotReady` / `rewardedSlotGranted` / `rewardedSlotClosed`;
5 seconds in view before the reward; no server-side verification on web).
It needs an Ad Manager account, not plain AdSense.

A fair Peak Music version: there's nothing gated to unlock, so a rewarded
ad would have to grant something cosmetic (e.g. a one-week profile frame).
Only worth it at much higher traffic. **Never** gate core features behind
an ad.

## 6. Measuring

- AdSense reports RPM per page type. Compare against pageviews from
  Vercel Analytics.
- Watch Core Web Vitals in Search Console for 2 weeks after launch; if
  LCP/CLS worsen, cut slots before SEO pays for it.

## Sources

- https://www.jupiter.co/blog/mediavine-requirements-2026-how-to-qualify
- https://newormedia.com/blog/best-ad-networks-for-publishers-2026/
- https://affroom.com/blog/ezoic-alternative-ad-networks/
- https://support.google.com/adsense/answer/13554020 (CMP requirement)
- https://blog.google/products/adsense/new-consent-management-platform-requirements-for-serving-ads-in-the-eea-and-uk/
- https://support.google.com/adsense/answer/12171612 (ads.txt)
- https://support.google.com/admanager/answer/9116812 (rewarded ads for web)
- https://www.emarketer.com/content/duolingo-s-rewarded-ad-efforts-ramp-up-with-new-format
