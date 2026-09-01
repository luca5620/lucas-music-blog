# PMR — Roadmap

*Updated 2026-08-18 as part of Overhaul v2 (the platform pivot).*

The vision: **a full music social platform.** Letterboxd's
review/list/profile backbone + Real's live rooms and debates, skinned
as physical media — the whole site lives inside a CRT. No personal-blog
remnants: every piece of content is community-made and catalog-backed.

---

## ⏳ In progress

### 📦 THE 1.1 PATCH — the next native build (Luca 2026-09-01)

Luca's call: **everything that needs a new binary rides in ONE build.**
No more one-off Mac trips. He is on Windows; all of this needs the
MacBook (Xcode + `npm run mobile:sync` + pod install + a new App Store
submission). Contents, as agreed:

1. **In-app Google/Apple sign-in.** Web is DONE and live (buttons
   showing as of today). The app shows nothing because Google refuses
   OAuth in an embedded webview (`disallowed_useragent`). The fix, all
   native: add `@capacitor/browser` (opens the OAuth page in
   SFSafariViewController, which Google accepts) + register the custom
   URL scheme `com.peakmusicreviews.app://` in `Info.plist` + an
   `appUrlOpen` listener (`@capacitor/app` is already installed) that
   catches the code and calls `exchangeCodeForSession` INSIDE the
   webview — the PKCE verifier lives in that webview's storage, so the
   session lands in the right cookie jar. Supabase's redirect allow-
   list needs the custom-scheme URL added too. Google never sees the
   scheme (it only knows Supabase's callback), so no Google Cloud
   change. **Luca vetoed the interim web-only experiment** (rendering
   Apple alone in the app to see if appleid.apple.com survives the
   WKWebView) — it all goes in 1.1 instead. App Store 4.8 is satisfied
   either way since both providers ship together.
2. **Push notifications** — code shipped 8f1ea78, dead until a native
   build + his APNs runbook steps.
3. **Splash / status-bar item 5** from the app-native polish backlog.
4. **Cold offline launch white-screen (5b)** — the `errorPath` fallback
   only works from a fresh binary.
5. **iOS 15 deployment-target bump.**

Sequence when we pick this up: JS/TS side first (it deploys to web
harmlessly and does nothing until the native half exists), then the
Mac session does sync + Xcode + submit once.

### 📅 TOMORROW (2026-09-02) — the backlog Luca wants ADDRESSED

His words on logging off 2026-09-01: *"all of that extra stuff we
didn't work on today i will need you to address when we work on it
tomorrow."* Raise these; don't wait to be asked:

- **Nothing from 2026-08-31 or 2026-09-01 has been eyeballed on
  device.** Comment hearts went live today (030 finally run), as did
  the Social page minus its Leaderboard, the create/search swap and
  the Your Taste rework. First job: he looks, we fix.
- **Debates changes** he's wanted for a while — no specifics ever
  given. ASK what he wants; do not pitch a redesign at him.
- **Your Taste revamp** — he said he'd brainstorm it himself and come
  with a prompt. The reverted-overhaul design law still binds
  (centered text, plain ✕, no channel/CRT gimmicks, no reason labels,
  no cover rating badge).
- **Lint-error backlog** (~11 pre-existing: setState-in-effect,
  Date.now-in-render).
- **Site-wide soft 404s** — root `app/loading.tsx` streams a 200
  before any notFound() runs. Only worked around in generateMetadata
  so far; the real fix is still open.
- **SEO leftovers**: H1 font-repaint LCP fix, JS audit, per-artist
  unreleased hubs, and the GSC query data (his hands). ⛔ Comparison
  pages stay dead — do not re-propose.
- **Google Play** still parked (no testers for the 14-day closed
  test). Don't re-pitch unless he raises it.

**Migration state: EVERY migration through 031 is applied.** Verified
2026-09-01 by anon-key REST probe against prod (025 notifications, 028
username_changed_at, 029 push_tokens, 030 comment_likes, 031
username_auto all answer). Nothing is waiting on the SQL Editor.

- **2026-09-01 — migrations 030 + 031 ARE RUN.** Verified live by
  anon-key REST probe against prod: `profiles.username_auto` answers
  (031) and `comment_likes` exists with rows in it (030). So comment
  hearts are LIVE, and the /welcome handle-picker path is armed. All
  migrations through 031 are now applied. Social-login provider setup
  done with Luca the same day: Supabase redirect URLs ✓, Apple
  Services ID + key + secret ✓ (first Apple secret expires
  **2027-02-28** — re-mint with `node scripts/apple-secret.mjs`),
  Google console in progress. Remaining: `NEXT_PUBLIC_SOCIAL_LOGIN`
  in Vercel + redeploy, which is what makes the buttons appear.

- **2026-08-31 — GOOGLE + APPLE SIGN-IN (code SHIPPED, buttons OFF
  until Luca does the provider setup).** QoL so signing up isn't a
  password + inbox-confirmation errand. What's live in the repo:
  `components/auth/OAuthButtons` on /login and /signup,
  `/auth/callback` (PKCE exchange), `/welcome` (the handle picker),
  `lib/username.ts` (the handle rules, now shared by signup +
  welcome), migration **031-social-login.sql**.
  **THREE THINGS ONLY LUCA CAN DO — all written out step by step in
  `docs/SOCIAL-LOGIN-SETUP.md`:**
  1. Google Cloud OAuth client + Apple Services ID/key → paste into
     Supabase → Authentication → Providers (~15 min for Google, ~30
     for Apple; ⚠️ Apple's secret expires every 6 months).
  2. Run **migration 031** in the SQL Editor.
  3. Set `NEXT_PUBLIC_SOCIAL_LOGIN=google,apple` in Vercel and
     redeploy — until then `OAuthButtons` renders NOTHING, so the
     live site is unchanged and no visitor can hit a dead button.
     `google` alone is fine if Apple's setup waits.
  Design notes: buttons sit ABOVE the email form with an OR divider
  (the divider lives inside the component so the app doesn't get a
  stray line); btn-y2k-outline, inline SVG logos, uppercase like
  every other button. Why /welcome exists: social providers never
  ask for a username, so 031's trigger invents one and flags
  `profiles.username_auto` — the callback sends flagged accounts to
  pick a real handle (it's in every review URL) plus tick the Terms
  box the signup form would have shown (App Store 1.2). That first
  claim is FREE — the 028 trigger doesn't start the 14-day cooldown
  when it's replacing a generated handle, and `username_auto` is
  trigger-owned so nobody can re-arm it for free renames.
  **App shows none of it on purpose**: Google refuses OAuth in
  embedded webviews (`disallowed_useragent`), so doing it in the
  shell needs the system browser + a deep link handing the session
  back — a separate job, noted in the doc.

- **2026-08-31 (Windows, post-launch round 2 — Luca's new batch,
  quick fixes SHIPPED, builds green, NOT yet eyeballed.** The fixes:
  1. **NO SIGNAL Retune actually works** — the button only reloaded
     `if (navigator.onLine)`, and WKWebView is unreliable about
     flipping that back after service returns, so the tap did
     nothing. Retune now probes the real network (HEAD to our own
     manifest, 5s timeout) and reloads on success / shows STILL NO
     SIGNAL on failure; while the overlay is up a 4s background probe
     auto-reloads the moment the connection is really back.
  2. **Debate page: ARENA / ON AIR crumb → plain "← Back"** (same
     BackLink style as release pages).
  3. **Menu press-highlight clipping fixed** — avatar dropdown + bell
     panel rows span an overflow-hidden panel, so the press RING's
     left/right edges were sliced off; rows now light up with a soft
     white wash instead (new .menu-sheet hook). PLUS: on touch
     screens every tappable now transitions the full press-property
     set (box-shadow/transform/translate/rotate/scale included), so
     press effects ease in/out instead of popping — the "choppy"
     feel.
  4. **Badge glow no longer fades into a box** — RoleBadge's
     drop-shadow was clipped to the tiny svg box; the svg now carries
     a padded viewBox (half the box is halo room) with negative
     margins so layout/spacing is unchanged.
  5. **Module caps match grid geometry** (useModuleLimit in
     ViewToggle): home Community Feed + Latest Drops show web
     detailed 10 / posters 18 / compact 10, app detailed 5 / others
     9 — no more half-empty last rows; server fetches bumped 9→18.
  6. **Rating quick-filter = buckets** — chips are now All/10s/9s…/0s
     and filter n ≤ rating ≤ n.9 (10s = perfect 10s only), replacing
     the useless "1+ shows everything" floors.
  7. **Change password is a visible button** (btn-y2k-primary — bare
     btn-y2k is transparent).
  8. **Dead review URLs redirect** — /reviews/[slug] with no review
     now 308s to /releases/[slug] when that release exists (done in
     generateMetadata too, since the root loading.tsx streams a 200
     before the body can 404). ⚠️ KNOWN ISSUE surfaced: root
     app/loading.tsx makes EVERY not-found page a soft 404 (HTTP
     200) site-wide — flagged for a future SEO pass. For the GSC
     echoes-of-silence-the-weeknd page: the release ISN'T in the
     catalog, so Luca should search/import Echoes of Silence in-app
     — the moment it exists, the old review URL 308s to it and the
     impressions land somewhere real. Deleting the URL is the wrong
     move while it still earns impressions.
  **UPDATE same day: Luca greenlit ALL FOUR proposals ("do all my
  proposals … no need for a dev server, just push it when done") —
  ALL SHIPPED to main (488dda8 comment likes, 8b07380 Social page,
  31a9943 create/search swap, e17661f Your Taste rework), builds
  green, NOT yet eyeballed anywhere. ⚠️ MIGRATION 030
  (comment_likes) NEEDS RUNNING in the SQL Editor — review-comment
  hearts hide themselves until it runs; everything else works
  without it. Implementation notes: chat reactions collapsed to one
  ❤️ per message with NO schema change (a like IS a ❤️ reaction row;
  legacy emojis stop rendering); Top Rooms ranks candidates by LIVE
  presence in an observe-only client subscription (never track() —
  see components/social/TopRooms.tsx header for the topic-sharing
  gotcha); Top Reviews This Week = review_likes.created_at since
  lastFridayEasternUtcMs() (new helper in lib/upcoming — the one
  Eastern-midnight rule); tab bar GEOMETRY untouched by the swap
  (same frozen fifths — only the middle cell's content and the
  active-color rule changed: active = white, CREATE = blue);
  the taste pager's app ambient video (taste.mp4) is RETIRED for
  per-card blurred artwork per his spec. The original specs below
  stand as the record of intent:**
  - **Friends→"Social" rename** (page + app bottom tab, web + app):
    page adds TOP ROOMS (releases with most live "people here") and
    TOP REVIEWS THIS WEEK — most likes RECEIVED this week, live,
    resetting Friday; ANY review qualifies regardless of age (an old
    House of Balloons review getting 20 likes this week ranks #1 —
    deliberately resurfaces old reviews).
  - **Reactions → universal LIKE on all comments**: remove current
    reaction sets, one like button on every comment everywhere
    (review comments can't be liked at all today); richer reactions
    may return later with better UI.
  - **App search/create swap**: magnifying-glass icon replaces the
    blue + in the header; bottom tab bar gets a blue CREATE button
    (label "create") that pops the 4-choice sheet (live-room-popup
    format). Tab icons all gray; CREATE stays blue; the ACTIVE page's
    tab highlights WHITE (not blue). ⚠️ tab bar geometry is frozen —
    this touches it, so it needs his explicit go + device pass.
  - **Your Taste rework** (preview branch + dev-server eyeball before
    push): WEB fullscreen goes horizontal — top box labels the card
    type (review/release) so text doesn't collide with the blurred
    backdrop; then the community-feed detailed-view format for
    "{user} rated this a 10"; larger artwork; wider body for long
    reviews (no scroll-in-scroll, "read full review" button if truly
    long); Spotify module widened/elongated for ALBUMS (singles stay
    current size). APP (subtler): blurred artwork background exactly
    like web, long reviews/bios shortened to fit, album Spotify
    module elongated a BIT (not the drastic web resize).

- **2026-08-31 (MacBook): LAUNCH-DAY BATCH — app is LIVE on the App
  Store; Luca's post-launch list, code complete. ✅ MIGRATIONS 028 +
  029 CONFIRMED RUN (Luca, same day) — all migrations through 029
  applied. Still pending: the NATIVE changes (push plugin,
  entitlement, "Peak Music" icon name) ship with the next build, and
  push delivery needs the docs/PUSH-NOTIFICATIONS.md runbook (APNs
  key, edge function deploy + secrets, database webhook).**
  1. **Web bell dropdown fixed** — the app-tuned innerWidth shift was
     throwing the panel way off inside the CRT shell; web now drops
     it straight under the bell, app keeps the measured shift.
  2. **App touch polish** — one press = ONE highlight (pressing a
     card no longer also lights the album cover inside it), and the
     press ring gets a 10px fallback radius via an @layer base rule
     so radius-less elements stop flashing sharp squares (real
     rounded-* utilities still win by cascade layer).
  3. **Name-change limits (migration 028)** — usernames are no longer
     permanent: once every 14 days (Instagram-style), display names
     twice per UTC day, enforced by a profiles BEFORE UPDATE trigger
     (settings write directly under RLS, so the DB is the boundary);
     settings UI mirrors it with cooldown copy and gates on the
     migration having run.
  4. **Home-screen name → "Peak Music"** — CFBundleDisplayName,
     capacitor.config appName, android strings, and PWA short_name
     (full name truncated under the icon). Ships with the next build.
  5. **Push notifications — code side DONE** (plugin installed, pods
     installed, AppDelegate forwarding, aps-environment entitlement,
     PushRegistration in layout, /api/push/register, migration 029
     push_tokens, push-fanout edge function for APNs). Human steps —
     APNs key, function deploy + secrets, database webhook, rebuild —
     are the runbook in **docs/PUSH-NOTIFICATIONS.md**. Android/FCM
     stubbed until the Play launch.
  6. **EU availability** — DSA trader declaration steps documented as
     LAUNCH-CHECKLIST section 8 (App Store Connect → Business →
     Compliance; non-trader now vs trader-with-published-contact-info
     tradeoff spelled out). Dashboard task, Luca's hands.
  7. **Marketing** — docs/MARKETING.md: ready-to-post LinkedIn launch
     draft, @peakmusicreviews Instagram plan, GSC indexing checklist
     (SEO = the priority per Luca), Meta ads parked.
  8. **App-only: text selection killed everywhere** — press-and-drag
     was selecting body text on every page (terms/about included;
     the old rule only covered buttons/links/images and left prose
     selectable on purpose — reversed per Luca: "ruins the app
     immersion"). `.native-app` now blankets user-select:none, with
     inputs/textareas/contenteditable carved back out so typing
     works. Web selection untouched. Deployed with the web push,
     so it's live in the app on next launch.
  9. **Touch polish rounds 2–3 — release listings press = the WEB
     HOVER, copied exactly (Luca's final spec after two misses).**
     Miss 1: the one-highlight rule left the outer link's ring as a
     box around artwork + name. Miss 2: an artwork-zoom-only pass
     made the poster grid worse. Final: three marker classes on the
     listing links — .release-tile (detailed cards: hover-glow's
     soft glow + scale-105 artwork zoom), .release-art (poster walls
     + DROPPING SOON rail: quiet link; posters replay .poster:hover
     lift/accent/glow with NO img zoom, rail replays its img zoom),
     .release-row (compact: hover's elevated bg). All in the
     hover:none touch section of globals.css; web hover untouched.
     After this lands, Luca is desktop-side.

  **WHERE THE REMAINING WORK RUNS (Luca is on the desktop next):**
  - 🖥️ **Desktop / any browser** — everything below EXCEPT the last
    line: run docs/PUSH-NOTIFICATIONS.md steps 2–4 (create APNs key
    at developer.apple.com, deploy push-fanout + set its secrets in
    the Supabase dashboard, create the notifications→push-fanout
    Database Webhook); LAUNCH-CHECKLIST §8 DSA declaration in App
    Store Connect; post the docs/MARKETING.md LinkedIn draft; GSC
    indexing checklist.
  - 💻 **MACBOOK ONLY (needs Xcode): the new app build.** Open
    `npm run mobile:ios`, confirm Push Notifications shows under
    Signing & Capabilities, bump the build number, Archive → upload
    → submit. This one binary ships: push support, the "Peak Music"
    icon name, and the entitlement. iOS pods for the push plugin are
    ALREADY INSTALLED on the MacBook (pod install ran 2026-08-31;
    note for reruns: CocoaPods there needs `LANG=en_US.UTF-8` or it
    crashes with a Unicode error). Everything web-side deploys from
    either machine via git push, as always.

- **2026-08-28 (Windows, round 2 — Luca's batch, all shipped through
  ac90363, builds green. ✅ MIGRATION 027 CONFIRMED RUN (Luca,
  2026-08-28 — verified via anon-key REST probe: profiles rows answer
  with hide_streaming_links=false). ALL migrations through 027 now
  applied.** The batch:
  1. **Taste fullscreen rail** (c5dfc72): heart/comments/VIEW now one
     stack in the BOTTOM-RIGHT corner, buttons 44→36px, icons
     20→16px, counts 10px.
  2. **Taste comments sheet slides** (c5dfc72): IG/TikTok slide-up on
     open, slide-down on dismiss (new sheet-up/sheet-down + dim
     keyframes in globals.css, shared with item 4).
  3. **Streaming-links privacy** (1b5764f): "Don't show these on my
     profile" checkbox in Settings → Streaming Links; links stay
     saved (stats.fm showcases keep working), visitors lose the icon
     row, owner sees it tagged "hidden from visitors". Checkbox only
     renders once migration 027 exists (unknown column would fail the
     whole settings save). NOTE: display-level only — the links stay
     in the world-readable profiles row, same as before.
  4. **Live room → slide-up sheet on phone release pages** (f7d7055):
     chat leaves the flow; slim LIVE ROOM bar above the tab bar, tap/
     slide up → half-screen sheet (countdown/artwork/Spotify preview
     stay visible above); while typing the sheet jumps to the TOP and
     fills exactly the visible area above the keyboard
     (visualViewport-tracked, the ReportButton pattern), snaps back on
     blur. Desktop xl column unchanged; reviews untouched on purpose.
     Structure: components/rooms/ReleaseRoomChat.tsx does a real
     matchMedia fork — ChatPanel must mount ONCE (per-room realtime
     topic; duplicate subscribe silently no-ops) — and portals bar+
     sheet to document.body (CRT stacking contexts trap fixed).
     ChatPanel grew variant="sheet" + onCollapse. live-sheet-* CSS
     handles app tab-bar offset vs web home-indicator inset.
  5. **App header** (ac90363): bell panel measured+shifted on open so
     it can't clip the left edge (was anchored right-0 to the bell,
     which sits left of CREATE/avatar), panel 20→19rem; bell/CREATE/
     avatar cluster sized up in the app (pills 11px/8px padding, 17px
     icons, 32px avatar) — app-only CSS, web untouched.
  **DEVICE VERDICT (same day): "everything works"** → polish round
  a855e8f per Luca: (a) half-open↔keyboard morph no longer snaps —
  sheet geometry is top+height in BOTH modes (.live-sheet-half class,
  vh fallback under dvh; keyboard mode overrides inline from
  visualViewport) so .live-sheet-panel transitions top/height/radius;
  (b) the bar FADES while the sheet slides (one motion, not two);
  (c) grab-handle tab REMOVED + all slide gestures gone — buttons
  only: up arrow on the bar opens, header chevron-down closes.
  Polish round not yet eyeballed; migration 027 still to run.
  **Follow-up 9860d1b** — Luca: open/close "kinda just pops". It
  literally didn't animate: Tailwind v4's translate-y-* utilities
  drive the CSS `translate` property, which the transition list
  (transform only) never covered. Slide moved into
  .live-sheet-panel/.live-sheet-open's own transform with a 0.42s
  iOS sheet curve; bar fade-in delayed 150ms on close. ⚠️ Repo-wide
  gotcha: transitioning Tailwind translate/rotate/scale utilities
  needs `translate`/`rotate`/`scale` in the transition property list,
  NOT `transform`. Migration 027 RUN ✓ same day (probe-verified).
  **Follow-up a6690ec** — animations approved ("look good now,
  everything works") → live rooms now count PEOPLE, not comments:
  the bar shows a live "N here" head-count (PresencePile
  onCountChange → ChatPanel onPresenceChange → bar; a second
  presence subscription was never an option — duplicate topic =
  silent no-op) and the room header's "(n)" message counter is gone
  in both variants (the presence pile carries "N here"). Comment
  counts on reviews/posts/taste rail untouched per Luca.
  **Follow-up ca3160b** — app tab bar shifted DOWN 16px (Luca: it
  hovered the full home-indicator inset up; "do it a decent amount
  now and then if its too low ill tell you to raise it back up").
  New :root --tab-bar-pad, used by the bar AND everything stacking
  on it (crt-screen padding, surf-fullscreen, live-room bar/sheet)
  so they stay flush. ✅ FINAL after several tuning rounds (through
  c87bd49, Luca: "yup all good"): --tab-bar-pad = FLAT 28px (plain
  number, no inset math), tab cells symmetric 6px padding, and
  horizontal geometry = full-width UNCAPPED equal fifths (a 76px
  cell cap was tried and reverted same day — his reference
  screenshot matched the uncapped grid; capping read "too close").
  ⚠️ STANDING RULE from him: the app's TOP section and the TAB BAR
  are both in approved spots — do NOT touch either (position, size,
  cell geometry) without his explicit ask; the approved values are
  commented in globals.css. Session close: "all changes have been
  great today".

- **2026-08-28 (Windows): ⚠️ BROADCAST OVERHAUL REVERTED per Luca's
  verdict — the /your-taste page is the pre-overhaul sliding pager
  again, whole and only.** His specifics (standing design law now):
  ONLY the sliding page — no lobby, no stats module, no EPG list, no
  channel branding/OSD indicators, no static transition, no AV/exit
  combo (plain ✕), text CENTERED, no reason labels ("critic segment"
  / "rec Nd ago" chips are gone for good), no corner rating badge on
  covers (the "{name} rated it {score}" line above the cover carries
  the score). Direction: NO more CRT-gimmick features — the site is
  going cleaner, with character coming from the liquid blobs + CD/
  chrome-disc animations. What happened in code: restored
  app/your-taste/page.tsx + components/taste/ChannelSurf.tsx from
  pre-overhaul history (minus rating badge + reason chips); DELETED
  TasteGuide, ChannelFrame, SignOffCard, SwitchboardSheet,
  CallerComposer, taste/cards/*. KEPT: lib/taste.ts engine rewrite
  (invisible mechanics — reasons still rank, silently), likeStore,
  hapticImpact, CommentsSection sheet-variant plumbing (default
  variant unchanged, which is what the pager uses), PTR fullscreen
  guard. TOP AREA: fixed-header rebuild (0c46cd6) fully reverted —
  Navigation/CRTShell/QuickAccessStrip/globals back to the scrim-era
  look Luca asked to keep — plus the one thing he actually wanted:
  content shifted UP (~12px) via `.native-app .crt-screen
  { padding-top: 4px }` (status-bar band untouched, clock stays
  clear). DEVICE CHECK PENDING: the ~12px shift amount + that the
  app name / bell no longer collide. Migration 025 CONFIRMED RUN by
  Luca 2026-08-28. Ultracode/multi-agent workflows: Luca says never
  again — don't propose them. **FOLLOW-UP (95f018b):** the revert
  exposed the old solid status-bar scrim — Luca: the top band was
  "literally black". Scrim DELETED for good: the app's top zone is
  ONE surface with the liquid flowing through; content scrolling
  under the clock is the accepted trade (soft gradient fade — never
  a solid band — if legibility ever needs help). Luca approved the
  scrim removal ("that was a good change"), then sent a screenshot
  marking the header's target height → 85c2c90: phone top padding =
  env(inset) - 12px, and the app row is collision-proof (rigid
  action cluster, title clamps 11-16px w/ ellipsis last resort,
  chevron app-hidden, tighter paddings). Height + collision fix
  APPROVED on device ("yea ok this works now") → 0f4e1f0 polish
  round per Luca: title clamp(12px,3.6vw,18px), bell restyled to
  the exact CREATE pill (neutral color), one 8px gap rhythm across
  the row, and the whole page raised in the app (.site-nav pb
  16→10 / mb 24→14 so the quick-access bar and modules come up
  together). Then per Luca same day: content raised another 10px
  (5d791e2, "seems fine"), taste pager = hero width on phones + web
  bell left of Search as a full "Alerts" pill (99f5bab), reviews
  page detailed view = the home Community Feed big-cover card
  (f722ef6), taste rail comment counter + VIEW label (e933673).
  **SESSION END (Luca logging off, feeling good about the state):**
  (a) he EVENTUALLY wants changes to DEBATES — no specifics yet,
  he'll bring them, don't pitch preemptively; (b) a Your Taste
  REVAMP is coming but HE is hitting the drawing board first — wait
  for his brainstormed prompt, and hold whatever he brings against
  his 2026-08-28 design law (sliding pager core, centered text,
  plain ✕, no channel/CRT gimmicks, no stat modules, no reason
  labels, clean covers; character = liquid blobs + CD animations;
  fullscreen-only is on his mind); (c) App Review 1.2 resubmission
  still pending — his hands: demo video + ASC reply.

- **2026-08-27 (Windows, ULTRACODE session — paused at usage limit):
  branch `taste-and-top-overhaul` (13 commits, builds green, NOT
  merged — Luca has NOT previewed anything yet).** Two work streams
  complete on the branch: (1) the "PEAK TV" /your-taste overhaul —
  Station Lobby page (masthead/signal meter/EPG/GO LIVE), new
  ChannelFrame fullscreen pager (CH OSD, static-burst snaps, color
  weather, drag-to-exit, history peeling, ±1 media windowing,
  SignOffCard/RETUNE), four program cards, Switchboard comments
  split (keyboard-safe: zero-input read sheet + ReportButton-style
  top composer), taste-engine rewrite (rotation/interleave/dedup/
  fade/honest chips, mix 12→18 in the last commit, independently
  revertible), likeStore + hapticImpact. (2) App top-area rebuild —
  ONE fixed header owns the status-bar band (scrim deleted, liquid
  restored inside it), content raised to the Dynamic Island line,
  bell/name collision fixed, strip repins under the header
  (.strip-pinned), PTR disc re-anchored. NEXT SESSION: (a) run the
  adversarial review over `git diff main...HEAD` (a review workflow
  was killed mid-run at the limit — findings NOT harvested; redo or
  review by hand), fix what's real; (b) `npm run dev` preview for
  Luca (web + device), esp. WP9 keyboard gate (composer + keyboard
  in the app = the ship-blocker test), top area on device, and
  whether swipe-down-to-exit from any card should instead go back a
  channel (spec-literal choice, flagged by the implementer); (c)
  only after Luca's device pass: merge to main (deploys apps
  instantly — App Review still pending, keep that in mind).
  **UPDATE (same day, after limit reset):** "PEAK TV" name stripped
  per Luca (masthead = YOUR TASTE, sign-off = "THE {name} CHANNEL
  SIGNS OFF"). Adversarial review COMPLETED (41 agents): 13 confirmed
  findings deduped to 8, ALL FIXED in d4bea08 (drag-to-exit CH-01-only
  guard restored — swipe-down = previous channel again; PTR disabled
  inside fullscreen; strip-drag sheet guard + style reset; Spotify
  muteEpoch remount kills cross-channel audio; chrome strip
  pointer-events-none dead-band fix; stale history markers
  neutralized; comment_count block-filtered; RETUNE keeps the resume
  session). Build green. ✅ MERGED TO MAIN + DEPLOYED at Luca's call
  (2026-08-27, "just push it") — he skipped the dev-server preview,
  so ALL device checks are still pending ON PRODUCTION: keyboard
  composer gate (the WP9 ship-blocker test), top area (liquid band /
  header under the island / bell), gesture feel (swipe-back, drag-
  to-exit, static burst), and whether the 18-item mix under-fills
  (revert c6b9a68 alone to go back to 12 if so). If anything's off
  on device: fix forward same-day, production updates the apps
  instantly and App Review is still pending.
  **⚠️ VERDICT (2026-08-27, right after the push): Luca does NOT
  like the /your-taste overhaul.** He hasn't said what specifically
  yet — conversation happens next session. DO NOT redesign or revert
  preemptively; get his specifics first. Facts for that talk:
  (a) it is LIVE on main right now; (b) the taste work is spread
  across commits 40b0225..d4bea08 interleaved with the top-area
  rebuild (0c46cd6) and review fixes touching BOTH streams
  (d4bea08), so there is no single-commit revert — the old
  ChannelSurf.tsx (pre-overhaul pager) is recoverable via
  `git show b787100~1:components/taste/ChannelSurf.tsx` and the old
  page.tsx via `git show 8659555~1:app/your-taste/page.tsx`;
  (c) the top area was NOT judged — only the taste page; (d) the
  lib/taste.ts ENGINE changes (rotation/dedup/interleave/honest
  chips) are invisible mechanics and likely keepable regardless of
  the UI verdict; likeStore/hapticImpact likewise.

- **2026-08-27 (Windows, evening polish session while waiting on
  Apple): ⚠️ MIGRATION 025 TO RUN (notifications).** Shipped, all
  verified building (through 93ca66b): (a) app status-bar scrim —
  scrolled content no longer collides with the iOS clock (Luca's
  screenshot: reviews filter chips behind the battery); (b) touch
  press feedback = accent highlight RING around the pressed element
  (replaces the opacity dim; tab-bar taps glow as a pill; card holds
  are accent rings not dark shadows); (c) reviews/releases/home card
  spacing gap-4→6; (d) PS2 Nebula +2 cloud layers +1 haze band;
  (e) pull-to-refresh in the app (chrome disc under the status bar,
  haptic at the 64px threshold, router.refresh in a transition);
  (f) review autosave to localStorage (create mode, "Draft restored"
  notice, cleared on submit); (g) site-wide image blur-up
  (ImageReveal one-shot fade+deblur on load, cached images exempt);
  (h) **IN-APP NOTIFICATIONS: bell in the header (web+app), unread
  badge, 60s poll, six events (follow, review/post/list likes,
  comment, comment reply), like/follow dedup, mark-read on open —
  DEAD until Luca pastes supabase/migrations/025-notifications.sql
  into the SQL Editor (everything degrades silently pre-migration).**
  Push notifications = post-approval Mac rebuild, rides these same
  rows + a future device-token table. Admin delete+resolve one-tap
  already existed (queue's "Delete content" resolves too). STILL
  QUEUED: lint-error backlog (~11 pre-existing setState-in-effect +
  Date.now-in-render). Luca's device checks pending: press ring,
  nebula density, status-bar fix, PTR feel.
  **Round 2 same evening (fac3eb5): Your Taste STRIPPED to the
  TUNED TO YOU pager alone — BECAUSE YOU FOLLOW + ANTICIPATED grids
  removed per Luca. Empty-state pass (reviews wall + search join
  the NO SIGNAL voice) + ShimmerLines skeletons on release-page bio
  slots. AGREED SEQUENCE: (1) ✅ these initial changes → (2) Luca
  runs ULTRACODE for the Your Taste overhaul, scope = fullscreen
  rebuild + card fidelity + mix quality + page identity (NOT the
  removed grids); he'll say what he dislikes about fullscreen →
  (3) THEN rebuild the app's TOP AREA, which Luca reports as
  colliding/broken after the bell+scrim additions ("messes with
  functionality") — he wants tweaks of his own there anyway, get
  his direction first.**

*(Session handoff between the Windows desktop and the MacBook — see
CLAUDE.md "Cross-machine workflow". Leave a dated note here when a
session ends mid-task; clear it when the work lands under Done.)*

- **2026-08-27 (Windows): App Review 1.2 rejection response — code
  complete, NO migration needed.** Apple rejected again on Guideline
  1.2 (UGC precautions). Everything they listed is now implemented:
  1. **Explicit EULA agreement at signup** — required checkbox on
     /signup naming the zero-tolerance policy; submit stays disabled
     until checked. /terms now explicitly calls itself the EULA.
  2. **Objectionable-content filter** — new `lib/content-filter.ts`
     (slurs + harassment phrases, leetspeak-normalized, word-boundary
     matched; deliberately NOT ordinary profanity). Wired into every
     text-accepting route: reviews (create+edit), comments
     (create+edit), posts (create+edit), debates, debate messages,
     room messages, lists (create+edit). Match → 400 with a
     zero-tolerance message.
  3. **Flagging** — already existed (ReportButton on all 8 content
     types → /admin/reports queue). Unchanged.
  4. **Blocking upgraded to Apple's exact wording** — blocking now
     (a) auto-files a `content_reports` row against the blocked
     profile so the developer is notified in /admin/reports, and
     (b) removes their content from feeds INSTANTLY: server-side
     filtering via new `getViewerBlockedIdSet()` in home Community
     Feed, /reviews wall, home Posts module, /posts wall + existing
     client filters (comments, debates) + NEW live-room ChatPanel
     filter; BlockButton calls router.refresh() after blocking.
  Later same-day commits (b0b7025→5378e88): EULA notice on /login
  (reviewer's demo-account path sees the terms too), ReportButton
  reworked into a multi-select reason checklist (8 guideline-1.2
  categories + Other w/ required text box; joins into the existing
  plain-text reason — no API/DB change), comments now SURFACE server
  rejections (were silently swallowed — filter message shows in a
  red notice, text kept in the box), Tuned To You feed block-filtered
  (it's a feed), signup terms links lost target=_blank (dead link in
  the tabless WKWebView). Filter scope note: slurs (hard-r only, NOT
  "nigga" — music-quoting site) + kys/kill yourself/go die; NO
  ordinary profanity, and NO per-platform (web vs app) split — one
  shared feed means one standard, loosen only by shrinking the list
  for everyone. Luca verified on device: applereview login works,
  terms/privacy reachable in app; age rating fine.
  ✅ **RESUBMITTED 2026-08-27 evening.** Luca recorded the new video
  (iPhone 16 Pro Max, iOS 26.6.1), replied in the ASC thread with
  the 4-point response + video, updated the App Review Information
  Notes (evergreen text: app summary + native features + Spotify/
  Genius licensing + demo creds + all four 1.2 precautions + account
  deletion location) and attached the new video there too (field
  takes ONE file — the new recording; old 2.1-round videos live in
  the thread history, deleted locally, that's fine). Second sweep
  same day (commits through ab610b3): lists/debates walls filtered,
  taste debate lane filtered (created_by added to select), BLOCK NOW
  UNFOLLOWS (empties Friend Activity/Popular with Friends),
  suggestions + leaderboard exclude blocked, comments surface filter
  rejections (were silent), signup terms links lost target=_blank.
  Production-verified live via fetch (signup checkbox + EULA terms
  page). WAITING on verdict — his estimate ~48-72h (their re-reviews
  run slower than initial). If rejected again: paste it, fix
  same-day. Known parked native gap: cold offline launch white-
  screen (needs Mac rebuild w/ push + iOS 15 bump, post-approval).

- **2026-08-26 (MacBook): Luca's five-item batch — code complete.
  ✅ Migrations 023 + 024 CONFIRMED APPLIED (verified live via REST
  probe 2026-08-27: leaderboard_stats() answers, is_published exists
  on posts + debates).** The batch:
  1. **Friends-tab leaderboard** — `components/friends/Leaderboard`
     (tabs: most reviews / most likes received / most lists, top 10,
     medal colors) fed by `leaderboard_stats()` from **migration
     023**; section hides itself until the migration runs. Page
     keeps the name "Friends" — Luca is still thinking about a
     rename, revisit later.
  2. **Album/Song Bio deluxe fix** — `lib/descriptions.ts` strips
     "(…deluxe…)"/"[…deluxe…]" parentheticals from titles for the
     Genius/Wikipedia lookup only (display keeps the full name), so
     Deluxe/Digital Deluxe editions pull the base album's bio.
  3. **Create-page consistency** — reviews + lists forms now use the
     same centered `max-w-2xl mx-auto` module and header style as
     posts/debates; the "NEW TRANSMISSION"/"NEW BROADCAST" vhs
     labels are removed from posts/new and debates/new.
  4. **Save as Draft everywhere** (QoL, mirrors reviews): posts and
     debates get `is_published` via **migration 024** (column +
     author-only RLS on drafts). Posts: draft button on PostForm,
     drafts land on /reviews/mine with the same Draft/Published
     badges as reviews, publish via edit. Debates: draft button on
     NewDebateForm, draft page shows an amber banner + "Open the
     floor" publish button (new `PATCH /api/debates/[debateId]`),
     plus a "Your Drafts" strip on /debates. Lists: "Save as Draft"
     saves with is_public=false (private lists already were drafts
     in all but name). All read paths degrade gracefully pre-
     migration — nothing breaks if 024 lags the deploy.
  5. **Liquid blobs, web prominence** — desktop web (md+) wash blobs
     grow ~40% (+4 filler blobs), the room around the TV grows ~25%
     (+2 blobs), both run brighter/blurrier via a min-width media
     block in globals.css ("DESKTOP PROMINENCE"). Phone web + app
     shell keep the exact approved tuning.
  Not done from the batch: nothing — the ads idea went to Next up
  as a far-future note (below), per "months down the road".

- **2026-08-26 (Windows): rating-slider ball fix + glow-up.** The
  review form's slider ran appearance:none with NO custom thumb
  styles, so the drag ball never rendered at all (Luca, on web:
  "the ball is not visible"). New .rating-slider class in
  globals.css rebuilds both vendor thumbs (::-webkit-slider-thumb +
  ::-moz-range-thumb) as a 22px glowing orb driven by
  --slider-color, and the ReviewForm passes the live rating color
  inline plus a track-fill gradient (colored up to the current
  score). Hover/active scale the orb; Firefox track made
  transparent so the fill shows. Only slider in the codebase.
  Build ✓.

- **2026-08-26 (Windows) ROUND 3 — Your Taste upgrades, Luca picked
  B/C/E/F/G from the offered list (A, the vhs-label→module-header
  swap, was NOT picked — leave those headers alone).** (B) ANTICIPATED
  posters with a future drop date wear the live amber LiveCountdown
  badge (isUpcoming from lib/upcoming — the Eastern-midnight rule);
  non-dated unreleased keeps the UNRELEASED stamp. (C) Both grids
  now carry the /releases stamp convention — AVG n.n in rating color
  / muted UNRATED — from ONE batched reviews query (avgByRelease in
  page.tsx). (E) Empty sections no longer vanish: each renders a NO
  SIGNAL panel saying why it's empty + a btn-y2k CTA (no artist
  follows → /artists; all reviewed → /releases; no release follows
  → /releases; empty pager → /releases). (F) Reason chips on grid
  posters ("◈ you follow {artist}" / "◈ on your watchlist"), same ◈
  style as the pager's chips. (G) TUNED TO YOU is full-bleed on
  phones (-mx-4 wrapper + max-sm:rounded-none/border-x-0 on the
  panel), taller (h-[75svh] uncapped; desktop keeps 70vh/640px),
  with a bouncing "SWIPE ▼" hint on the first card (sm:hidden,
  disappears once you surf). Build ✓, not yet eyeballed.

- **2026-08-26 (Windows) ROUND 2 — Luca's corrections after
  eyeballing round 1 live.** (1) Home module headers: the Countdown
  / New Releases chips are DELETED (not hidden — Luca: "get rid of
  them, just the white font with the blue dot"), and every module
  header is phone-compact now (gap-2 + text-lg + slim ViewToggle
  px-1.5 + shrink-0 View All, sm restores desktop scale) — round 1
  only hid the chips below sm, but the row was STILL ~40px wider
  than a 390px screen, which is why View All in Dropping Soon was
  "90% cut off". (2) CatalogSearch dropdown REBUILT AS IN-FLOW —
  round 1's re-measure burst was useless because WKWebView pans the
  page NATIVELY when the keyboard is up (no DOM event, rects
  unchanged) and body (not html) is the scroller, so fixed AND
  absolute portals both float free of the pan; the list drew over
  the input ("covers the entire search box"). Results now render in
  normal flow under the input (max-h-80, internal scroll), exactly
  like /search — cannot misplace, fixes every consumer (reviews,
  posts, lists, debates, SOTD, profile song, upcoming box). Portal
  machinery deleted. (3) Community avg was on /search only — Luca
  meant the REVIEW-FORM search: local catalog hits now carry
  avg_rating (one batched reviews query in searchLocal) and the
  pick list shows it labeled "community avg". (4) Verified BOTH
  MacBook migrations ARE applied (leaderboard_stats() answers,
  posts.is_published exists — probed prod REST with anon key).
  Build ✓, not yet eyeballed.

- **2026-08-26 (Windows): mobile-app polish batch (Luca's list) —
  BUILD ✓, NOT YET EYEBALLED on device.** Six changes in one push:
  (1) Home modules match the Community Feed header on phones — the
  Countdown / New Releases label-xbox chips are hidden below sm
  (they made the header row wider than the screen and dragged the
  whole page sideways: "super messy, doesn't fit"); Fresh Lists got
  the full Community Feed header (h2 + View All) too; Posts left
  alone per Luca. (2) App-only "← Back to Home" link (new
  components/ui/BackToHome.tsx) at the top of /reviews, /releases,
  /debates, /lists — the quick-access-strip pages had no way back.
  (3) /reviews compact view now shows the reviewer's little avatar
  on every row (name from sm up), same markup as the home feed's
  compact rows. (4) CatalogSearch dropdown vs the mobile keyboard:
  maxHeight now clamps to the VISUAL viewport (offsetTop + height),
  a visualViewport scroll listener was added, and a settle burst of
  delayed re-measures (80/200/350/600ms, also fired on input focus)
  tracks the keyboard slide-in — was: list sized/positioned against
  window.innerHeight, looked broken until keyboard closed+reopened.
  (5) /search release hits show the community average (per-hit
  get_release_stats RPC, max 5) labeled "COMMUNITY AVG" so a rating
  in results is never mistaken for one person's score. (6) Four
  Favorites removed from customization AND profile rendering
  (settings fieldset, showcase option, profile case all gone;
  profile_favorites data + /api/profile/favorites route left
  intact); theme presets heading is now just "Theme Presets" — the
  LimeWire/Soul Reaper/Robot Rock additions made "Vintage Consoles"
  inaccurate. Taste-page improvement OPTIONS were sent to Luca to
  pick from — nothing applied there yet.

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

### Leaderboard removed from Social (2026-09-01, Windows)
Luca: "remove the leaderboard in social, keep everything else."
Deleted `components/friends/Leaderboard.tsx` and
`lib/db/leaderboard.ts`; /social lost the import, the
`getLeaderboard(50)` fetch, the blocked-filter line and the section.
Everything else on the page stands - user search, Top Rooms, Top
Reviews This Week, Popular With Friends, Recent Activity, Find People.
The `leaderboard_stats()` function from migration 023 is left in the
DB (harmless, nothing calls it). Build + tsc clean.


### Review save failing — slug bugs, TWO of them (2026-08-28, Windows)
Luca hit "Failed to create review." saving a draft. REAL cause (found
by querying prod): `catalog_import_release` (006) appends a RAW
mixed-case spotify-id tail on slug collisions — his BBTM copy got slug
`beauty-behind-the-madness-the-weeknd-GL7s` — and the review slug
inherits it, failing 005's lowercase-only `chk_reviews_slug_format`.
Also latent: the API cut slugs at 140 while the check caps at 120.
Fixed: `uniqueReviewSlug` now normalizes the whole base (lowercase +
strip + cap 116, 43e4237 + follow-up), `createReview` logs the real
Supabase error to Vercel logs, and migration 026 (catalog function
lowercases its suffixes + repairs already-minted uppercase slugs) —
**026 CONFIRMED RUN by Luca 2026-08-28**. Open thread: BBTM exists as
TWO catalog rows (two Spotify editions, by design) — Luca hasn't said
whether he wants the extra row gone. He logged off to restart with
MORE CHANGES planned, unspecified — he'll bring them next session.
Casualty: Luca's draft text was lost — the save kept failing, and the
localStorage backup got discarded by accident before the fix landed.

### App-only "check out our website" plug on home (2026-08-26, MacBook)
End of the home scroll (both splash and dashboard), `.app-only`, OSD
styling: "For a better experience, check out our website" +
peakmusicreviews.com. Luca's community-building nudge — the big
screen is where sit-down reviews get written. Not a link on purpose:
the shell IS the site, tapping would just reload the page.

### Spotify player on Your Taste cards (2026-08-26, MacBook)
The release page's Spotify embed comes to TUNED TO YOU: fullscreen
review + release cards mount Spotify's compact player (152px, dark)
automatically while the card is on screen — no tap-to-load pill
(Luca: the embed has its own play button, a pill first is a double
press). An IntersectionObserver unmounts it as the card swipes away
and remounts on return, so audio never bleeds between channels;
verified by Luca. URLs that don't map to a track/album embed keep
the external link. Poster grids stay plain links — their release
pages carry the full-size embed.

### Dropping Soon on the logged-out splash (2026-08-26, MacBook)
Guests now see the DROPPING SOON countdown module on the splash
(between the feature cards and the review feed) — same three views,
same live clocks, linking to the release pages / live rooms. The
paste-a-Spotify-link box is signed-in only (`canAdd` prop through
UpcomingDrops → UpcomingDropsClient); with no upcoming items a guest
sees nothing rather than an empty header.

### Admin email-code login — WORKING END TO END (2026-08-26, MacBook)
Luca added `{{ .Token }}` to the Magic Link template, then we fixed
why typing the code failed while the emailed link worked: this
Supabase project sends **8-digit** codes (dashboard OTP-length
setting) and the input's `maxLength={6}` silently ate the last two
digits. Input now accepts 6–10 digits, the email is lowercased before
issue/verify (codes hash code+email; links don't care), and the
staff-only code screen shows Supabase's real rejection reason.
**Verified live by Luca ("ok it works").** The whole staff flow —
password → emailed code → aal enforcement in middleware, /api/admin,
and Postgres (migration 021) — is now confirmed working.

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
**🎉 iOS APP IS LIVE ON THE APP STORE (Luca confirmed 2026-08-31).**
Every push to `main` now updates what App Store users see instantly —
the "treat every push as production" rule in CLAUDE.md is no longer
theoretical. Still open from this item: Google Play (closed test's
14-day clock → production), and push notifications.

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

### 6. Muted ads, WEB ONLY (Luca 2026-08-26 — months down the road)
Once the userbase is bigger and usage is consistent: small, muted ad
slots at the bottom and side of the WEBSITE only — never the apps
(app-store ad SDKs are their own compliance world, and the CRT shell
should stay clean there). Not in-your-face by design: think a dim
"sponsored" VHS label in the room's side bars, matching the physical-
media skin. Revenue trickle, not a business model. Do not start until
Luca calls it.
