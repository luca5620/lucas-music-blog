# Peak Music Reviews

A music social platform with a CRT soul. Letterboxd's logging/review
backbone + Real's live energy, for music — rate any album or song on
Spotify **or** the deep Genius catalog (unreleased included), build
lists, customize a Steam-style profile, join live release rooms, and
argue in two-sided debates.

Live at **[peakmusicreviews.com](https://peakmusicreviews.com)** ·
deployed on Vercel from `main`.

## Stack

- **Next.js 16** (App Router) + **Tailwind v4** (CSS-first tokens in
  `app/globals.css` — no tailwind.config)
- **Supabase** — Postgres + RLS (anon key only, no service-role key in
  the app; user-seeded catalog writes go through an insert-only
  `security definer` function), auth with email confirmation, storage
  for avatars/banners, realtime for live chat
- **Spotify API** (client credentials) + **Genius API** — unified
  catalog search, releases imported on demand the first time someone
  reviews them
- **Capacitor 7** — native iOS/Android shells (`ios/`, `android/`)
  that load the live site; see `docs/MACBOOK-IOS-SETUP.md`

## Development

```bash
npm install
cp .env.example .env.local   # fill in Supabase/Spotify/Genius values
npm run dev
```

Database changes are plain SQL files in `supabase/migrations/`, run by
hand in the Supabase SQL Editor, in numeric order. Setup steps that
need human hands (store accounts, API tokens, dashboard toggles) live
in `docs/LAUNCH-CHECKLIST.md`.

## Design system

Everything renders inside a CRT television (`components/ui/CRTShell`)
with grain/scanlines/aperture-grille overlays. The visual language is
"physical media": VHS labels, OSD text, phosphor glow, channel-change
page transitions. Profile pages re-skin the accent palette via
`theme-crt-*` classes — six themes users pick in settings.

## Conventions

- API mutations: session-derived `user_id` + `lib/validate` helpers +
  `rateLimit()` — every route, no exceptions
- Ratings are 0–10 with one decimal
- Nothing is hand-typed into the catalog: all releases enter through
  `components/catalog/CatalogSearch` → `/api/catalog/ensure`
- Code is heavily commented on purpose — the owner is learning
