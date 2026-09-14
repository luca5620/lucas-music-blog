-- ============================================================
-- Migration 047 — hidden rooms count on the leaderboard again
-- (2026-09-14). Run in the SQL Editor after 046.
--
-- Luca's call: "allow hidden rooms to count towards the leaderboard."
--
-- WHAT 045 DID AND WHY IT'S BEING UNDONE. When "truly private"
-- (is_hidden) was split out of "private", the leaderboard was taught
-- to skip those rooms — the worry being that a result nobody outside
-- can see is the easiest one to cook. Two things make that worry a
-- bad trade:
--
--   1. It was already INCONSISTENT. `aux_wins_for` (migration 044) —
--      the WINS number on every PlayerChip and profile — never had a
--      hidden filter, because it predates the column. So a hidden win
--      already counted on your chip while silently not counting on
--      the leaderboard. Same win, two answers, no way for a player to
--      tell why. That's worse than either rule applied evenly.
--   2. The REAL anti-farming guard is untouched and stays:
--      `aux_self_judged` still throws out a win in a room where the
--      host both played and judged. That's the case 044 was actually
--      built to stop, and it applies everywhere — hidden or not.
--
-- So: the two `not r.is_hidden` lines come out, everything else in
-- the function is copied from 045 verbatim. A private war among
-- friends now counts the same as a public one.
--
-- Known and accepted (see ROADMAP): in a SMALL hidden room the crowd
-- voting is mostly the other players waiting their turn, so friends
-- can vote each other up the bracket. There is no setting yet that
-- says "players don't vote, spectators do" — that's the open idea,
-- not something this migration pretends to solve.
-- ============================================================

create or replace function public.aux_leaderboard(
  p_period text default 'all',
  p_limit integer default 10
)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  role         text,
  battles      integer,
  rounds       integer
)
language sql
stable
security definer set search_path = public
as $fn$
  with bounds as (
    select case when p_period = 'week'
                then now() - interval '7 days'
                else '-infinity'::timestamptz
           end as since
  ),
  champs as (
    select r.champion_id as uid, count(*)::int as battles
      from public.aux_rooms r
     cross join bounds b
     where r.status = 'finished'
       and r.champion_id is not null
       -- (047) the `not r.is_hidden` filter was here
       and coalesce(r.finished_at, r.created_at) >= b.since
       and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, r.champion_id)
     group by r.champion_id
  ),
  won_rounds as (
    select m.winner_id as uid, count(*)::int as rounds
      from public.aux_matches m
      join public.aux_rooms r on r.id = m.room_id
     cross join bounds b
     where m.status = 'done'
       and not m.is_bye
       and m.winner_id is not null
       -- (047) …and here
       and coalesce(m.created_at, r.created_at) >= b.since
       and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, m.winner_id)
     group by m.winner_id
  ),
  totals as (
    select coalesce(c.uid, w.uid) as uid,
           coalesce(c.battles, 0) as battles,
           coalesce(w.rounds, 0)  as rounds
      from champs c
      full outer join won_rounds w on w.uid = c.uid
  )
  select p.id, p.username, p.display_name, p.avatar_url, p.role,
         t.battles, t.rounds
    from totals t
    join public.profiles p on p.id = t.uid
   where t.battles > 0 or t.rounds > 0
   order by t.battles desc, t.rounds desc, p.username asc
   limit greatest(1, least(coalesce(p_limit, 10), 50));
$fn$;

revoke all on function public.aux_leaderboard(text, integer) from public;
grant execute on function public.aux_leaderboard(text, integer) to anon, authenticated;

-- The leaderboard only ever returns a NAME and two COUNTS, never a
-- room, so counting hidden rooms leaks nothing about what happened
-- inside one or who was in it.

notify pgrst, 'reload schema';
