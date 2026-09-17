-- ============================================================
-- Migration 049 — YOUR PEOPLE, THIS WEEK (2026-09-16)
-- Run in the Supabase SQL Editor after 048.
--
-- Luca: "an area with top 3 of your friends for the week of aux war
-- wins, reviews, and likes if possible."
--
-- One function, three little charts. Scoped to the viewer's own
-- circle — themselves plus everyone they follow — so it reads as
-- "how my people are doing this week" rather than a global chart
-- nobody in it knows each other. The viewer is included on purpose:
-- a board you can never appear on is a board you stop looking at.
--
-- WHY IT TAKES `p_since` INSTEAD OF A PERIOD WORD. The app already
-- has TWO different meanings of "this week": aux_leaderboard('week')
-- is a rolling 7 days, while the Top Reviews chart on this very page
-- resets Friday 00:00 Eastern (lib/upcoming.ts lastFridayEasternUtcMs).
-- Two different weeks side by side on one screen reads as a bug, so
-- the caller passes the boundary and the social page passes the same
-- Friday it already uses. Nothing here invents a third week.
--
-- SECURITY DEFINER + auth.uid(): the circle is derived server-side
-- from the caller's own follows, so a client can never ask for
-- somebody else's friend board.
--
-- The three metrics, and what each deliberately does NOT count:
--   aux     — Aux Wars WON outright (champion of a finished war), not
--             rounds. `aux_self_judged` still throws out a win in a
--             room where the host both played and judged, exactly as
--             the main leaderboard does (migration 044).
--   reviews — PUBLISHED reviews written this week. Drafts never count;
--             this has to agree with the review number on a profile.
--   likes   — likes RECEIVED on your reviews this week, credited to
--             the author rather than the liker, and dated by when the
--             LIKE happened, not when the review was written.
-- ============================================================

create or replace function public.social_week_leaders(
  p_since timestamptz,
  p_limit integer default 3
)
returns table (
  metric       text,
  rank         integer,
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  role         text,
  score        integer
)
language sql
stable
security definer set search_path = public
as $fn$
  with circle as (
    select auth.uid() as uid
    union
    select f.following_id
      from public.follows f
     where f.follower_id = auth.uid()
  ),
  aux_won as (
    select r.champion_id as uid, count(*)::int as score
      from public.aux_rooms r
     where r.status = 'finished'
       and r.champion_id is not null
       and r.champion_id in (select uid from circle)
       and coalesce(r.finished_at, r.created_at) >= p_since
       and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, r.champion_id)
     group by r.champion_id
  ),
  reviewed as (
    select rv.user_id as uid, count(*)::int as score
      from public.reviews rv
     where rv.user_id in (select uid from circle)
       and rv.is_published
       and rv.created_at >= p_since
     group by rv.user_id
  ),
  liked as (
    select rv.user_id as uid, count(*)::int as score
      from public.review_likes rl
      join public.reviews rv on rv.id = rl.review_id
     where rv.user_id in (select uid from circle)
       and rl.created_at >= p_since
     group by rv.user_id
  ),
  unioned as (
    select 'aux'::text     as metric, uid, score from aux_won
    union all
    select 'reviews'::text as metric, uid, score from reviewed
    union all
    select 'likes'::text   as metric, uid, score from liked
  ),
  ranked as (
    select u.metric,
           u.uid,
           u.score,
           row_number() over (
             partition by u.metric
             order by u.score desc, u.uid
           ) as rnk
      from unioned u
     where u.score > 0
  )
  select r.metric,
         r.rnk::int,
         p.id,
         p.username,
         p.display_name,
         p.avatar_url,
         p.role,
         r.score
    from ranked r
    join public.profiles p on p.id = r.uid
   where r.rnk <= greatest(1, least(coalesce(p_limit, 3), 10))
   order by r.metric, r.rnk;
$fn$;

-- auth.uid()-scoped, so signed-out callers would only ever get an
-- empty circle — no reason to grant anon.
revoke all on function public.social_week_leaders(timestamptz, integer) from public, anon;
grant execute on function public.social_week_leaders(timestamptz, integer) to authenticated;

notify pgrst, 'reload schema';
