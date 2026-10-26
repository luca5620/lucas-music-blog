# App Store rules watch

Apple changes its App Review Guidelines several times a year (big
rounds around WWDC in June and again in the autumn) and publishes no
changelog. A feature that was fine at the last approval can be against
the rules by the next submission. This file is the repo copy of
**what changed, whether it affects Peak Music, and what to do**, so
both machines (Windows + MacBook) have it. CLAUDE.md tells Claude to
run the check below.

**Last checked: 2026-10-25** (Apple Developer News: nothing new since
the 2026-10-16 guidelines update except the 2026-10-22 multiseat
subscriptions note, which doesn't apply — Peak Music sells nothing in
the app).

---

## The check (run it before every native build, every submission, and before building anything with uploads, payments, AI or chat)

1. Read Apple Developer News: <https://developer.apple.com/news/> —
   anything since "Last checked" above. Look for "Updated App Review
   Guidelines", "Upcoming requirements", new devices, SDK minimums,
   age-rating changes, license-agreement updates.
2. Read the live guidelines: <https://developer.apple.com/app-store/review/guidelines/>
   — at least 1.2 (user content), 2.1, 2.3, 2.5, 3.1, 4.2, 4.8,
   5.1.1, 5.1.2, 5.2.
3. For each change write one line below: *what changed → does it hit
   Peak Music → what to do*. Update "Last checked".
4. If something now conflicts with a feature that's live, tell Luca in
   plain words **before** the next submission, and say whether it can
   be fixed on the website (instant, no review) or needs a new build.

Because the app loads the live site, a website feature can drift out
of the rules without any build at all — so the check also applies to
big website features, not only to App Store submissions.

---

## What changed since the 1.2 approval (2026-09-29 → 2026-10-24)

