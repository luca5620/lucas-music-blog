-- 015 — Two new profile theme presets (2026-08-20):
--   bleach     "Soul Reaper" — manga ink, black & white + blood red
--   daft-punk  "Robot Rock"  — helmet chrome + Discovery gold
--
-- Run manually in the Supabase SQL Editor (like every migration here).
-- Without this, saving either new theme fails the profiles_theme_check
-- constraint from migration 006.

alter table profiles
  drop constraint if exists profiles_theme_check;

alter table profiles
  add constraint profiles_theme_check
  check (theme in (
    'crt-blue', 'ps3', 'ps4', 'xbox-og', 'xbox-360', 'wii', 'limewire',
    'bleach', 'daft-punk'
  ));
