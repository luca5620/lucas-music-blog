-- ============================================================
-- Migration 040 — hidden badges (2026-09-03). Run in the Supabase SQL
-- Editor after 039.
--
-- Luca: "add the ability to hide whatever badges you don't want
-- showing". The badges row under the username (039) is computed on
-- the fly, so nothing is deleted: `hidden_badges` is the list of
-- badge keys the member does NOT want visitors to see.
--
--   'reviews' | 'likes' | 'tenure'   — the three computed badges
--   any profile_badges.badge_key     — an awarded event badge
--
-- NULL / empty = everything shows (every existing row keeps looking
-- exactly as it does today). The app validates keys; the check only
-- bounds the size so a bad client can't store a novel here. The
-- owner still sees hidden badges on their own profile, dimmed and
-- tagged "hidden from visitors" — same treatment as hidden links.
-- ============================================================

alter table public.profiles
  add column if not exists hidden_badges text[];

alter table public.profiles
  drop constraint if exists profiles_hidden_badges_size,
  add constraint profiles_hidden_badges_size check (
    hidden_badges is null or cardinality(hidden_badges) <= 40
  );

-- PostgREST caches the schema — without this the new column 404s
-- until the next restart.
notify pgrst, 'reload schema';
