# Peak Music Reviews overhaul — launch checklist

Things only YOU can do (they need your logins / your money). In order.

## 1. Database — run the wipe + upgrade migration ⚠️ REQUIRED FIRST

The site will error on new features (and old content still shows)
until this runs.

1. Supabase Dashboard → your project → **SQL Editor**.
2. If you never ran them: paste + run `supabase/migrations/004-diary-lists-favorites.sql`,
   then `005-security-hardening.sql` (skip if already run; errors like
   "already exists" on 004/005 mean they ran — fine).
3. Paste + run **`supabase/migrations/006-overhaul-v2.sql`**.
   - ⚠️ This DELETES all reviews, albums, lists, and diary content
     (that's the wipe you asked for). Accounts, roles, and verified
     badges survive.

## 2. Genius API token (free, 2 minutes)

Powers the deep catalog: unreleased tracks, leaks, loosies.

1. Go to https://genius.com/api-clients (sign up / log in).
2. **New API Client** — App name: Peak Music Reviews, App website URL:
   https://peakmusicreviews.com (icon/redirect not needed).
3. Copy the **Client Access Token** (NOT the client id/secret).
4. Add to `.env.local`:  `GENIUS_ACCESS_TOKEN=<token>`
5. Add the same variable in **Vercel → Project → Settings →
   Environment Variables** (all environments) → redeploy.

Without it the site still works — Genius results just don't appear in
search.

## 3. Supabase auth settings (stops throwaway accounts)

Dashboard → **Authentication → Sign In / Up → Email**:
- **Confirm email: ON** (users must click the email link before the
  account works).
- Authentication → **URL Configuration**: Site URL =
  `https://peakmusicreviews.com`; add
  `https://peakmusicreviews.com/**` to Redirect URLs.
- Heads-up: Supabase's built-in email sender is limited (~2/hour) and
  fine for now. When real users show up, plug in a free Resend account
  under Authentication → SMTP Settings (ask Claude when you get there).

## 4. Apple Developer Program — $99/year ⏰ starts a 24–48h clock

https://developer.apple.com/programs/enroll/ — enroll as Individual,
pay, wait for approval. Do this the moment you decide to ship iOS this
week; everything else on the Mac can happen while it's pending. Then
follow `docs/MACBOOK-IOS-SETUP.md`.

## 5. Google Play — $25 one-time (slow lane, start whenever)

https://play.google.com/console — pay, verify identity. New personal
accounts must run a 14-day closed test with 12 testers before public
release, so the Play listing lands in ~3 weeks minimum no matter what.
The `android/` project in the repo is ready when you are.

## 6. After the migration — sanity pass (5 min)

- Sign up with a throwaway email → confirm the email → pick a username.
- Write a review: search should show Spotify + (with token) Genius
  results; pick one; no manual cover/title fields anywhere.
- Open Settings → Profile: pick a theme, upload an avatar + banner,
  arrange showcases.
- Start a debate, vote, send a message from two browsers — chat should
  stream live.
- Check your own account still has the owner badge.

## Notes

- Old personal-blog stuff (diary, hardcoded analytics, background
  music, now-playing) is gone by design.
- `SPOTIFY_REFRESH_TOKEN` in `.env.local` / Vercel is no longer used —
  you can delete that variable (keep CLIENT_ID / CLIENT_SECRET).
