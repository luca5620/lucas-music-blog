-- ============================================================
-- Migration 008 — "Early Tester" role (2026-08-19)
-- Run in the Supabase SQL Editor after 007.
--
-- Adds 'tester' to the allowed roles: a purple glowing checkmark
-- for the day-one crew who helped test the platform before launch.
-- Testers get the badge ONLY — no admin/moderation powers (every
-- permission check in the app and in RLS looks for admin/owner).
-- ============================================================

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'reviewer', 'admin', 'owner', 'tester'));

-- The first early tester, badge earned the honest way: by finding
-- real launch-blocking bugs.
update public.profiles set role = 'tester' where username = 'chimp';
