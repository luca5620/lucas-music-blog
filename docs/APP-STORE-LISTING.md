# App Store Connect listing kit — Peak Music Reviews

Everything to paste into App Store Connect when you create the app.
Field limits are noted; all copy below fits.

---

## Basics

| Field | Value |
|---|---|
| Platform | iOS |
| Name (30 chars max) | `Peak Music Reviews` (18 ✓) |
| Subtitle (30 chars max) | `Rate, debate, discover music` (28 ✓) |
| Bundle ID | `com.peakmusicreviews.app` (must match Xcode) |
| SKU | `pmr-001` |
| Primary language | English (U.S.) |
| Category | Music (primary), Social Networking (secondary) |
| Price | Free |

## Promotional text (170 chars max — editable without re-review)

> The music social network. Rate any album or song — even unreleased —
> build lists, join live release rooms, and pick a side in debates.

## Description (4000 chars max)

> **Every album. Every leak. Every argument.**
>
> Peak Music Reviews is a social platform for people who actually care
> about music. Think of the way film lovers log and rate movies — this
> is that, for records, with live energy on top.
>
> **RATE ANYTHING**
> Every review is tied to a real release. Search the full streaming
> catalog plus a deep library of unreleased tracks, leaks, and loosies
> that never hit streaming. Score it 0–10, pick your personal favorites,
> and say what you actually think — no pretentious jargon required.
>
> **BUILD YOUR SHELF**
> Ranked lists, mood lists, "best of the year so far" — curate and
> share them, and browse everyone else's.
>
> **GO LIVE WHEN ALBUMS DROP**
> Release rooms put you in a live chat the moment a record lands —
> react track by track with everyone hearing it at the same time.
>
> **PICK A SIDE**
> Debates are two-sided arguments with a vote and a live chat where
> every message is stamped with the side you chose. Overrated or a
> classic? Prove it.
>
> **A PROFILE THAT'S ACTUALLY YOURS**
> Choose from vintage-console theme presets, arrange your showcases —
> favorite albums, stats, a featured review, badges — and set the
> tone with your own banner, avatar, and profile song.
>
> **BUILT FOR THE FEED YOU WANT**
> Your Taste is a page tuned to exactly one listener: you. It's built
> from who you follow and what you rate — not from ads.
>
> Free to join. Real usernames, one account per email.

## Keywords (100 chars max, comma-separated, no spaces needed)

`music,album,review,rate,social,lists,vinyl,unreleased,leaks,debate,live,charts,rap,pop,indie` (95 ✓)

## URLs

| Field | Value |
|---|---|
| Support URL | `https://peakmusicreviews.com` |
| Marketing URL (optional) | `https://peakmusicreviews.com` |
| Privacy Policy URL | **REQUIRED — see "Before you submit" below** |

## App Privacy questionnaire (Data Collection)

Answer "Yes, we collect data from this app", then:

- **Contact Info → Email Address**: collected, linked to identity,
  used for App Functionality (account). NOT used for tracking.
- **User Content → Other User Content**: collected (reviews, comments,
  lists, chat messages, profile images), linked to identity, App
  Functionality. NOT used for tracking.
- **Identifiers → User ID**: collected, linked to identity, App
  Functionality. NOT used for tracking.
- Everything else: not collected. No third-party ads, no tracking.

## Age rating questionnaire

The two answers that matter:
- **Unrestricted Web Access**: NO (the app loads only your site, not a browser).
- **User-Generated Content**: YES → this yields roughly a 12+/13+ rating. Fine.

## App Review Information

- Create a **demo account** before submitting (e.g. username
  `applereview`, a real inbox you control, confirm the email) and put
  its credentials in the "Sign-In Information" fields — reviewers must
  be able to log in.
- Notes for reviewer (paste):
  > Peak Music Reviews is a music social network. Native features:
  > haptic feedback, native share sheet, offline handling, and push
  > notifications [delete this last item if not built yet]. A demo
  > account is provided; you can also register freely. All content is
  > tied to licensed catalog metadata from Spotify and Genius public
  > APIs (metadata + artwork only — no audio streaming or downloads).

## Screenshots (made on the Mac, 5 minutes)

Required sizes: **6.9" or 6.7" iPhone** (one size is mandatory; others
scale). In Xcode: run the app in the iPhone 16 Pro Max simulator →
navigate to a good page → Cmd+S saves a correctly-sized PNG to the
Desktop. Take 5: Home (logged in), a review page, a profile with a
console preset, a debate room, the review editor.

---

## ⚠️ Before you submit — two gaps Apple checks for

1. **Privacy Policy URL is mandatory.** The site doesn't have a
   privacy page yet — ask Claude to generate `/privacy` (and a
   matching `/terms`) before submission day.
2. **User-generated-content rules (guideline 1.2).** Apps with UGC
   must have: a way to REPORT content, a way to BLOCK users, and
   moderation. The platform doesn't have report/block yet — ask
   Claude to build the minimal version (report button on
   reviews/comments/messages + block user + admin queue) before
   submitting, or the first review cycle will likely bounce.
