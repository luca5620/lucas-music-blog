-- =============================================================================
-- Migration 016 — Post likes (2026-08-22)
-- Run AFTER 015 in the Supabase SQL Editor.
--
-- Posts get the same heart as reviews and lists. Beyond the button, likes
-- are the popularity signal the Your Taste "Tuned To You" pager ranks
-- posts by (lib/taste.ts) — until now posts had no engagement signal at
-- all and ranked on freshness alone.
--
--   1. post_likes table (one like per person per post) + indexes.
--   2. RLS: world-readable counts, you insert/delete only your own like.
-- =============================================================================


-- ===========================================================================
-- 1. post_likes
-- ===========================================================================

create table if not exists public.post_likes (
  id         uuid primary key default gen_random_uuid(),
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),

  -- One like per person per post — the toggle flips this row.
  constraint uq_post_likes unique (post_id, user_id)
);

-- Counting a post's likes is the hot read (feeds + taste ranking).
create index if not exists idx_post_likes_post_id on public.post_likes (post_id);
-- "Which posts has this viewer liked" for heart fill-in state.
create index if not exists idx_post_likes_user_id on public.post_likes (user_id);

comment on table public.post_likes is
  'Hearts on posts — one per user per post. Feeds Your Taste ranking.';


-- ===========================================================================
-- 2. RLS
-- ===========================================================================

alter table public.post_likes enable row level security;

drop policy if exists "Post likes are viewable by everyone" on public.post_likes;
create policy "Post likes are viewable by everyone"
  on public.post_likes for select
  using (true);

drop policy if exists "Users can like posts as themselves" on public.post_likes;
create policy "Users can like posts as themselves"
  on public.post_likes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own post likes" on public.post_likes;
create policy "Users can remove their own post likes"
  on public.post_likes for delete
  using (auth.uid() = user_id);
