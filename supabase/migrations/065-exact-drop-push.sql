-- ============================================================
-- Migration 065 — saved-record push waits for the EXACT drop time
-- (2026-10-26). Run in the Supabase SQL Editor AFTER 064. Safe to
-- re-run. Nothing to paste in.
--
-- WHY (Luca 2026-10-26: "why not just have the accurate countdown?
-- its literally right there in the spotify api preview thing"):
-- Spotify's embed page carries each pre-release record's exact drop
-- moment (BREAK EVEN: 2026-10-26 09:00 UTC = 5am ET / 6pm Korea). The
-- drop-check edge function now saves it in releases.drops_at, so
-- drops_at can be a time still AHEAD. 064's push check read "drops_at
-- set but in the future, no waiting report" as out; now a future
-- drops_at means "not yet", full stop.
-- Only saved_drop_candidates() changes — the sender and both cron
-- jobs from 064 stay as they are.
-- ============================================================

create or replace function public.saved_drop_candidates()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with
  today as (
    select (now() at time zone 'America/New_York')::date as d,
           ((now() at time zone 'America/New_York')::date::timestamp
              at time zone 'America/New_York') as midnight
  ),
  hits as (
    select f.follower_id as user_id, r.id as release_id, r.title, r.slug,
           a.name as artist, f.created_at
      from public.release_follows f
      join public.releases r on r.id = f.release_id
      left join public.artists a on a.id = r.primary_artist_id
     cross join today
     where r.release_date = today.d
       -- Really out. With an exact drop time (Spotify's own, 065): that
       -- time has passed. Without one: no fresh "not yet" report (no
       -- Spotify link, or the checker went quiet).
       and (
             (r.drops_at is not null and r.drops_at <= now())
          or (r.drops_at is null and not (
                   r.drop_waiting_at is not null
               and r.drop_waiting_at >= today.midnight - interval '15 minutes'
               and r.drop_waiting_at >  now() - interval '30 minutes'
                 ))
           )
       -- Saved before it dropped (midnight ET, or the later moment
       -- Spotify switched it on; greatest() skips a null drops_at).
       and f.created_at < greatest(r.drops_at, today.midnight)
       and exists (select 1 from public.push_tokens t
                    where t.user_id = f.follower_id and t.platform = 'ios')
       and not exists (select 1 from public.reviews v
                        where v.user_id = f.follower_id and v.release_id = r.id)
  ),
  grouped as (
    select user_id,
           (array_agg(title   order by created_at))[1] as title,
           (array_agg(slug    order by created_at))[1] as slug,
           (array_agg(artist  order by created_at))[1] as artist,
           array_agg(release_id order by created_at)   as release_ids,
           count(*) - 1                                 as more
      from hits
     group by user_id
  )
  select jsonb_build_object(
           'user_id',     g.user_id,
           'username',    p.username,
           'title',       g.title,
           'artist',      coalesce(g.artist, ''),
           'slug',        g.slug,
           'more',        g.more,
           'release_ids', to_jsonb(g.release_ids)
         )
    from grouped g
    join public.profiles p on p.id = g.user_id;
$fn$;

revoke all on function public.saved_drop_candidates()
  from public, anon, authenticated;
