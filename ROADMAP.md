# PMR — Roadmap

*Updated 2026-08-18 as part of Overhaul v2 (the platform pivot).*

The vision: **a full music social platform.** Letterboxd's
review/list/profile backbone + Real's live rooms and debates, skinned
as physical media — the whole site lives inside a CRT. No personal-blog
remnants: every piece of content is community-made and catalog-backed.

---

## ⏳ In progress

*(Session handoff between the Windows desktop and the MacBook — see
CLAUDE.md "Cross-machine workflow". Leave a dated note here when a
session ends mid-task; clear it when the work lands under Done.)*

- **2026-08-25 (Windows, later): Sentry error tracking wired in**
  (@sentry/nextjs; errors-only, no tracing/replay, PII off, disabled
  in dev, browser reports tunneled through /monitoring so CSP and
  ad-blockers are non-issues; app/global-error.tsx = branded SIGNAL
  LOST crash screen). Dormant until the DSN exists. **Luca's hands:**
  (1) sentry.io → sign up free → Create Project → platform Next.js →
  name it peak-music-reviews; (2) copy the DSN it shows; (3) Vercel →
  project → Settings → Environment Variables → add
  `NEXT_PUBLIC_SENTRY_DSN` = that DSN (all environments) → redeploy.
  Optional later, for readable stack traces: Sentry → Settings → Auth
  Tokens → create org token → add to Vercel as `SENTRY_AUTH_TOKEN`
  plus `SENTRY_ORG` (org slug) + `SENTRY_PROJECT`
  (peak-music-reviews). Vercel Web Analytics: Luca flipped the
  dashboard toggle same day and the required `<Analytics />` component
  is now in app/layout.tsx (the toggle alone records nothing on
  Next.js) — page views flow as soon as this deploys, nothing else to
  do there.

- **2026-08-25 (Windows):** Shipped three things — (1) **Admin
  email-code login**: staff accounts (role admin/owner) now sign in
  password → emailed 6-digit code; enforced in middleware, in the
  /api/admin routes, and in Postgres via **migration 021** (NOT YET
  RUN — see below). (2) **Thermal mode**: phones + app shell freeze
  the in-screen liquid wash, park the 3 biggest bezel blobs, and swap
  panel backdrop-blur for solid smoke — the iPhone was cooking
  ~29 always-animating blurred layers at 120Hz. Desktop unchanged.
  (3) **OSD green → classic blue** everywhere (.osd-text, TUNING…/NO
  SIGNAL, Spotify badge, "username free", preview/video-detected,
  offline overlay).
  Migration 021 RUN ✓ (Luca, 2026-08-25). Spotify badge returned to
  brand-green same day (the recolor skips it on purpose).
  **Still Luca's hands:** Supabase dashboard → Auth → Email
  Templates → "Magic Link": add `{{ .Token }}` so the mail carries
  the 6-digit code (until then the emailed LINK still signs you in —
  no lockout). Existing signed-in staff sessions are password-only,
  so /admin bounces to re-login once — that's the feature working.
  Email goes out via Resend SMTP (already live), so no send-quota
  worry.

- **2026-08-24 (MacBook):** CocoaPods + push auth set up on the Mac;
  CLAUDE.md created. Touch feedback (TOUCH FEEL in globals.css) and
  inline App Store badge on both home variants shipped. Next: continue
  App Store launch week (item 1 below).

