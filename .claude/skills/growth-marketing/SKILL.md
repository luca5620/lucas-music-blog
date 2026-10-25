---
name: growth-marketing
description: Growth, retention and short-form marketing playbook for Peak Music Reviews, distilled from Duolingo (growth model, streaks, notifications, unhinged social), Airbuds, Letterboxd, Spotify Wrapped, Receiptify and Strava, plus a frame-by-frame breakdown of the "decompiled app" TikTok format Luca sent as a reference. Use this skill whenever the task is about getting more users, bringing users back (retention, streaks, notifications, recaps, leaderboards), making TikToks / Reels / carousels / ads, writing hooks or captions, planning a campaign, share cards, referral or invite mechanics, or deciding what growth feature to build next — even if the user never says "growth" or "marketing".
---

# Growth + marketing — the Peak Music playbook

Researched 2026-10-25 (sources at the bottom of each reference). Peak Music
Reviews is a music review social app (Next.js site + Capacitor iOS shell).
Its scale is small: about 100+ accounts and ~270 ratings as of late
October 2026. The measured problem is **coming back**, not signing up:
/start lifted "signed up → rated once" from 21% to 67%, but only 13 of 55
raters were active on 2+ different days. Read every idea below through that
lens.

## How to use this skill

Read this file, then open **only the reference that matches the task**:

| Task | Read |
|---|---|
| Retention features: streaks, notifications, recaps, leaderboards, "what metric do we move" | `references/retention-loops.md` |
| What Duolingo actually does (and what failed), to borrow or argue from | `references/duolingo-playbook.md` |
| Lessons from Airbuds, Letterboxd, Spotify Wrapped, Receiptify, Strava | `references/comparable-apps.md` |
| Making a TikTok / Reel / carousel / ad, hooks, captions, the reference video format | `references/short-form-video.md` |

## Standing rules (Luca's — these override any playbook)

- **Brand is "Peak Music"**, never "Peak". Grep every caption before posting.
- **Sentence case** in ad text and captions; no all-lowercase gimmick.
- **No on-camera, no voice from Luca.** He's introverted and said no to
  "corny TikTok ads". Formats must work with screen recordings, the
  penguin, text, data and music. (Ambassadors or creators are fine.)
- **Never claim a competitor is dead or failing.** The r/Musicboard post got
  downvoted for that. Lead with what only Peak Music has (unreleased music,
  the sleeve review page, share cards).
- **No comparison landing pages** beyond /musicboard-alternative.
- **Quick Rate is rejected; never re-pitch parallel flows.** One way to rate.
- **One-and-done engagement features are MINOR**, never "the next thing".
- **Never borrow the Ratings app's UI** (ring score, gradient slider,
  cover-left header, blurred-cover background).
- **No 100% AI images** for marketing: real screenshot + AI plate + frame.
- **Reddit:** no Discord invites or link-heavy posts (first sub got
  insta-banned by the spam filter).
- **Ads he makes:** laid-back, no filler captions, 15–30s, CTA "Rate <x> on
  Peak Music", vary the formula; real lyrics in order; ~4s outro with the
  App Store badge.
- Discuss before building anything big. Open with 2–4 concrete options.

## The five lessons that matter most for Peak Music

1. **Retention compounds; acquisition leaks.** Duolingo modelled every user
   into buckets and found that improving *current-user retention* (CURR)
   moved daily users ~5x more than any other lever. For Peak Music that
   means: the second and third visit matter more than the next sign-up.
   Measure "active on 2+ days" and "rated in 2 different weeks" before and
   after every retention change.
2. **The owl is not the engine. The habit is.** Duolingo's own shareholder
   letter blamed slower growth partly on posting less "unhinged" content,
   but analysts note the content works only because a daily habit exists
   for it to remind people of. Marketing for Peak Music should point at a
   *habit* (rate what you listened to this week, release-day rooms, Sunday
   recap), not just the brand.
3. **The share artifact does the marketing.** Spotify Wrapped, Receiptify
   and Duolingo's Year in Review all spread because the output is personal,
   pretty and one tap to post. Peak Music already has the scorecard video,
   sticker and month card with one-tap Instagram/TikTok. Every new feature
   should ask: "what does this let someone post?"
4. **Borrow the reason, not the feature.** Duolingo's two flops were a
   copied game mechanic (a moves counter) and a copied Uber-style referral
   (it rewarded people who already paid). Before copying anything, write
   down why it works in the source product and whether that reason exists
   here.
5. **Short-form is a volume and experimentation game.** Airbuds reportedly
   ran 50+ creator accounts posting hundreds of lo-fi videos a day and kept
   only the creators who produced hits. The lesson at Peak Music's size:
   post more often, test many hooks, keep the formats that beat the median,
   and drop the rest. Don't expect any single post to carry the month.

## What's already built (don't re-propose it as new)

/start first-rating screen · Sunday recap · share sheet with scorecard
video / sticker / link and one-tap Instagram story + TikTok (Share Kit,
pending TikTok approval as of 2026-10-25) · month share card · showcases
(taste match, most loved songs, ratings histogram) · badges · Aux Wars ·
release rooms · KLIPY GIFs · Discord server · r/peakmusicreviewsapp ·
/musicboard-alternative.

## Monetization and SEO

Ads and supporter badges live in the `web-monetization` skill; search in
the `seo` skill. Apple rules for any of it: the `app-building` skill and
`docs/APP-STORE-RULES-WATCH.md`.
