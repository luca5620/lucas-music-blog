-- ============================================================
-- Migration 025 — In-app notifications (2026-08-27)
-- Run AFTER 024 in the Supabase SQL Editor.
--
-- The bell: follows, review/post/list likes, comments and replies
-- land here and render in the header dropdown. This is also the
-- foundation for push notifications later — the same rows that
-- feed the bell will fire the pushes once the native rebuild adds
-- a device-token table.
--
-- Design notes:
--   * href + title are DENORMALIZED at insert time so rendering
--     needs no cross-table joins and old notifications survive
--     content renames/deletions gracefully (a dead link 404s, the
--     bell itself never breaks).
--   * No unique constraint: the API layer dedups like/follow spam
--     (check-then-insert). Worst case under a race is one extra
--     row — harmless.
-- ============================================================

create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  -- Who receives it
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- Who caused it
  actor_id   uuid not null references public.profiles(id) on delete cascade,
  type       text not null check (type in
    ('follow', 'review_like', 'comment', 'comment_reply', 'post_like', 'list_like')),
  -- Where clicking it goes + what to call the thing
  href       text not null check (char_length(href) between 1 and 300),
  title      text check (char_length(title) <= 200),
  read       boolean not null default false,
  created_at timestamptz not null default now(),
  -- You can't notify yourself
  check (user_id <> actor_id)
);

-- The bell reads "mine, newest first" and counts "mine, unread".
create index if not exists idx_notifications_user_created
  on public.notifications (user_id, created_at desc);
create index if not exists idx_notifications_user_unread
  on public.notifications (user_id) where not read;

alter table public.notifications enable row level security;

-- Only the recipient ever sees a notification.
drop policy if exists "Recipients read their notifications" on public.notifications;
create policy "Recipients read their notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

-- Actions create notifications with the CALLER's session, so the
-- actor must be the signed-in user (and can't target themselves —
-- the table check enforces that too).
drop policy if exists "Actors create notifications as themselves" on public.notifications;
create policy "Actors create notifications as themselves"
  on public.notifications for insert
  with check (auth.uid() = actor_id and auth.uid() <> user_id);

-- Recipients mark their own rows read.
drop policy if exists "Recipients update their notifications" on public.notifications;
create policy "Recipients update their notifications"
  on public.notifications for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Recipients can clear their own rows.
drop policy if exists "Recipients delete their notifications" on public.notifications;
create policy "Recipients delete their notifications"
  on public.notifications for delete
  using (auth.uid() = user_id);
