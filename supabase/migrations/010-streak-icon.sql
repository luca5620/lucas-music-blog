-- ============================================================
-- Migration 010 — streak icon preference (2026-08-19)
-- Run in the Supabase SQL Editor after 009.
--
-- Each user picks the animated icon for their song-of-the-day
-- streak: flickering flame, spinning vinyl, or spinning CD.
-- ============================================================

alter table public.profiles
  add column if not exists streak_icon text not null default 'flame';

alter table public.profiles
  drop constraint if exists profiles_streak_icon_check;
alter table public.profiles
  add constraint profiles_streak_icon_check
  check (streak_icon in ('flame', 'vinyl', 'cd'));