- **2026-08-24 (Windows, SEO sprint):** Working through
  `peakmusicreviews-seo-ux-handoff.md` (expert audit, repo root).
  Audit Task 1 (unique titles) was ALREADY live — audit stale there.
  Shipped + verified live: MusicAlbum JSON-LD with aggregateRating +
  top-5 Review objects on /releases/[slug] (star snippets), MusicGroup
  + breadcrumbs on /artists/[slug], rating-led ≤160-char meta
  descriptions, "Reviews & Ratings" title pattern. Perf (Task 2):
  baseline mobile Lighthouse 69/LCP 18.3s/CLS 0→0.68 (flaky);
  shipped lazy-loading on all feed covers+avatars (-1.2MB) and
  vh-anchored liquid blobs (CLS now 0 flat). LCP still 7-14s
  simulated: the H1 repaints ~2.3s in (font swap?) and 2.4MB of
  near-viewport covers still load — next levers: investigate the
  crt-title repaint, serve Spotify 300px covers (swap
  ab67616d0000b273→ab67616d00001e02 in small contexts), audit JS.
  GSC: already verified months ago (Luca) — use its Performance →
  queries report for page-2 keywords. Keyword/competitor research
  DONE 2026-08-24 (agent run): headline finding = Musicboard is
  collapsing (TechCrunch 2026-02-09: outages, Android app pulled,
  founders gone, no iOS update since May 2025) — displaced community
  looking for a home. Top plays: /musicboard-alternative comparison
  page + import guide, "letterboxd for music"/"rateyourmusic
  alternative" comparison pages (weak SERPs), per-artist unreleased
  discography pages (metadata+ratings only, never files), later
  /best-albums/{year} + "{artist} albums ranked" templates. ASO:
  rename listing to "Peak Music: Rate & Review Albums" (not "Music
  Reviewing"), keyword field incl. musicboard,rateyourmusic,aoty.
  Sitemap index split as content grows (Task 3).
  SHIPPED 2026-08-24 late: /musicboard-alternative live (answer-first
  copy, comparison table, FAQPage schema, footer link + sitemap
  entry) — GSC review-snippet criticals fixed (ItemList Review
  author) + Luca clicked Validate Fix. Next content plays, in order:
  "letterboxd for music" comparison page, "rateyourmusic
  alternative" page, per-artist unreleased hubs. Musicboard
  importer: promised NOTHING (no public export exists) — build only
  if switchers ask via contact email.

---

## 📌 Parked — future rebrand (do NOT start until Luca says go)

*Decided 2026-08-24, waiting until it "feels ready."*

- New name: **Peak Music** — used almost everywhere (site title, in-app
  branding, most copy).
- App Store **listing** name keeps the colon: **"Peak Music: Music
  Reviewing"** (discoverability subtitle baked into the name).
- Home-screen app name (under the icon): just **"Peak Music"** so it
  fits without truncating.

---

## ✅ Done

### Phases 1–2 (2025 → 2026-08-08)
Personal blog era → release-first platform: reviews, artists/releases
schema, follows, live release rooms (chat, track reactions, presence),
lists, four favorites, security hardening (RLS fixes, rate limiting,
validation, CSP).

### Overhaul v2 (2026-08-18) — the platform pivot
- **Teardown:** diary removed; all hand-typed content paths removed
  (no more cover-URL fields); personal analytics/now-playing/bg-music
  gone; full content wipe (migration 006) keeping accounts + badges.
- **Catalog:** unified Spotify + Genius search; releases import on
  demand via an insert-only SQL function; unreleased/leaked tracks
  supported with UNRELEASED tags.
- **Design v4 "physical media":** CRT TV shell, aperture grille,
  animated grain, vsync band, VHS labels, OSD text, six themes.
- **Profiles, Steam-level:** themes, arrangeable showcases, avatar +
  banner uploads, pronouns/location/tagline, featured review.
- **Debates:** two-sided rooms with votes + live side-badged chat.
- **Your Taste v1:** For You page from follows + review history.
- **Auth:** email confirmation required, unique well-formed usernames.
- **Mobile:** PWA manifest + Capacitor iOS/Android shells committed
  (`docs/MACBOOK-IOS-SETUP.md`).

---

## 🔨 Next up (priority order)

### 1. App Store launch week
Apple Developer enrollment → sign in Xcode on the MacBook → TestFlight
→ App Store review. Google Play closed test (14-day clock) in parallel.
Then: push notifications (also the strongest guard against an Apple
4.2 "web wrapper" rejection).

### 2. Live layer v2
Scheduled listening parties for release dates (waiting rooms on
anticipated albums), debate discovery on release pages, weekly featured
debate.

### 3. Predictions + karma (the Real layer, gamified)
Predict an album's community rating before release day; earn karma;
leaderboards. Karma later gates perks (host debates, custom flair).

### 4. Your Taste v2
Real recommendation signals: co-review similarity, taste-match scores
between users ("92% compatible"), genre drift over time.

### 5. Growth guardrails
Upstash rate limiting (replace in-memory), Resend SMTP for auth email,
moderation tools (report queue, mute), phone 2FA for feature gates when
scale demands it.
