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

- **2026-08-24 (MacBook):** CocoaPods run on the Mac — Podfile.lock +
  Xcode workspace committed. CLAUDE.md created for cross-machine
  workflow. Next: GitHub push auth on the MacBook, then continue App
  Store launch week (item 1 below).

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
