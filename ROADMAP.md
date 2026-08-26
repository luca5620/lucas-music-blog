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

- **2026-08-26 SESSION CLOSE — ENTIRE upcoming-releases batch
  VERIFIED LIVE by Luca ("all works and looks great" → "all looks
  good").** Everything below dated 2026-08-25/26 about upcoming
  albums, countdowns, the home DROPPING SOON module, the 3-column
  release page, Spotify embeds, and the flush bottom band is
  eyeballed and approved on prod. Late additions in the final
  round: preview box self-stretches to exactly match the live-room
  box height at xl (universal, every release page), and review
  pages got a "Song Review" / "Album Review" glow-orb heading above
  the body (mirrors the Song/Album Bio heading; plain "Review" for
  old rows with no release_type). Nothing left in-flight from this
  feature; next session starts clean.

- **2026-08-26 (Windows): release page flush bottom + bio band.**
  Desktop release page rework (Luca's asks): the reviews+followers
  band now spans ALL THREE columns (full page width) instead of
  stopping under column 2; the chat column fills just row 1 (h-full,
  no more sticky/row-span — its bottom edge lines up flush with the
  other columns); and the Genius/Wikipedia description LEAVES the
  narrow left column on xl and runs horizontally across the full-
  width band above Community Reviews (phone keeps it in the left-
  column spot; the lookup is cached so the dual render is free).
  The description also gained a labeled header everywhere: "Song
  Bio" for singles, "Album Bio" for everything else (glow-orb +
  label-xbox style). Follow-up same session: preview box now
  self-stretches at xl (flex column + iframe flex-1) so it's always
  EXACTLY as tall as the live room box beside it, on every release
  page; phones keep fixed 550/152 player heights. Build ✓.

- **2026-08-26 (Windows): DROPPING SOON header + view switcher.**
  The home module's header now matches the other modules exactly
  (label-xbox "Countdown" tag + font-heading "Dropping Soon" title +
  divider + View All → /releases) instead of the vhs-label style,
  and it gets the same ViewToggle as Latest Drops / Community Feed —
  detailed / posters / compact, sharing the sitewide persisted view
  preference. All three views keep the live-ticking amber clock
  (custom countdown flavors of ReleaseViews' layouts — no UNRATED
  stamps on albums that can't have reviews yet). Split into
  UpcomingDrops (server fetch) + UpcomingDropsClient. Build ✓.

- **2026-08-26 (Windows): upcoming-albums round 3 (Luca's asks,
  after eyeballing round 2 live — "all works and looks great").**
  (1) Spotify embed now REPLACES the Tracks card whenever the
  release has a spotify_id (it repeated the tracklist twice); the
  hand-rolled list survives only for Genius-only imports. (2) THE
  TIMEZONE RULE: countdowns were 4h ahead — music drops at MIDNIGHT
  EASTERN, so lib/upcoming.ts now anchors everything to 00:00
  America/New_York via easternMidnightUtcMs (DST-proof, tested both
  boundaries); LiveCountdown + isUpcoming/daysUntil +
  listUpcomingReleases all run through it — any future drop-time
  feature MUST use these helpers, never raw UTC date math. (3) Web
  release page is now a 3-column xl grid: identity | preview +
  reviews | LIVE CHAT as its own column spanning both rows, sticky
  + viewport-height so it rides down the whole right side; enabled
  by .release-unclip (panel overflow:visible at xl only — sticky
  dies inside overflow:hidden; LiquidAtmosphere self-clips so
  nothing leaks) and the page wrapper switching to overflow-x-clip.
  Phones stack exactly as before. (4) "The live room is already
  open" banner text removed. (5) Review page: "View release page +
  all reviews" is now a real boxed btn-y2k button. Build ✓; NO
  migration. Eyeball: desktop release page (chat column + sticky
  behavior + short-reviews case), phone release page unchanged,
  clocks now agree with Spotify's own countdown.

- **2026-08-26 (Windows): upcoming-albums round 2 (Luca's asks).**
  (1) HOME gets a "DROPPING SOON" module right below the community
  feed (UpcomingDrops + UpcomingDropBox): countdown shelf with LIVE
  ticking DD HH:MM:SS clocks + a paste slot that accepts ONLY
  Spotify album links and ONLY albums not yet out — released albums
  get turned away with a "find it through search" message; success
  jumps straight to the new release page/room. (2) The /search "Add
  to the station" box is REMOVED (AddToCatalog.tsx deleted) — the
  home module replaces it. (3) LiveCountdown.tsx: hydration-safe
  ticking clock to midnight-UTC of release day, flips to OUT NOW at
  zero; also live in the release-page banner and the /releases rail
  stamps. (4) Spotify EMBED player tried out: SpotifyEmbed.tsx on
  release pages (under Tracks) — official open.spotify.com/embed
  iframe, 30s previews streamed by Spotify (album player, or track
  player for single-track imports); CSP frame-src now allows
  open.spotify.com (next.config.ts). Build ✓; NO migration. Not yet
  human-eyeballed: paste the Ellie link on HOME, watch the clock
  tick, and check how the embed looks (esp. on a not-yet-released
  album — Spotify may show a disabled/pre-save card there).

- **2026-08-25 night (Windows): UPCOMING ALBUMS + countdown rooms
  (Luca's ask — the "live chatroom before the album drops" selling
  point).** Spotify search HIDES pre-release albums, but GET
  /albums/{id} returns them in full (verified against Ellie
  Goulding's "I Know Too Much", drops 2026-09-04, all 10 tracks +
  cover + future date) — so the door in is PASTING THE SPOTIFY LINK.
  Shipped: (1) lib/catalog.ts parseSpotifyLink — album/track/URI
  links (intl paths, ?si= junk) resolve directly in catalog search;
  /prerelease/ countdown links get an explanatory notice (their ids
  aren't in the public API — copy the album link off the artist
  page instead). (2) CatalogSearch: notice line, amber DROPS SOON
  badge, placeholder now teaches "or paste a Spotify link".
  (3) /search page: new "Add to the station" box (AddToCatalog) —
  logged-in users import anything and land straight on its page,
  no review required; the room auto-opens with the page
  (getOrCreateRoom already did this). (4) /releases: "Dropping
  Soon" amber rail (DroppingSoonRail + listUpcomingReleases),
  soonest first, D–x countdown stamps. (5) Release page: amber
  countdown banner ("Dropping in N days — the live room is already
  open") + "Drops {date}" instead of "Released"; ReleaseCard shows
  D–x instead of year. All countdown UI self-clears on release day
  (lib/upcoming.ts compares date strings, UTC). Build ✓; NO
  migration (RPC already accepts future dates). NOT yet clicked
  through by a human — Luca: log in, paste the Ellie link into
  /search's add box, confirm the page + room + rail appear.

- **2026-08-25 (Windows): home/friends cleanup (Luca's ask).** The
  "WHO YOU FOLLOW" ticker is REMOVED from the home dashboard — the
  Friends tab already carries the richer full feed, so home no longer
  fetches friend activity at all (app/page.tsx). And in the Friends
  tab, the "Popular With Friends" covers now LINK to their release
  page: getPopularWithFriends joins releases(slug) and each poster
  renders as a Link to /releases/[slug] (old reviews that predate
  release_id fall back to the unlinked poster). Build ✓; no migration.

- **2026-08-25 night (Windows): descriptions transient-failure bug
  FIXED + VERIFIED LIVE (b92a42f).** Graduation (Kanye West) showed
  no description though Genius+Wikipedia both have one: a cold
  Genius call once blew the 2.5s timeout, the resolver returned
  null, and unstable_cache froze that null for 30 days. Fix in
  lib/descriptions.ts, all paths (albums, singles/songs, Genius
  imports, Wikipedia): LookupCtx marks transient failures (timeout/
  network/5xx/429 — other 4xx stay definitive), a transient-failure
  null now THROWS inside the cached fn so nothing is stored and the
  next visit retries; timeout 2.5s→4s; cache key v3→v4 flushed every
  frozen null (stuck releases/songs heal on next page view).
  Verified on prod: Graduation page now renders the Genius blurb.

- **2026-08-25 night (Windows): non-Latin catalog-import crash
  FIXED.** Luca hit "Couldn't import that release" on a Japanese
  release (artist 阿保剛): slugify() empties on fully non-Latin
  names, the fallback slug embedded a MIXED-CASE Spotify id
  (`artist-lyaLqV`), and catalog_import_release's lowercase-only
  slug regex rejected it — so EVERY release whose artist/title is
  entirely non-Latin script failed to import. Fix: all id-derived
  fallback slugs are lowercased (lib/catalog.ts ×4 +
  lib/spotify-import.ts resolve helpers). Genius ids are numeric,
  already safe. No migration needed. Luca should re-click a
  Japanese result to confirm after deploy.

- **2026-08-25 night (Windows): PS2 "Nebula" profile theme** (Luca's
  ask: "galaxy cloud/nebula like the console intro"). New `ps2` theme:
  silvery-indigo accents, blue+violet nebula clouds + haze sweep +
  silver dust backdrop (bd-ps2-* in globals.css, wired into
  ThemeBackdrop/ThemeLiquidSync/settings picker/profile maps, both
  perf lists so it pauses like every backdrop). Migration 022 RUN ✓
  (Luca, 2026-08-25 — ALL migrations through 022 now applied). A
  public/backdrops/ps2.webm video loop can be added later —
  BackdropVideo picks it up automatically. Same night: the non-Latin
  import fix CONFIRMED WORKING by Luca, and "Standout Tracks"
  renamed to "Personal Favorites" (display labels + API error copy
  only; the standout_tracks column/field name stays).

- **2026-08-25 evening (Windows): app polish + immersion batch, all
  verified by Luca on device where applicable.** Thermal saga
  RESOLVED (3 rounds; round 3 structural — phone atmosphere is a
  designed still, no blur layers/full-screen overlays; Luca: "barely
  even gets warm... smoother than before"). Your Taste app pager got
  a hardware-decoded ambient video loop (public/backdrops/taste.mp4,
  ffmpeg-rendered seamless 24s, 1.2MB; per-card CSS blur covers off
  in app). App flush top (screen border/vignette/bloom off in shell),
  tab bar recentered on equal fifths + slimmed 64→52px. NEW:
  CoverLiquidSync — release/review pages recolor the site liquid to
  the album cover's palette (canvas sampling, saturation-boosted;
  Genius-hosted covers may fail soft to defaults). If Luca wants
  more: same treatment per-card in the fullscreen pager; video loops
  for profile theme backdrops (slots already exist).

- **2026-08-25: Sentry is LIVE and verified end-to-end** — DSN in
  Vercel, server + browser (tunnel) delivery both confirmed with test
  events on prod, temp test route removed. Org `peak-music-reviews`,
  project `javascript-nextjs`. Luca: resolve/delete the leftover test
  issues in the Sentry feed (SENTRY TEST A/B, TUNNEL TEST, and the
  `views.js updateFrom` one — that last one is Sentry's own sample,
  not a real bug). Still optional later: SENTRY_AUTH_TOKEN + org/
  project env vars in Vercel for readable stack traces.

- **2026-08-25 (Windows, later): Sentry error tracking wired in**
  (@sentry/nextjs; errors-only, no tracing/replay, PII off, disabled
  in dev, browser reports tunneled through /monitoring so CSP and
  ad-blockers are non-issues; app/global-error.tsx = branded SIGNAL
  LOST crash screen). Sentry account CREATED by Luca 2026-08-25: org
  `peak-music-reviews`, project `javascript-nextjs` (skip the wizard —
  manual setup is already in the repo). **Luca's one remaining step:**
  Vercel → project → Settings → Environment Variables → add
  `NEXT_PUBLIC_SENTRY_DSN` = the DSN from the Sentry project page
  (all environments) → redeploy. Optional later, for readable stack
  traces: Sentry → Settings → Auth Tokens → create org token → add to
  Vercel as `SENTRY_AUTH_TOKEN` plus `SENTRY_ORG=peak-music-reviews`
  + `SENTRY_PROJECT=javascript-nextjs`. Vercel Web Analytics: Luca flipped the
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
  author) + Luca clicked Validate Fix. **Comparison-page play is
  OVER per Luca 2026-08-25**: a /letterboxd-for-music page was built
  that night and he had it REMOVED same night ("you didnt need to
  make that one"), and the "rateyourmusic alternative" page is cut
  too — /musicboard-alternative stays, but do NOT build or re-pitch
  further comparison landing pages. Kept from that work: App Store
  URL/auto-flip logic extracted to lib/app-store.ts (shared by home
  badge + musicboard page). Remaining content play: per-artist
  unreleased hubs. Musicboard importer: promised NOTHING (no public
  export exists) — build only if switchers ask via contact email.

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
