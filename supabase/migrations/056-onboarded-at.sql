-- ============================================================
-- Migration 056 — profiles.onboarded_at (first-rating screen)
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- 36 people signed up in 30 days and only 7 ever posted a review.
-- A brand-new account now lands on /start once — "rate three
-- records you know" — and this column is the "they've seen it"
-- marker, so the sign-in paths (/auth/callback, the in-app OAuth
-- finish, /login) never send the same person there twice.
--
-- NULL  = never shown the first-rating screen.
-- set   = shown (the screen stamps it the moment it opens, so a
--         skip or a closed tab still counts as "seen").
--
-- NO BACKFILL, on purpose. The automatic routing only ever fires for
-- an account that is (a) younger than 7 days, (b) has zero published
-- reviews and (c) has onboarded_at NULL — so long-standing members
-- are never sent there. The handful of accounts from the last week
-- with an empty shelf WILL see /start once on their next sign-in;
-- those are exactly the people it was built for. (Anyone with an
-- empty shelf can also open it from the home page's "Rate your
-- first record" button — a choice, not a trap.)
--
-- The code tolerates this column NOT existing yet: until it runs,
-- a browser cookie (pmr_onboarded) plus "account younger than 7
-- days with zero reviews" does the same job on one device.
--
-- No RLS change needed: the existing "Users can update their own
-- profile" policy already lets a member write their own row, and
-- nothing here is security-sensitive (it only decides which page
-- you land on after signing in).
-- ============================================================

alter table public.profiles
  add column if not exists onboarded_at timestamptz;

comment on column public.profiles.onboarded_at is
  'When this member was first shown the /start first-rating screen. NULL = never. Set by POST /api/onboarding.';


-- Verify (column exists, everyone NULL until they open /start):
--   select count(*) filter (where onboarded_at is null) as not_yet,
--          count(*) filter (where onboarded_at is not null) as seen
--     from public.profiles;
