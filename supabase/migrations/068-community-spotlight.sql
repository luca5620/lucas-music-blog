-- ============================================================
-- Migration 068 — Community Spotlight (2026-10-30)
-- Run in the Supabase SQL Editor. Safe to re-run.
-- Nothing to paste in: the Monday push uses the push secret 062 stored.
--
-- WHAT IT IS
-- One album a week that everyone listens to, rates and talks about
-- (idea from michorex on Discord, 2026-10-30: people join, rate a few
-- things alone and drift off — 189 of the 203 records reviewed in the
-- last 30 days had exactly ONE review, so nobody ever overlapped).
--
--   • spotlight_weeks — one row per week: the record + Luca's
--     "why this one" note. Weeks run Monday 00:00 → next Monday 00:00
--     New York time; the trigger below works the times out from the
--     Monday you pick, so the admin page only sends a date.
--   • Home page: the sleeve section (components/spotlight/SpotlightShelf).
--   • Album page, during its week: the record label (members' score on
--     the LP, yours on a 7" single, hidden as ?.? until you rate).
--   • Monday 10am New York: ONE push to everyone with the app on an
--     iPhone who hasn't rated that record yet.
--
-- HOW THE PUSH IS WIRED — same shape as 060 / 062 / 063:
--   pg_cron → public.send_spotlight_pushes()
--     → records who's getting one in push_spotlight_sent (one per week)
--     → POSTs { "type": "SPOTLIGHT", "spotlights": [...] } in batches
--     → edge function push-recap (REDEPLOY it — SPOTLIGHT is new):
--         npx supabase functions deploy push-recap --no-verify-jwt --project-ref qhbtfhyzbiwqwaxtetgd
--
-- Preview without sending:  select * from public.spotlight_push_candidates();
-- Test on yourself (sends now, once per week per person):
--   select public.send_spotlight_pushes(true, '<your user id>');
-- ============================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;


-- ------------------------------------------------------------
-- 1. The weeks.
-- ------------------------------------------------------------
create table if not exists public.spotlight_weeks (
  id          uuid primary key default gen_random_uuid(),
  release_id  uuid not null references public.releases(id) on delete cascade,
  -- The Monday the week starts on (New York calendar). One pick per week.
  week_start  date not null unique,
  -- Filled in by the trigger below — never sent by the app.
  starts_at   timestamptz not null default now(),
  ends_at     timestamptz not null default now(),
  -- Luca's one line on why this record. Optional.
  note        text check (note is null or char_length(note) <= 280),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index if not exists idx_spotlight_weeks_window
  on public.spotlight_weeks (starts_at, ends_at);

-- Monday midnight in New York → the exact instant, DST and all.
-- week_start is forced back to its Monday, so a mis-picked Wednesday
-- still makes a clean Monday-to-Monday week.
create or replace function public.spotlight_weeks_set_window()
returns trigger
language plpgsql
as $fn$
begin
  new.week_start := new.week_start - ((extract(isodow from new.week_start)::int) - 1);
  new.starts_at  := (new.week_start::timestamp) at time zone 'America/New_York';
  new.ends_at    := ((new.week_start + 7)::timestamp) at time zone 'America/New_York';
  return new;
end;
$fn$;

drop trigger if exists trg_spotlight_weeks_window on public.spotlight_weeks;
create trigger trg_spotlight_weeks_window
  before insert or update of week_start on public.spotlight_weeks
  for each row execute function public.spotlight_weeks_set_window();

alter table public.spotlight_weeks enable row level security;

-- Everyone (signed out too) can see the spotlight — it's on the home page.
drop policy if exists "Spotlight: anyone reads" on public.spotlight_weeks;
create policy "Spotlight: anyone reads"
  on public.spotlight_weeks for select
  using (true);

-- Only owners/admins who signed in with the emailed code pick weeks
-- (same rule as every admin tool: 021's session_used_email_code).
drop policy if exists "Spotlight: staff writes" on public.spotlight_weeks;
create policy "Spotlight: staff writes"
  on public.spotlight_weeks for all
  using (
    public.session_used_email_code()
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  )
  with check (
    public.session_used_email_code()
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  );


-- ------------------------------------------------------------
-- 2. The "already sent" ledger — one row per person per week.
-- ------------------------------------------------------------
create table if not exists public.push_spotlight_sent (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  spotlight_id uuid not null references public.spotlight_weeks(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id, spotlight_id)
);

-- RLS on with NO policies: only the security-definer functions below
-- (and the dashboard) touch it.
alter table public.push_spotlight_sent enable row level security;


-- ------------------------------------------------------------
-- 3. Who'd get one right now — computed, not sent.
--    { user_id, username, spotlight_id, title, artist, slug }
--    Everyone with an iPhone token who hasn't already published a
--    rating of this week's record.
-- ------------------------------------------------------------
create or replace function public.spotlight_push_candidates()
returns setof jsonb
language sql
stable
security definer
set search_path = public
as $fn$
  with cur as (
    select s.id, r.id as release_id, r.title, r.slug, coalesce(a.name, '') as artist
      from public.spotlight_weeks s
      join public.releases r on r.id = s.release_id
      left join public.artists a on a.id = r.primary_artist_id
     where s.starts_at <= now() and s.ends_at > now()
     order by s.starts_at desc
     limit 1
  ),
  people as (
    select distinct t.user_id
      from public.push_tokens t
     where t.platform = 'ios'
  )
  select jsonb_build_object(
           'user_id',      p.id,
           'username',     p.username,
           'spotlight_id', c.id,
           'title',        c.title,
           'artist',       c.artist,
           'slug',         c.slug
         )
    from cur c
    cross join people x
    join public.profiles p on p.id = x.user_id
   where not exists (
     select 1 from public.reviews v
      where v.user_id = p.id
        and v.release_id = c.release_id
        and v.is_published
   );
$fn$;

revoke all on function public.spotlight_push_candidates()
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. The sender — what pg_cron runs.
--   p_force     → skip the "is it Monday 10am in New York?" check
--   p_only_user → only this person (testing on yourself)
-- Returns how many people were queued.
-- ------------------------------------------------------------
create or replace function public.send_spotlight_pushes(
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
  -- The job fires at 14:00 and 15:00 UTC on Mondays; only the one that
  -- is 10am in New York sends (DST-proof, same trick as 055).
  if not p_force and not (extract(isodow from v_local) = 1 and extract(hour from v_local) = 10) then
    return 0;
  end if;

  select value into v_secret from private.app_secrets where name = 'push_webhook';
  if v_secret is null then
    return 0;
  end if;

  -- Record first, send second (same guard as 055 / 060 / 062 / 063).
  with cands as (
    select c
      from public.spotlight_push_candidates() as c
     where p_only_user is null
        or (c ->> 'user_id')::uuid = p_only_user
  ),
  fresh as (
    insert into public.push_spotlight_sent (user_id, spotlight_id)
    select (c ->> 'user_id')::uuid, (c ->> 'spotlight_id')::uuid
      from cands
    on conflict (user_id, spotlight_id) do nothing
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
      body := jsonb_build_object('type', 'SPOTLIGHT', 'spotlights', v_batch),
      timeout_milliseconds := 60000
    );
  end loop;

  return v_n;
end;
$fn$;

revoke all on function public.send_spotlight_pushes(boolean, uuid)
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 5. The schedule: 14:00 and 15:00 UTC every Monday (one of them is
--    10am New York). Re-running this file replaces the job cleanly.
-- ------------------------------------------------------------
do $$
begin
  if exists (select 1 from cron.job where jobname = 'spotlight-monday-push') then
    perform cron.unschedule('spotlight-monday-push');
  end if;
end;
$$;

select cron.schedule(
  'spotlight-monday-push',
  '0 14,15 * * 1',
  $$select public.send_spotlight_pushes();$$
);

notify pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verify (should return one row):
--   select jobname, schedule from cron.job where jobname = 'spotlight-monday-push';
-- After a Monday — how many went out:
--   select spotlight_id, count(*) from public.push_spotlight_sent group by 1;
-- ------------------------------------------------------------
