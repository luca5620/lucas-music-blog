-- ============================================================
-- Migration 033 — "someone you follow posted" notifications (2026-09-02)
-- Run in the Supabase SQL Editor after 032.
--
-- Every notification type so far is reactive: someone did something to
-- YOUR stuff. These four are the other direction — the people you
-- follow made something, and you'd want to know. Luca's ask: any of
-- the four things the CREATE tab makes.
--
-- Schema-wise this is only a widened check constraint; the fan-out
-- itself is app-side (notifyFollowers in lib/db/notifications.ts).
-- RLS needs no change: the existing insert policy already allows the
-- actor to write rows addressed to other people, which is exactly the
-- shape of a fan-out — one row per follower, all with the creator as
-- actor.
-- ============================================================

alter table public.notifications
  drop constraint if exists notifications_type_check;

alter table public.notifications
  add constraint notifications_type_check check (type in (
    -- Reactive: something happened to yours.
    'follow',
    'review_like',
    'comment',
    'comment_reply',
    'post_like',
    'list_like',
    -- Follow-feed: someone you follow made something (033).
    'new_review',
    'new_post',
    'new_list',
    'new_debate'
  ));

-- The fan-out's dedup asks "have I already told this follower about
-- this href?" — one lookup per publish, keyed the way it queries.
create index if not exists idx_notifications_actor_type_href
  on public.notifications (actor_id, type, href);

-- Verify (should return 10 rows):
--   select unnest(enum_range(null::text)) ;  -- n/a, it's a check not an enum
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.notifications'::regclass
--     and conname = 'notifications_type_check';
