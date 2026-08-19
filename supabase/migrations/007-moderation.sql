-- ============================================================
-- Migration 007 — Moderation (2026-08-18)
-- Run AFTER 006 in the Supabase SQL Editor.
--
-- Why this exists: Apple's App Store guideline 1.2 requires any
-- app with user-generated content to have (a) a way to report
-- content, (b) a way to block users, and (c) actual moderation.
-- This adds all three:
--   1. content_reports — the report queue.
--   2. user_blocks     — one user hiding/blocking another.
--   3. Admin delete policies — moderators can actually remove
--      reported content (until now only authors could delete
--      their own rows).
-- ============================================================

-- ------------------------------------------------------------
-- 1. CONTENT REPORTS
--    Anyone signed in can file one; only staff can read the
--    queue and change a report's status. Reporters can see
--    their own reports (so the UI can show "already reported").
-- ------------------------------------------------------------
create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  -- What kind of thing is being reported. target_id is the row id
  -- in that thing's own table (we don't FK it because the target
  -- lives in different tables depending on type).
  target_type text not null check (target_type in
    ('review', 'comment', 'list', 'debate', 'debate_message', 'room_message', 'profile')),
  target_id   uuid not null,
  reason      text not null check (char_length(reason) between 3 and 500),
  status      text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now()
);

-- The admin queue reads "open reports, newest first" constantly.
create index if not exists idx_reports_status_created
  on public.content_reports (status, created_at desc);

alter table public.content_reports enable row level security;

drop policy if exists "Users can file reports as themselves" on public.content_reports;
create policy "Users can file reports as themselves"
  on public.content_reports for insert
  with check (auth.uid() = reporter_id);

drop policy if exists "Reporters and staff can read reports" on public.content_reports;
create policy "Reporters and staff can read reports"
  on public.content_reports for select
  using (
    auth.uid() = reporter_id
    or (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  );

drop policy if exists "Staff can update reports" on public.content_reports;
create policy "Staff can update reports"
  on public.content_reports for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  );

-- ------------------------------------------------------------
-- 2. USER BLOCKS
--    Private to the blocker: nobody else can see who you block.
--    The composite primary key makes double-blocking impossible.
-- ------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.user_blocks enable row level security;

drop policy if exists "Users can see their own block list" on public.user_blocks;
create policy "Users can see their own block list"
  on public.user_blocks for select
  using (auth.uid() = blocker_id);

drop policy if exists "Users can block as themselves" on public.user_blocks;
create policy "Users can block as themselves"
  on public.user_blocks for insert
  with check (auth.uid() = blocker_id);

drop policy if exists "Users can unblock as themselves" on public.user_blocks;
create policy "Users can unblock as themselves"
  on public.user_blocks for delete
  using (auth.uid() = blocker_id);

-- ------------------------------------------------------------
-- 3. MODERATION TEETH
--    Staff can delete any reported content. Without these, RLS
--    only let authors delete their own rows, which makes the
--    report queue decorative.
-- ------------------------------------------------------------
drop policy if exists "Admins can delete any review" on public.reviews;
create policy "Admins can delete any review"
  on public.reviews for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  );

drop policy if exists "Admins can delete any comment" on public.comments;
create policy "Admins can delete any comment"
  on public.comments for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  );

drop policy if exists "Admins can delete any debate message" on public.debate_messages;
create policy "Admins can delete any debate message"
  on public.debate_messages for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  );

drop policy if exists "Admins can delete any room message" on public.room_messages;
create policy "Admins can delete any room message"
  on public.room_messages for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  );

drop policy if exists "Admins can delete any list" on public.lists;
create policy "Admins can delete any list"
  on public.lists for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  );
