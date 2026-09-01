-- =============================================================================
-- Migration 030 — Comment likes (2026-08-31)
-- Run AFTER 029 in the Supabase SQL Editor.
--
-- Luca's universal-like pass: every comment gets the same heart as
-- reviews/posts/lists (until now review comments couldn't be liked at
-- all). The multi-emoji reaction strips on debate/room chat collapse to
-- a single ❤️ in the UI — that needed NO schema change (the reaction
-- tables just store emoji='❤️' now); this table covers the threaded
-- `comments` rows, which had no reaction/like store of any kind.
--
-- Weekly "Top Reviews" on the Social page counts REVIEW likes
-- (review_likes.created_at), not these — this is purely the comment
-- heart.
--
--   1. comment_likes table (one like per person per comment) + indexes.
--   2. RLS: world-readable counts, you insert/delete only your own like.
--
-- The app degrades gracefully before this runs: comment hearts simply
-- don't render (the client feature-detects the table).
-- =============================================================================


-- ===========================================================================
-- 1. comment_likes
-- ===========================================================================

create table if not exists public.comment_likes (
  id          uuid primary key default gen_random_uuid(),
  comment_id  uuid not null references public.comments(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),

  -- One like per person per comment — the toggle flips this row.
  constraint uq_comment_likes unique (comment_id, user_id)
);

-- Counting a comment's likes is the hot read (every thread render).
create index if not exists idx_comment_likes_comment_id
  on public.comment_likes (comment_id);
-- "Which comments has this viewer liked" for heart fill-in state.
create index if not exists idx_comment_likes_user_id
  on public.comment_likes (user_id);

comment on table public.comment_likes is
  'Hearts on threaded review comments — one per user per comment.';


-- ===========================================================================
-- 2. RLS
-- ===========================================================================

alter table public.comment_likes enable row level security;

drop policy if exists "Comment likes are viewable by everyone"
  on public.comment_likes;
create policy "Comment likes are viewable by everyone"
  on public.comment_likes for select
  using (true);

drop policy if exists "Users can like comments as themselves"
  on public.comment_likes;
create policy "Users can like comments as themselves"
  on public.comment_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own comment likes"
  on public.comment_likes;
create policy "Users can remove their own comment likes"
  on public.comment_likes for delete
  using (auth.uid() = user_id);
