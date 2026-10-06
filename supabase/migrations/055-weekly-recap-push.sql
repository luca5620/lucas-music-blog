-- ============================================================
-- Migration 055 — the Sunday recap push (2026-10-05)
-- Run in the Supabase SQL Editor AFTER 052 (the push-recap function
-- it calls reads push_tokens.locale, which 052 adds). Safe to re-run.
-- (053/054 are other sessions' numbers — the order between them and
-- this file doesn't matter.)
--
-- WHAT IT DOES
-- Every Sunday at 6pm US Eastern, everyone with the iOS app and push
-- turned on who had a week gets ONE push:
--     "Your week in music"
--     "You rated 4 records (avg 7.8, top: "Blonde" 9.4) · your
--      reviews got 12 likes · 3 new followers"
-- in their device's language (push_tokens.locale, migration 052).
-- Tapping it opens their own profile.
--
-- Someone who had a quiet week but WAS around in the last 30 days
-- gets a gentle nudge instead ("Anything on repeat this week? Give it
-- a rating before Monday." → opens /reviews/new) — at most once every
-- four weeks. Someone gone for more than 30 days gets nothing: a push
-- from an app you stopped using is how apps get their notifications
-- switched off.
--
-- HOW IT'S WIRED (no new servers — this is the first scheduler in
-- the project, so it's all inside Supabase):
--   pg_cron (Postgres' built-in scheduler)
--     → public.send_weekly_recaps()  works out each person's week,
--        writes it to push_recaps_sent (the "already sent" ledger),
--        and POSTs the new rows in batches of 50 via pg_net
--     → edge function `push-recap`  looks up devices + language,
--        writes the copy, sends through APNs (same code as
--        push-fanout, shared in supabase/functions/_shared/).
-- Recaps are NOT rows in `notifications` — that table's rows always
-- have someone else as the actor (025), and a weekly digest isn't a
-- bell event.
--
-- TIMEZONE CHOICE: 6pm America/New_York — Sunday evening for the US,
-- late Sunday night in Europe, before the Monday that resets things.
-- One send time for everyone (the app doesn't know anyone's timezone).
-- pg_cron on Supabase runs in UTC, and 6pm Eastern is 22:00 UTC in
-- summer (EDT) but 23:00 UTC in winter (EST) — so the job fires at
-- BOTH 22:00 and 23:00 UTC on Sundays, and the function itself only
-- proceeds when it's actually the 18:00 hour in New York. Daylight
-- saving is handled by Postgres' timezone database, nothing to edit
-- twice a year.
--
-- THE WEEK: a rolling 7 days ending at the moment of sending. Because
-- sends are a week apart at the same local time, consecutive windows
-- tile with no gap and no overlap (give or take the DST hour).
--
-- NEVER TWICE: push_recaps_sent has one row per (person, week) —
-- "week" being the New York date of that Sunday — and a person's row
-- is written BEFORE their push is sent, with ON CONFLICT DO NOTHING.
-- Running the job twice (or both cron slots somehow passing the hour
-- check) finds everyone already recorded and sends nothing. The trade:
-- if APNs/the function is down at that moment, that week's recap is
-- simply skipped for them — never doubled.
--
-- ⚠️ BEFORE / AFTER RUNNING — Luca's hands, in this order:
--   1. pg_cron must be enabled. The `create extension` below usually
--      does it; if it errors with a permissions message, enable it in
--      the dashboard (Database → Extensions → search "pg_cron" →
--      enable) and run this file again.
--   2. Replace __PUSH_WEBHOOK_SECRET__ below with the SAME value as in
--      032 / the edge-function secret PUSH_WEBHOOK_SECRET. It's not in
--      this file on purpose — the repo is public.
--   3. Deploy the function (it does NOT ship with Vercel):
--        supabase functions deploy push-recap --no-verify-jwt
--      (secrets are project-wide; push-fanout's APNS_* and
--      PUSH_WEBHOOK_SECRET already cover it.)
--   4. Preview without sending anything:
--        select * from public.weekly_recap_candidates();
--      Test-send to ONE person (yourself) right now:
--        select public.send_weekly_recaps(true, '<your profile uuid>');
--      ⚠️ that uses up YOUR recap for today's date; if you test on a
--      Sunday, clear it before 6pm so the real one still goes out:
--        delete from public.push_recaps_sent
--         where user_id = '<your profile uuid>'
--           and week = (now() at time zone 'America/New_York')::date;
-- ============================================================

-- The scheduler. On Supabase this lives in its own `cron` schema.
create extension if not exists pg_cron;
-- Outbound HTTP from Postgres (already enabled by 032; harmless here).
create extension if not exists pg_net;


-- ------------------------------------------------------------
-- 1. The "already sent" ledger.
-- ------------------------------------------------------------
create table if not exists public.push_recaps_sent (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- The New York calendar date of the Sunday it went out. One row per
  -- person per week is the double-send guard (the primary key).
  week       date not null,
  -- 'recap' = they had a week; 'nudge' = quiet week, gentle prod.
  kind       text not null check (kind in ('recap', 'nudge')),
  -- Exactly what was sent to push-recap — handy for "why did I get
  -- this?" debugging, and the nudge-rarity check reads `kind`.
  payload    jsonb not null,
  created_at timestamptz not null default now(),
  primary key (user_id, week)
);

-- "When did this person last get a nudge?"
create index if not exists idx_push_recaps_sent_user_kind
  on public.push_recaps_sent (user_id, kind, created_at desc);

-- RLS on with NO policies: nobody using the app can read or write
-- this. Only the security-definer functions below (and the dashboard)
-- touch it.
alter table public.push_recaps_sent enable row level security;


-- ------------------------------------------------------------
-- 2. Who gets what this week — computed, not sent.
--
-- Returns one jsonb object per person who should get a push:
--   { user_id, kind, username, rated, avg_rating, top_title,
--     top_rating, likes, new_followers }
-- which is exactly the shape push-recap reads (RecapStats in
-- supabase/functions/_shared/push-copy.ts — keep them in step).
--
-- Separate from the sender so it can be previewed safely:
--   select * from public.weekly_recap_candidates();
-- ------------------------------------------------------------
create or replace function public.weekly_recap_candidates(
  p_since timestamptz default now() - interval '7 days'
)
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
  -- Their published reviews (= ratings) from the window.
  week_reviews as (
    select r.user_id, r.title, r.rating, r.created_at
      from public.reviews r
      join recipients u on u.user_id = r.user_id
     where r.is_published
       and r.created_at >= p_since
  ),
  rated as (
    select w.user_id,
           count(*)::int           as n,
           round(avg(w.rating), 1) as avg_rating
      from week_reviews w
     group by w.user_id
  ),
  -- The week's best: highest rating, most recent breaks a tie.
  top_pick as (
    select distinct on (w.user_id) w.user_id, w.title, w.rating
      from week_reviews w
     order by w.user_id, w.rating desc, w.created_at desc
  ),
  -- Likes OTHER people left on their reviews this week (any review,
  -- old or new — a like on last year's review still counts).
  likes as (
    select r.user_id, count(*)::int as n
      from public.review_likes l
      join public.reviews r on r.id = l.review_id
      join recipients u on u.user_id = r.user_id
     where l.created_at >= p_since
       and l.user_id <> r.user_id
     group by r.user_id
  ),
  new_followers as (
    select f.following_id as user_id, count(*)::int as n
      from public.follows f
      join recipients u on u.user_id = f.following_id
     where f.created_at >= p_since
     group by f.following_id
  ),
  stats as (
    select u.user_id,
           p.username,
           coalesce(rt.n, 0)  as rated,
           rt.avg_rating,
           tp.title           as top_title,
           tp.rating          as top_rating,
           coalesce(lk.n, 0)  as likes,
           coalesce(nf.n, 0)  as new_followers
      from recipients u
      join public.profiles p on p.id = u.user_id
      left join rated rt         on rt.user_id = u.user_id
      left join top_pick tp      on tp.user_id = u.user_id
      left join likes lk         on lk.user_id = u.user_id
      left join new_followers nf on nf.user_id = u.user_id
  ),
  decided as (
    select s.*,
      case
        -- Anything happened → the recap.
        when s.rated > 0 or s.likes > 0 or s.new_followers > 0 then 'recap'
        -- Quiet week. Nudge ONLY someone who was around in the last
        -- 30 days (rated, commented or liked something) AND hasn't
        -- had a nudge in the last four weeks. 27 days, not 28, so the
        -- every-4th-Sunday cadence isn't lost to a few minutes' drift
        -- in send time.
        when (
               exists (select 1 from public.reviews r
                        where r.user_id = s.user_id
                          and r.created_at >= now() - interval '30 days')
            or exists (select 1 from public.comments c
                        where c.user_id = s.user_id
                          and c.created_at >= now() - interval '30 days')
            or exists (select 1 from public.review_likes l
                        where l.user_id = s.user_id
                          and l.created_at >= now() - interval '30 days')
             )
         and not exists (select 1 from public.push_recaps_sent x
                          where x.user_id = s.user_id
                            and x.kind = 'nudge'
                            and x.created_at >= now() - interval '27 days')
          then 'nudge'
        -- Gone a month+ → leave them alone.
        else null
      end as kind
      from stats s
  )
  select jsonb_build_object(
           'user_id',       d.user_id,
           'kind',          d.kind,
           'username',      d.username,
           'rated',         d.rated,
           'avg_rating',    d.avg_rating,
           'top_title',     d.top_title,
           'top_rating',    d.top_rating,
           'likes',         d.likes,
           'new_followers', d.new_followers
         )
    from decided d
   where d.kind is not null;
$fn$;

-- Never callable from the app: it reads everyone's activity.
revoke all on function public.weekly_recap_candidates(timestamptz)
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 3. The sender — what pg_cron runs.
--
--   p_force     → skip the "is it 6pm Sunday in New York?" check
--                 (manual runs / testing).
--   p_only_user → only this person (testing on yourself).
-- Returns how many people were queued.
-- ------------------------------------------------------------
create or replace function public.send_weekly_recaps(
  p_force     boolean default false,
  p_only_user uuid    default null
)
returns integer
language plpgsql
security definer
set search_path = public, net
as $fn$
declare
  v_local timestamp := now() at time zone 'America/New_York';
  v_week  date      := (now() at time zone 'America/New_York')::date;
  v_all   jsonb;
  v_batch jsonb;
  v_n     integer;
  v_i     integer;
begin
  -- The cron fires at 22:00 AND 23:00 UTC every Sunday (see the
  -- header); only the one that lands on 18:xx New York time proceeds.
  -- isodow 7 = Sunday.
  if not p_force and not (
       extract(isodow from v_local) = 7
       and extract(hour from v_local) = 18
     ) then
    return 0;
  end if;

  -- Record first, send second. ON CONFLICT DO NOTHING + RETURNING
  -- means v_all holds ONLY people who weren't already recorded for
  -- this week — the whole double-send guard in one statement.
  with fresh as (
    insert into public.push_recaps_sent (user_id, week, kind, payload)
    select (c ->> 'user_id')::uuid, v_week, c ->> 'kind', c
      from public.weekly_recap_candidates(now() - interval '7 days') as c
     where p_only_user is null
        or (c ->> 'user_id')::uuid = p_only_user
    on conflict (user_id, week) do nothing
    returning payload
  )
  select coalesce(jsonb_agg(payload), '[]'::jsonb) into v_all from fresh;

  v_n := jsonb_array_length(v_all);
  if v_n = 0 then
    return 0;
  end if;

  -- Batches of 50 people per call, so no single edge-function run has
  -- to push to the whole userbase before it times out.
  for v_i in 0 .. (v_n - 1) / 50 loop
    select jsonb_agg(e.value order by e.ord)
      into v_batch
      from jsonb_array_elements(v_all) with ordinality as e(value, ord)
     where e.ord >  v_i * 50
       and e.ord <= (v_i + 1) * 50;

    -- Fire-and-forget, like 032: pg_net queues it and returns
    -- immediately. 60s timeout (pg_net's default is 5s) because a
    -- batch is up to 50 people × their devices.
    perform net.http_post(
      url := 'https://qhbtfhyzbiwqwaxtetgd.supabase.co/functions/v1/push-recap',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-push-secret', '__PUSH_WEBHOOK_SECRET__'
      ),
      body := jsonb_build_object('type', 'RECAP', 'recaps', v_batch),
      timeout_milliseconds := 60000
    );
  end loop;

  return v_n;
end;
$fn$;

revoke all on function public.send_weekly_recaps(boolean, uuid)
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. The schedule. Re-running this file replaces the job cleanly.
--    '0 22,23 * * 0' = minute 0 of 22:00 and 23:00 UTC, Sundays.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'weekly-recap-push') then
    perform cron.unschedule('weekly-recap-push');
  end if;
end;
$$;

select cron.schedule(
  'weekly-recap-push',
  '0 22,23 * * 0',
  $$select public.send_weekly_recaps();$$
);


-- ------------------------------------------------------------
-- Verify:
--   select jobname, schedule, command from cron.job
--    where jobname = 'weekly-recap-push';            -- one row
--   select * from public.weekly_recap_candidates();  -- this week's pushes
-- After the first Sunday:
--   select week, kind, count(*) from public.push_recaps_sent
--    group by 1, 2 order by 1 desc;
--   select status, error_msg, start_time from cron.job_run_details
--    order by start_time desc limit 5;
--   select status_code, content from net._http_response
--    order by created desc limit 5;                 -- push-recap's answers
-- ------------------------------------------------------------
