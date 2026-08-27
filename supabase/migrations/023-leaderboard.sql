-- ============================================================
-- Migration 023 — Friends-tab leaderboard (2026-08-26)
-- Run in the Supabase SQL Editor after 022.
--
-- One function feeds the whole leaderboard: per-user counts of
-- reviews written, likes RECEIVED on those reviews, and lists
-- made. Aggregation happens here in SQL because PostgREST (the
-- anon REST API) can't group-and-count across joins — and pulling
-- every row to count in JS would grow with the userbase.
--
-- SECURITY INVOKER (the default) on purpose: the function runs
-- with the caller's rights, so RLS still decides what's countable.
-- Counts therefore reflect what the viewer could see anyway —
-- nothing private leaks through a tally.
--
-- Returns the top `limit_n` users by COMBINED activity; the site
-- sorts per-metric client-side from this one payload. At top-50 a
-- user leading one metric while missing the combined cut is
-- vanishingly unlikely at current scale; revisit if the userbase
-- explodes.
-- ============================================================

create or replace function public.leaderboard_stats(limit_n int default 50)
returns table (
  user_id uuid,
  username text,
  display_name text,
  avatar_url text,
  review_count bigint,
  likes_received bigint,
  list_count bigint
)
language sql
stable
set search_path = public
as $$
  with
    r as (
      select reviews.user_id as uid, count(*) as c
      from reviews
      group by 1
    ),
    l as (
      -- Likes RECEIVED: join through reviews to credit the AUTHOR,
      -- not the liker.
      select rv.user_id as uid, count(*) as c
      from review_likes rl
      join reviews rv on rv.id = rl.review_id
      group by 1
    ),
    li as (
      select lists.user_id as uid, count(*) as c
      from lists
      group by 1
    )
  select
    p.id,
    p.username,
    p.display_name,
    p.avatar_url,
    coalesce(r.c, 0),
    coalesce(l.c, 0),
    coalesce(li.c, 0)
  from profiles p
  left join r on r.uid = p.id
  left join l on l.uid = p.id
  left join li on li.uid = p.id
  where coalesce(r.c, 0) + coalesce(l.c, 0) + coalesce(li.c, 0) > 0
  order by coalesce(r.c, 0) + coalesce(l.c, 0) + coalesce(li.c, 0) desc
  limit greatest(1, least(limit_n, 200))
$$;

-- Anyone can read the leaderboard — it's built from public content.
grant execute on function public.leaderboard_stats(int) to anon, authenticated;
