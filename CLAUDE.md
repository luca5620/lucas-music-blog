# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

Peak Music Reviews (peakmusicreviews.com) — a music social platform: Letterboxd-style reviews/lists/profiles + live release rooms and two-sided debates, skinned as physical media (the whole site renders inside a CRT TV shell). Deployed on Vercel from `main`; the iOS/Android apps are Capacitor shells that load the live site, so **pushing to `main` deploys to production and updates the mobile apps instantly** — treat every push accordingly.

## Commands

```bash
npm run dev          # Next.js dev server
npm run build        # production build — run before pushing anything nontrivial
npm run lint         # eslint
npm run mobile:sync  # cap sync (after changing capacitor.config.ts or native deps)
npm run mobile:ios   # open Xcode workspace (Mac only)
```

There is no test suite. Verification = `npm run build` + exercising the change in the dev server.

Database changes are plain SQL files in `supabase/migrations/`, numbered (`021-*.sql` is next), and are **run by hand in the Supabase SQL Editor** — committing a migration does not apply it. When you add one, say so explicitly in your summary and in ROADMAP.md so it gets run on the dashboard.

## Architecture

- **Next.js 16 App Router + Tailwind v4** — CSS-first tokens in `app/globals.css`; there is no tailwind.config.
- **Supabase** is the entire backend: Postgres with RLS as the real security boundary (the app uses the anon key only — there is no service-role key anywhere in the app). Catalog writes go through an insert-only `security definer` SQL function. Auth (email confirmation required), storage (avatars/banners), realtime (live room + debate chat).
- **Catalog**: nothing is hand-typed. Releases enter the DB on demand the first time someone reviews them, via `components/catalog/CatalogSearch` → `/api/catalog/ensure`, which pulls from Spotify (client credentials) or Genius (covers unreleased/leaked, tagged UNRELEASED).
- **API routes** (`app/api/*/route.ts`) all follow the same contract: derive `user_id` from the session (never from the request body), validate with `lib/validate` helpers, and call `rateLimit()` from `lib/rate-limit.ts` (Upstash Redis, in-memory fallback). Every mutation route, no exceptions.
- **DB access layer** lives in `lib/db/*` (one file per domain: reviews, lists, debates, moderation, …); Supabase clients in `lib/supabase/` (`client.ts` browser, `server.ts` RSC/route handlers, `middleware.ts` session refresh via root `middleware.ts`).
- **Design system**: everything renders inside `components/ui/CRTShell` (grain, scanlines, aperture grille). Profile accent palettes are `theme-crt-*` classes — six user-selectable themes. New UI should look like physical media (VHS labels, OSD text), not like a generic web app.
- **Ratings** are 0–10 with one decimal, helpers in `lib/rating.ts`.
- Code is heavily commented **on purpose** — the owner is learning; match that density when editing.

`README.md` has the stack overview; `docs/LAUNCH-CHECKLIST.md` tracks human-hands setup steps (store accounts, tokens, dashboard toggles); `docs/MACBOOK-IOS-SETUP.md` is the Mac/Xcode path to TestFlight.

## Cross-machine workflow (IMPORTANT)

The owner works on this repo from exactly two machines — a Windows 11 desktop (primary) and a MacBook Pro (on-the-go fixes) — and syncs **only through git**. Claude Code's memory does not travel between them; the repo is the single source of shared truth. So:

1. **Start of every session**: run `git pull` (or confirm the working tree is current) before touching anything, and read the top of `ROADMAP.md` for current state.
2. **`ROADMAP.md` is the handoff file.** It has `✅ Done` and `🔨 Next up` sections. When work finishes, move/record it under Done (dated); when a session ends mid-task, leave a short dated note in a `## ⏳ In progress` section at the top — what's done, what's next, which files. The other machine resumes from that note.
3. **End of every session: commit and push**, even work-in-progress (WIP commits to `main` are acceptable to the owner if they build; otherwise use a branch and say so in ROADMAP.md). Unpushed work is invisible to the other machine.
4. Descriptive commit messages are part of the handoff — they're how the other machine reconstructs history.
5. Anything worth remembering across machines goes **in the repo** (this file, ROADMAP.md, docs/) — never only in local Claude memory.
