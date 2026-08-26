-- 022 — PS2 "Nebula" profile theme (2026-08-25): the boot-screen
-- galaxy — midnight indigo, blue-violet clouds, silver dust.
--
-- Run manually in the Supabase SQL Editor (like every migration here).
-- Without this, saving the ps2 theme fails the profiles_theme_check
-- constraint (last rebuilt in migration 015).

alter table profiles
  drop constraint if exists profiles_theme_check;

alter table profiles
  add constraint profiles_theme_check
  check (theme in (
    'crt-blue', 'ps2', 'ps3', 'ps4', 'xbox-og', 'xbox-360', 'wii', 'limewire',
    'bleach', 'daft-punk'
  ));
