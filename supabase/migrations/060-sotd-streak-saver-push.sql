-- ============================================================
-- Migration 060 — the Song of the Day streak-saver push (2026-10-25)
-- Run in the Supabase SQL Editor AFTER 055 (it reuses 055's pg_cron
-- + pg_net setup and sends through the same push-recap function).
-- Safe to re-run.
--
-- WHAT IT DOES
-- Every evening at 6pm Pacific (9pm Eastern), anyone with the iOS app
-- and push turned on who
--   • has a Song of the Day streak of 3+ days, and
--   • hasn't picked today's song yet
-- gets ONE push, in their device's language:
--     "Your 12-day streak is about to end"
--     "Pick today's song of the day to keep it going."
-- Tapping it opens their own profile, where the picker lives.
--
-- WHY THESE RULES (from the growth-marketing skill — Duolingo's
-- streak-saver is the most proven re-engagement push there is, and
-- the discipline is what keeps it from becoming spam):
--   • 3+ days only: a 1–2 day streak isn't something people feel they
--     own yet; a push about it reads like nagging.
--   • Only when the streak is actually at risk (no pick today). Pick
--     early and you never hear from us.
--   • 6pm Pacific because the streak day is a PACIFIC day (migration
--     018: it resets at Pacific midnight). That leaves 6 hours to save
--     it, and it's 9pm on the US East Coast. (Europe gets it in the
--     small hours — same trade-off the reset itself already makes.)
--   • At most one a day: push_streak_saves_sent's primary key.
--
-- HOW IT'S WIRED — same shape as 055:
--   pg_cron → public.send_sotd_streak_savers()
--     → records who's getting one in push_streak_saves_sent
--     → POSTs { "type": "STREAK", "streaks": [...] } in batches of 50
--     → edge function push-recap (now handles STREAK too) looks up
--       devices + language and sends through APNs.
--
-- ⚠️ BEFORE / AFTER RUNNING — Luca's hands, in this order:
--   1. Replace __PUSH_WEBHOOK_SECRET__ below with the SAME value as in
--      032 / 055 (the PUSH_WEBHOOK_SECRET edge-function secret). It's
--      not in this file on purpose — the repo is public.
--   2. Redeploy push-recap (it learned the STREAK message):
--        supabase functions deploy push-recap --no-verify-jwt
--   3. Preview without sending anything:
--        select * from public.sotd_streak_saver_candidates();
--      Test-send to ONE person (yourself — only works if you have a
--      3+ streak and haven't picked today):
--        select public.send_sotd_streak_savers(true, '<your profile uuid>');
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ------------------------------------------------------------
-- 1. The "already sent" ledger — one row per person per Pacific day.
-- ------------------------------------------------------------
create table if not exists public.push_streak_saves_sent (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- The Pacific date the streak was at risk on (= public.pacific_today()
  -- at send time). The primary key is the double-send guard.
  day        date not null,
  -- The streak they were about to lose — handy for "did it work?":
  -- join to song_of_day on (user_id, picked_on = day) to see who saved it.
  streak     integer not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- RLS on with NO policies: only the security-definer functions below
-- (and the dashboard) touch it.
alter table public.push_streak_saves_sent enable row level security;


-- ------------------------------------------------------------
-- 2. Who'd get one right now — computed, not sent.
--    { user_id, username, streak } per person.
-- ------------------------------------------------------------
create or replace function public.sotd_streak_saver_candidates()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with
  -- Only people we can actually reach: an iOS device on file.
  recipients as (
    select distinct t.user_id
      from public.push_tokens t
     where t.platform = 'ios'
  ),
  -- Who picked YESTERDAY but not today: those are the only streaks
  -- that are alive and at risk. (Cheap pre-filter so get_sotd_streak
  -- only runs for a handful of people.)
  at_risk as (
    select u.user_id
      from recipients u
     where exists (select 1 from public.song_of_day s
                    where s.user_id = u.user_id
                      and s.picked_on = public.pacific_today() - 1)
       and not exists (select 1 from public.song_of_day s
                        where s.user_id = u.user_id
                          and s.picked_on = public.pacific_today())
  ),
  scored as (
    select a.user_id, p.username, public.get_sotd_streak(a.user_id) as streak
      from at_risk a
      join public.profiles p on p.id = a.user_id
  )
  select jsonb_build_object(
           'user_id',  s.user_id,
           'username', s.username,
           'streak',   s.streak
         )
    from scored s
   where s.streak >= 3;
$fn$;

revoke all on function public.sotd_streak_saver_candidates()
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 3. The sender — what pg_cron runs.
--   p_force     → skip the "is it 6pm in Los Angeles?" check
--   p_only_user → only this person (testing on yourself)
-- Returns how many people were queued.
-- ------------------------------------------------------------
create or replace function public.send_sotd_streak_savers(
  p_force     boolean default false,
  p_only_user uuid    default null
)
returns integer
language plpgsql
security definer
set search_path = public, net
as $fn$
declare
  v_local timestamp := now() at time zone 'America/Los_Angeles';
  v_all   jsonb;
  v_batch jsonb;
  v_n     integer;
  v_i     integer;
begin
  -- Cron fires at 01:00 AND 02:00 UTC (6pm Pacific in summer / winter);
  -- only the run that lands on 18:xx Los Angeles time proceeds.
  if not p_force and extract(hour from v_local) <> 18 then
    return 0;
  end if;

  -- Record first, send second (same guard as 055): v_all only holds
  -- people who weren't already recorded for today.
  with fresh as (
    insert into public.push_streak_saves_sent (user_id, day, streak)
    select (c ->> 'user_id')::uuid, public.pacific_today(), (c ->> 'streak')::int
      from public.sotd_streak_saver_candidates() as c
     where p_only_user is null
        or (c ->> 'user_id')::uuid = p_only_user
    on conflict (user_id, day) do nothing
    returning user_id, streak
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'user_id',  f.user_id,
           'username', p.username,
           'streak',   f.streak
         )), '[]'::jsonb)
    into v_all
    from fresh f
    join public.profiles p on p.id = f.user_id;

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
        'x-push-secret', '__PUSH_WEBHOOK_SECRET__'
      ),
      body := jsonb_build_object('type', 'STREAK', 'streaks', v_batch),
      timeout_milliseconds := 60000
    );
  end loop;

  return v_n;
end;
$fn$;

revoke all on function public.send_sotd_streak_savers(boolean, uuid)
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. The schedule. '0 1,2 * * *' = minute 0 of 01:00 and 02:00 UTC,
--    every day. Re-running this file replaces the job cleanly.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'sotd-streak-saver-push') then
    perform cron.unschedule('sotd-streak-saver-push');
  end if;
end;
$$;

select cron.schedule(
  'sotd-streak-saver-push',
  '0 1,2 * * *',
  $$select public.send_sotd_streak_savers();$$
);


-- ------------------------------------------------------------
-- Verify:
--   select jobname, schedule from cron.job
--    where jobname = 'sotd-streak-saver-push';      -- one row
--   select * from public.sotd_streak_saver_candidates();
-- Did it work? (pushes sent vs. streaks saved, per day)
--   select x.day, count(*) as sent,
--          count(s.user_id) as saved
--     from public.push_streak_saves_sent x
--     left join public.song_of_day s
--       on s.user_id = x.user_id and s.picked_on = x.day
--    group by 1 order by 1 desc;
-- ------------------------------------------------------------
