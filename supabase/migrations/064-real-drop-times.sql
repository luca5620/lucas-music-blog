-- ============================================================
-- Migration 064 — real drop times (2026-10-25)
-- Run in the Supabase SQL Editor AFTER 062. Safe to re-run.
-- Nothing to paste in: the secret comes from private.app_secrets (062).
--
-- WHY (Luca 2026-10-25): every record used to count as "out now" at
-- midnight Eastern. Not everything drops then — ILLIT's BREAK EVEN
-- said "out now" at midnight ET while K-pop comes out at 6pm Korea
-- time (5am ET), so it sat there "out" for hours, unplayable.
--
-- WHAT IT DOES
--   1. Two new columns on releases:
--        drops_at         when Spotify was first seen playing it
--        drop_waiting_at  the last time it was checked and NOT out yet
--   2. A pg_cron job ('drop-check', every 5 minutes) that calls the
--      drop-check edge function, which asks Spotify and fills those in
--      for records dropping today or tomorrow (Eastern).
--   3. The "a record you saved is out" push (062) now waits for the
--      record to really be out, instead of firing at 12:05am Eastern
--      no matter what. It runs every 5 minutes; push_drops_sent still
--      means one push per person per day at most.
--
-- The site (lib/upcoming.ts) shows "Later today" past midnight ET
-- while Spotify says it's not playable. If the checker ever stops,
-- the waiting reports go stale after 30 minutes and everything falls
-- back to the old midnight rule — same 30 minutes here in SQL.
--
-- After running: deploy the drop-check function (see its header).
-- Check it:   select title, release_date, drops_at, drop_waiting_at
--               from public.releases
--              where release_date >= (now() at time zone 'America/New_York')::date
--              order by release_date limit 20;
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ------------------------------------------------------------
-- 1. The two drop facts. Public like every other catalog column
--    (the existing releases select policy covers them).
-- ------------------------------------------------------------
alter table public.releases
  add column if not exists drops_at timestamptz,
  add column if not exists drop_waiting_at timestamptz;


-- ------------------------------------------------------------
-- 2. Saved-record push candidates — same as 062, plus "is it really
--    out?" and "did they save it before it dropped?" (saving a record
--    that's already out shouldn't get you an "Out now" push).
-- ------------------------------------------------------------
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
       -- Really out: Spotify was seen playing it, OR there's no fresh
       -- "not yet" report (no Spotify link, or the checker went quiet).
       and (
             (r.drops_at is not null and r.drops_at <= now())
          or not (
                   r.drop_waiting_at is not null
               and r.drop_waiting_at >= today.midnight - interval '15 minutes'
               and r.drop_waiting_at >  now() - interval '30 minutes'
                 )
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


-- ------------------------------------------------------------
-- 3. The sender — same as 062 minus the "only at 00:xx New York"
--    check: it now runs every 5 minutes, and the candidates above
--    decide what's out. push_drops_sent stops any repeat.
--    (p_force is kept so old test calls still work; it does nothing.)
-- ------------------------------------------------------------
create or replace function public.send_saved_drop_pushes(
  p_force     boolean default false,
  p_only_user uuid    default null
)
returns integer
language plpgsql
security definer
set search_path = public, net
as $fn$
declare
  v_local  timestamp := now() at time zone 'America/New_York';
  v_secret text;
  v_all    jsonb;
  v_batch  jsonb;
  v_n      integer;
  v_i      integer;
begin
  select value into v_secret from private.app_secrets where name = 'push_webhook';
  if v_secret is null then
    return 0;
  end if;

  with cands as (
    select c
      from public.saved_drop_candidates() as c
     where p_only_user is null
        or (c ->> 'user_id')::uuid = p_only_user
  ),
  fresh as (
    insert into public.push_drops_sent (user_id, day, release_ids)
    select (c ->> 'user_id')::uuid,
           v_local::date,
           array(select jsonb_array_elements_text(c -> 'release_ids')::uuid)
      from cands
    on conflict (user_id, day) do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(c - 'release_ids'), '[]'::jsonb)
    into v_all
    from cands
   where (c ->> 'user_id')::uuid in (select user_id from fresh);

  v_n := jsonb_array_length(v_all);
  if v_n = 0 then
    return 0;
  end if;

  for v_i in 0 .. (v_n - 1) / 50 loop
    select jsonb_agg(e.value order by e.ord)
      into v_batch
      from jsonb_array_elements(v_all) with ordinality as e(value, ord)
     where e.ord >  v_i * 50
       and e.ord <= (v_i + 1) * 50;

    perform net.http_post(
      url := 'https://qhbtfhyzbiwqwaxtetgd.supabase.co/functions/v1/push-recap',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', v_secret
      ),
      body := jsonb_build_object('type', 'DROP', 'drops', v_batch),
      timeout_milliseconds := 60000
    );
  end loop;

  return v_n;
end;
$fn$;

revoke all on function public.send_saved_drop_pushes(boolean, uuid)
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. The checker's caller — POSTs to the drop-check edge function.
-- ------------------------------------------------------------
create or replace function public.run_drop_check()
returns void
language plpgsql
security definer
set search_path = public, net
as $fn$
declare
  v_secret text;
begin
  select value into v_secret from private.app_secrets where name = 'push_webhook';
  if v_secret is null then
    return;
  end if;
  perform net.http_post(
    url := 'https://qhbtfhyzbiwqwaxtetgd.supabase.co/functions/v1/drop-check',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', v_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
end;
$fn$;

revoke all on function public.run_drop_check()
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 5. The schedules. Checker on the 5s (:00, :05 …), push two minutes
--    after (:02, :07 …) so it sees the fresh answer.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'saved-drop-push') then
    perform cron.unschedule('saved-drop-push');
  end if;
  if exists (select 1 from cron.job where jobname = 'drop-check') then
    perform cron.unschedule('drop-check');
  end if;
end;
$$;

select cron.schedule(
  'drop-check',
  '*/5 * * * *',
  $$select public.run_drop_check();$$
);

select cron.schedule(
  'saved-drop-push',
  '2-59/5 * * * *',
  $$select public.send_saved_drop_pushes();$$
);


-- ------------------------------------------------------------
-- Verify (two rows):
--   select jobname, schedule from cron.job
--    where jobname in ('drop-check', 'saved-drop-push');
-- Did the checker answer? (newest first — want "checked N: …")
--   select status_code, content from net._http_response
--    order by created desc limit 5;
-- ------------------------------------------------------------
