-- ============================================================
-- Migration 027 — hide streaming links from public profiles (2026-08-28)
-- Run in the Supabase SQL Editor after 026.
--
-- Luca's ask: people can still CONNECT their platforms of choice
-- (the Spotify / SoundCloud / stats.fm / Apple Music links in
-- Settings — features that read them, like the stats.fm listening
-- showcases, keep working), but a "don't show these on my profile"
-- checkbox hides the icon row from profile VISITORS.
--
-- default FALSE: every existing profile keeps showing its links —
-- nothing changes until someone ticks the box. No RLS work needed:
-- profiles' update-own-row policy already covers the write, and the
-- flag is display-level (the links live in the world-readable
-- profiles row either way, same as before this migration).
--
-- The app degrades gracefully pre-migration: the settings checkbox
-- only appears once the column exists, and the profile page treats
-- a missing column as "not hidden".
-- ============================================================

alter table public.profiles
  add column if not exists hide_streaming_links boolean not null default false;
