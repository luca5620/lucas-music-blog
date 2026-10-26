-- ============================================================
-- Migration 063 — "Your Rewind is ready" push (2026-10-25)
-- Run in the Supabase SQL Editor AFTER 062. Safe to re-run.
-- Nothing to paste in: it uses the push secret 062 stored.
--
-- WHAT IT DOES
-- Once a year, December 1 at 10am Eastern (7am Pacific, 4pm in most of
-- Europe), everyone with the app on an iPhone and at least 3 records
-- rated that year gets ONE push:
--     "Your 2026 Rewind is ready"
--     "26 records, your top 10 and the numbers. Tap to watch."
-- Tapping it opens /rewind. 3 records is the same bar /rewind uses
-- (fewer → "Not enough to rewind yet"), so nobody is sent to an empty
-- story. The home page also shows the Rewind card + one-time popup
-- (components/rewind/RewindPrompt.tsx) — this push is the nudge for
-- people who don't open the app that day.
--
-- HOW IT'S WIRED — same shape as 060 / 062:
--   pg_cron → public.send_rewind_pushes()
--     → records who's getting one in push_rewind_sent (one per year)
--     → POSTs { "type": "REWIND", "rewinds": [...] } in batches of 50
--     → edge function push-recap (already deployed with REWIND).
--
-- Preview without sending:  select * from public.rewind_push_candidates();
-- Test on yourself (sends now, once per year per person):
--   select public.send_rewind_pushes(true, '<your user id>');
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ------------------------------------------------------------
-- 1. The "already sent" ledger — one row per person per year.
-- ------------------------------------------------------------
create table if not exists public.push_rewind_sent (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  year       int  not null,
  created_at timestamptz not null default now(),
  primary key (user_id, year)
);

-- RLS on with NO policies: only the security-definer functions below
-- (and the dashboard) touch it.
alter table public.push_rewind_sent enable row level security;


-- ------------------------------------------------------------
-- 2. Who'd get one right now — computed, not sent.
--    { user_id, username, year, total }
--    A review belongs to its review_date, or to when it was created
--    when there's no review_date (same rule as lib/rewind.ts).
-- ------------------------------------------------------------
create or replace function public.rewind_push_candidates()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with
  yr as (
    select extract(year from now() at time zone 'America/New_York')::int as y
  ),
  counts as (
    select v.user_id, count(*) as total
      from public.reviews v
     where v.is_published
       and extract(year from coalesce(v.review_date, v.created_at::date))::int = (select y from yr)
       and exists (select 1 from public.push_tokens t
                    where t.user_id = v.user_id and t.platform = 'ios')
     group by v.user_id
    having count(*) >= 3
  )
  select jsonb_build_object(
           'user_id',  c.user_id,
           'username', p.username,
           'year',     (select y from yr),
           'total',    c.total
         )
    from counts c
    join public.profiles p on p.id = c.user_id;
$fn$;

revoke all on function public.rewind_push_candidates()
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 3. The sender — what pg_cron runs.
--   p_force     → skip the "is it December 1?" check
--   p_only_user → only this person (testing on yourself)
-- Returns how many people were queued.
-- ------------------------------------------------------------
create or replace function public.send_rewind_pushes(
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
  if not p_force and not (extract(month from v_local) = 12 and extract(day from v_local) = 1) then
    return 0;
  end if;

  select value into v_secret from private.app_secrets where name = 'push_webhook';
  if v_secret is null then
    return 0;
  end if;

  -- Record first, send second (same guard as 055 / 060 / 062).
  with cands as (
    select c
      from public.rewind_push_candidates() as c
     where p_only_user is null
        or (c ->> 'user_id')::uuid = p_only_user
  ),
  fresh as (
    insert into public.push_rewind_sent (user_id, year)
    select (c ->> 'user_id')::uuid, (c ->> 'year')::int
      from cands
    on conflict (user_id, year) do nothing
    returning user_id
  )
  select coalesce(jsonb_agg(c), '[]'::jsonb)
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
      body := jsonb_build_object('type', 'REWIND', 'rewinds', v_batch),
      timeout_milliseconds := 60000
    );
  end loop;

  return v_n;
end;
$fn$;

revoke all on function public.send_rewind_pushes(boolean, uuid)
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. The schedule. '0 15 1 12 *' = 15:00 UTC on December 1 =
--    10am Eastern (December is always standard time).
--    Re-running this file replaces the job cleanly.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'rewind-ready-push') then
    perform cron.unschedule('rewind-ready-push');
  end if;
end;
$$;

select cron.schedule(
  'rewind-ready-push',
  '0 15 1 12 *',
  $$select public.send_rewind_pushes();$$
);


-- ------------------------------------------------------------
-- Verify (should return one row):
--   select jobname, schedule from cron.job where jobname = 'rewind-ready-push';
-- After December 1 — how many went out:
--   select year, count(*) from public.push_rewind_sent group by 1;
-- ------------------------------------------------------------
