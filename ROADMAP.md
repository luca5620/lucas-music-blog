# Peak Music Reviews — Roadmap

*Updated 2026-08-08 as part of the ground-up overhaul.*

The vision: **Letterboxd's logging/review/social backbone + Real's live-and-gamified energy, for music, skinned in Y2K.**

- **Letterboxd → music:** a diary of everything you listen to, ratings with short honest reviews, shareable lists, friends' activity, rich stat-heavy profiles, album-art grids everywhere.
- **Real → music:** live release rooms (already built: chat, track reactions, presence), predictions + karma, collectible energy around albums and artists.
- **Your Taste:** a TikTok-style For You feed driven by your listening data, logs, and follows.

---

## ✅ Done

### Phase 1 — Personal blog
- Reviews (1–10.0 ratings, markdown), Spotify extended-history analytics, now-playing widget, profile-centric about/analytics.

### Phase 2a — Release-first platform
- Artists + releases schema, public artist/release pages, Spotify import (owner admin tool), generalized follow (users/artists/releases), autocomplete search, release-first home feed.

### Phase 2b — Live release rooms (the "Real" layer, v1)
- Live chat panel on release pages, track-level emoji reactions with floating ticker, presence pile + LIVE indicator.

---

## 🔨 The Overhaul (current)

Numbered by priority — reorder anytime.

### 1. Security hardening
Auth/authorization checks on every mutation route, input validation everywhere, security headers, rate limiting on write endpoints, env hygiene. Boring, but it protects everything else.

### 2. Design System v3
Keep the Y2K identity (grain, CRT, PS1 case, pixel accents) but make it cohesive and denser with content, Letterboxd-style:
- Album-art poster grids as the core visual unit (home, profiles, artists, lists)
- Tighter typography scale, consistent cards/buttons/badges across every route
- Better empty states, loading states, mobile polish

### 3. Listening diary (Letterboxd's core loop)
- Log any album/track: date + rating + optional one-liner — lighter weight than a full review
- Diary tab on profiles (chronological, month headers)
- Feeds stats: "logged this year", rating distribution histogram

### 4. Lists
- Create/edit/reorder album lists ("best of 2026", "3am driving music")
- Public list pages with poster grids, likes, lists showcased on profiles

### 5. Friends activity feed + profile upgrades
- Activity feed: recent logs/reviews/likes/list-adds from people you follow
- "Popular with friends" rail on releases and home
- Profile: four-favorites showcase, stats block, diary/lists/reviews tabs

### 6. Your Taste v2 (For You feed)
- Rank a feed from: your Spotify history genres/artists, your logs and ratings, who you follow, what's popular with friends, live-room activity
- Infinite scroll of releases/reviews/lists with "why you're seeing this" tags

### 7. Predictions + karma (the "Real" gamification layer)
- Predict the community rating of an upcoming release before it drops; earn karma for accuracy
- Karma on profiles; leaderboard among friends
- Later: collectible artist/album cards, weekly rotation "draft"

### 8. Listening parties v2
- Scheduled listening parties for release nights (synced track position, countdown)
- Room replay: see the reaction ticker from release night

---

## 🔮 Later

- **Mobile app** (PWA first, then React Native) — push notifications for friends' logs and release-night rooms
- **Multi-platform music linking** — Apple Music/Tidal/SoundCloud profile links; deeper integrations where APIs allow
- **Deep profile customization** — Myspace-style: custom backgrounds, profile song, arrangeable sections, font/color picker
- **Rebrand decision** — "Peak Music Reviews" vs. a new name when the social platform opens up

---

## Principles (from the project brief)

- **Anti-Pitchfork:** casual-but-serious voice; loving a song for a dumb reason is valid
- **Content-first:** reviews and real listening data are the product; design serves them
- **1–10.0 ratings**, one decimal, everywhere
- **Well-commented code** — Luca is learning; every non-obvious block gets a comment