| Date | What changed | Hits Peak Music? | What to do |
|---|---|---|---|
| 2026-10-16 | **1.2 user content tightened**: now names AI content apps, nonconsensual intimate imagery, and says developers who don't keep safeguards up or don't fix violations after notice can be treated as breaking the Developer Code of Conduct (account-level risk, not just the app). | **Yes** — reviews, comments, lists, rooms, Aux Wars, GIFs, avatars, banners. | Text filter + report + block + contact are in place. **Fixed 2026-10-24:** /admin/reports can now delete a reported avatar/banner (migration 059 must be run). |
| 2026-10-16 | **New 2.5.19**: no hidden, dormant or undocumented features; hiding them is grounds for account termination. Paired with a news post on "bait-and-switch" apps that switch features on after approval. | **Low risk, but know it.** The binary is a shell; features live on the website. `SOUNDCLOUD_PLAYER_ENABLED = false` in `lib/flags.ts` is built-but-off code on the site. | Never hide a feature from reviewers or gate anything on "is this App Review". Keep the review freeze. **Done 2026-10-24:** the SoundCloud player was removed (restorable from git). Rule going forward: a flag that stays off for weeks counts as dormant — ship it or delete it. Mention big post-approval features in the next What's New. |
| 2026-10-16 | **New 2.3.14 creative assets** (the new product-page header + search-result images): must be about the app, suitable for all ages, no misleading references to other apps, no unverifiable claims, no prices. | Yes, if we make them. | No competitor names (no "Musicboard alternative") and no "#1 / best music app" claims in store images. |
| 2026-10-16 | 3.1.1(a) music-streaming link rules clarified. | No — nothing is sold. | Re-read before any revenue (see the revenue-stream topic). |
| 2026-10-25 (planning note) | Luca plans **website-only ads + a supporter ("donator") checkmark**; subscriptions later. Re-read 3.1.1, 3.1.1(a), 3.1.3, 3.1.3(b), 2.5.18, 3.2.2(iv) on the live page. | **Yes, if any of it shows in the app** (the app loads the live site). Ads in-app → 2.5.18 (report-an-ad, targeting info) + privacy labels; a support link in-app → 3.1.1(a)/3.1.3 steering outside the US storefront; selling anything in-app → IAP + EU trader. | Gate every ad and support link with `isNativeApp()` so the shell shows none. A web-bought checkmark *displayed* in the app is a 3.1.3(b) grey zone: show it with no price/link/CTA; if Apple objects, hide it in the app (website-only fix). Full notes: `.claude/skills/web-monetization/references/apple-and-eu.md`. |
| 2026-10-25 (built, af1237b) | Supporter checkmark shipped: Stripe Checkout on the website, any amount → silver 'supporter' role forever; ads held. | Only via display: the silver check + "Supporter since <year>" show in the app (recognition, no price/link/CTA). | /support in the app = the wall only (server checks the PMRBuild UA, client `useWebOnly`); footer link web only. If a reviewer flags the badge under 3.1.3(b), hide `supporter` badges when `isNativeApp()` — a website-only fix. Mention nothing about support in reviewer notes or screenshots. |
| 2026-10-25 (built, supporter links) | Support links added to the home end-of-feed module, About and Settings; "Save for later" release-day push (062); Peak Music Rewind (/rewind) with Instagram/TikTok share. | Support links: no — all three use `useWebOnly`, so the app shows none (3.1.1/3.1.3). Release-day push: 4.5.4 says pushes must not be marketing unless opted in — this one only fires for a record the person saved themselves and is about that record, so it's a requested alert, not marketing. Rewind: no payments, no new data collection. | Nothing to change. Reviewer notes for 1.3 can mention "a push when a record you saved comes out". |
| 2026-10-13 | New Apple Developer Program License Agreement. | Yes. | Luca must accept it at developer.apple.com/account or uploads are blocked. |
| 2026-10-05 | **iPhone Duo** (foldable, launched 2026-10-23). Screenshots for it earn a "Made for iPhone Duo" badge now; **from April 2027 every submission must include Duo screenshots.** | Yes. | 1.3 = the Duo build (see ROADMAP). Screenshot sizes: outer 1398×2034, inner 2007×2853. |
| 2026-09-09 | **From April 2027 apps must be built with the iOS 27 SDK.** | Already fine (1.2 was built with Xcode 27). | Build 1.3 with Xcode 27.1+. |
| 2026-07-09 | **Age-rating questionnaire asks about social media features**; answers required for updates since September 2026. Apps with a social feed get a "Social Media" label and fall under the new parental Time Allowances. | **Yes** — Peak Music has a feed of other people's reviews. | Answer **Yes** honestly when submitting 1.3. |
| 2026-08-24 | Sign in with Apple hands out new private-relay emails on `private.icloud.com`. | Checked: the code doesn't filter email domains. | Nothing, unless a domain allow-list is ever added. |
| 2026-06-03 | Texas age-assurance law in force (new Texas Apple Accounts). Apple offers the Declared Age Range API. | Possibly — social app with user content. | Look into it before 1.3; it's a native change, so it would ride in that build. |

---

## iPhone Duo — what supporting it means for this app

- The inner screen is iPad-sized (~669×951 points, the same
  "regular" size class as an iPad), the outer one is ~466×678. The
  camera/status bar sits on the **side** of the inner screen, and the
  inner screen ignores orientation locks.
- Built with the **iOS 27.1 SDK (Xcode 27.1+)** the app runs edge to
  edge on the inner screen; built with anything older it runs boxed in
  the middle with empty space around it. That's the whole native side
  for a web-shell app like ours, plus the UIScene setup we already have.
- Website side (ships instantly): content pads itself by the real left
  and right safe-area insets (`globals.css`, "SIDE SAFE AREAS"), and
  the Google/Apple sign-in sheet has a proper size on wide screens
  (`components/auth/OAuthButtons.tsx`).
- Test in the **iPhone Duo simulator in Xcode 27.1** (Device Hub can
  fold/unfold and rotate it), not only on a regular iPhone.
