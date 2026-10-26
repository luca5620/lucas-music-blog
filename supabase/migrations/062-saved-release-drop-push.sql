-- ============================================================
-- Migration 062 — "Save for later" release-day push (2026-10-25)
-- Run in the Supabase SQL Editor AFTER 060 and 061. Safe to re-run.
-- Nothing to paste in: the push secret is copied from the 060 job.
--
-- WHAT IT DOES
-- "Save for later" is the old release follow (release_follows) with a
-- new name and a job. When a record you saved comes out, you get ONE
-- push at the drop moment — midnight Eastern, when Spotify/Apple flip
-- it on (lib/upcoming.ts rule):
--     "Out now: <title>"
--     "<artist> · you saved it. Be one of the first to rate it."
-- Two or more of your saves on the same day → still one push:
--     "<title> + 2 more you saved"
-- Tapping it opens the record (or your Saved tab when there are more).
-- Records you already rated are skipped.
--
-- WHY THESE RULES (growth-marketing skill: a push has to be something
-- the person asked for, at the moment it matters):
--   • Only records YOU saved. Nobody gets a push about a stranger's pick.
--   • At the drop moment, because that's when fans are listening and
--     the release room fills up. (US west coast: 9pm. Europe: early
--     morning, sits on the lock screen until they wake up.)
--   • At most one per person per day: push_drops_sent's primary key.
--
-- HOW IT'S WIRED — same shape as 055 / 060:
--   pg_cron → public.send_saved_drop_pushes()
--     → records who's getting one in push_drops_sent
--     → POSTs { "type": "DROP", "drops": [...] } in batches of 50
--     → edge function push-recap (now handles DROP too) looks up
--       devices + language and sends through APNs.
--
-- After running: redeploy push-recap (it learned the DROP message).
-- Preview without sending:  select * from public.saved_drop_candidates();
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ------------------------------------------------------------
-- 0. The push secret, kept in private.app_secrets (061) instead of
--    being pasted into every function. Copied out of 060's sender,
--    which already has the real value — so this file never holds it
--    (the repo is public).
-- ------------------------------------------------------------
do $$
declare
  v_secret text;
begin
  select (regexp_match(p.prosrc, '''x-push-secret'',\s*''([^'']+)'''))[1]
    into v_secret
    from pg_proc p
   where p.proname = 'send_sotd_streak_savers'
   limit 1;

  if v_secret is null or v_secret like '\_\_%' then
    raise exception 'Could not find the push secret in send_sotd_streak_savers (run 060 first).';
  end if;

  insert into private.app_secrets (name, value)
  values ('push_webhook', v_secret)
  on conflict (name) do update set value = excluded.value;
end;
$$;


-- ------------------------------------------------------------
-- 1. The "already sent" ledger — one row per person per drop day.
-- ------------------------------------------------------------
create table if not exists public.push_drops_sent (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- The Eastern date the records dropped on.
  day        date not null,
  -- Which saves the push was about (first one = the one named).
  release_ids uuid[] not null,
  created_at timestamptz not null default now(),
  primary key (user_id, day)
);

-- RLS on with NO policies: only the security-definer functions below
-- (and the dashboard) touch it.
alter table public.push_drops_sent enable row level security;


-- ------------------------------------------------------------
-- 2. Who'd get one right now — computed, not sent.
--    { user_id, username, title, artist, slug, more, release_ids }
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
    select (now() at time zone 'America/New_York')::date as d
  ),
  -- Saves of records whose release day is today (Eastern), by people
  -- with an iOS device, who haven't rated the record yet.
  hits as (
    select f.follower_id as user_id, r.id as release_id, r.title, r.slug,
           a.name as artist, f.created_at
      from public.release_follows f
      join public.releases r on r.id = f.release_id
      left join public.artists a on a.id = r.primary_artist_id
     where r.release_date = (select d from today)
       and exists (select 1 from public.push_tokens t
                    where t.user_id = f.follower_id and t.platform = 'ios')
       and not exists (select 1 from public.reviews v
                        where v.user_id = f.follower_id and v.release_id = r.id)
  ),
  -- One row per person: the record they saved FIRST gets named.
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
-- 3. The sender — what pg_cron runs.
--   p_force     → skip the "is it midnight in New York?" check
--   p_only_user → only this person (testing on yourself)
-- Returns how many people were queued.
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
  -- Cron fires at 04:05 AND 05:05 UTC (12:05am Eastern in summer /
  -- winter); only the run that lands on 00:xx New York time proceeds.
  if not p_force and extract(hour from v_local) <> 0 then
    return 0;
  end if;

  select value into v_secret from private.app_secrets where name = 'push_webhook';
  if v_secret is null then
    return 0;
  end if;

  -- Record first, send second (same guard as 055 / 060).
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
-- 4. The schedule. '5 4,5 * * *' = 04:05 and 05:05 UTC every day.
--    Re-running this file replaces the job cleanly.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'saved-drop-push') then
    perform cron.unschedule('saved-drop-push');
  end if;
end;
$$;

select cron.schedule(
  'saved-drop-push',
  '5 4,5 * * *',
  $$select public.send_saved_drop_pushes();$$
);


-- ------------------------------------------------------------
-- Verify (should return one row each):
--   select jobname, schedule from cron.job where jobname = 'saved-drop-push';
--   select name from private.app_secrets where name = 'push_webhook';
-- Did it work? (pushes sent vs. records rated that day)
--   select x.day, count(*) as sent from public.push_drops_sent x
--    group by 1 order by 1 desc;
-- ------------------------------------------------------------
