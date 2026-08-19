-- =============================================================================
-- Migration 013 — Posts (2026-08-19)
-- Run AFTER 012 in the Supabase SQL Editor.
--
-- Posts are freeform blog-style writeups — looser than reviews — that can
-- embed ONE YouTube or TikTok video (an AMV edit, a live cut, a video
-- essay) and, like reviews, tie back to a real catalog release so readers
-- can jump from the post to the release page. Text-only posts (no video)
-- are allowed too.
--
--   1. posts table + indexes + updated_at trigger.
--   2. RLS: world-readable, authors write their own, admins can delete
--      (mirrors 007's moderation-teeth pattern).
--   3. content_reports.target_type learns 'post' — posts are public UGC,
--      so they MUST be reportable (App Store guideline 1.2).
-- =============================================================================


-- ===========================================================================
-- 1. posts
-- ===========================================================================

create table if not exists public.posts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  slug        text not null unique,
  title       text not null check (char_length(title) between 3 and 120),
  body        text not null check (char_length(body) between 1 and 10000),
  -- The one optional embed. We NEVER store raw URLs — only the platform
  -- kind plus the extracted video id, validated server-side (XSS defense:
  -- the iframe src is built from an allowlisted template + this id).
  video_kind  text check (video_kind in ('youtube', 'tiktok')),
  video_id    text check (char_length(video_id) <= 40),
  -- The catalog release this post is about. Nullable (not every post is
  -- about one record); set null on release deletion so posts survive.
  release_id  uuid references public.releases(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- A video is (kind, id) as a pair — one without the other is a bug.
  constraint chk_posts_video_pair
    check ((video_kind is null) = (video_id is null))
);

-- The index page reads "newest posts" constantly.
create index if not exists idx_posts_created_at on public.posts (created_at desc);
create index if not exists idx_posts_user_id    on public.posts (user_id);
create index if not exists idx_posts_release_id on public.posts (release_id);

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

comment on table public.posts is
  'Freeform blog-style posts, optionally embedding one YouTube/TikTok video and tied to a catalog release.';


-- ===========================================================================
-- 2. RLS
-- ===========================================================================

alter table public.posts enable row level security;

drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Posts are viewable by everyone"
  on public.posts for select
  using (true);

drop policy if exists "Users can create their own posts" on public.posts;
create policy "Users can create their own posts"
  on public.posts for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own posts" on public.posts;
create policy "Users can update their own posts"
  on public.posts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own posts" on public.posts;
create policy "Users can delete their own posts"
  on public.posts for delete
  using (auth.uid() = user_id);

-- Moderation teeth — same pattern as migration 007: staff can remove
-- reported posts, otherwise the report queue is decorative.
drop policy if exists "Admins can delete any post" on public.posts;
create policy "Admins can delete any post"
  on public.posts for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner', 'admin')
  );


-- ===========================================================================
-- 3. content_reports accepts target_type = 'post'
-- ===========================================================================
-- The CHECK in 007 was declared inline, so Postgres named it
-- content_reports_target_type_check. Re-create it with the full list.

alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;

alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type in
    ('review', 'comment', 'list', 'debate', 'debate_message', 'room_message', 'profile', 'post'));
