-- ============================================================
-- Migration 018 — streaks reset on PACIFIC time + chimp catch-up
-- (2026-08-23). Run in the Supabase SQL Editor after 017.
--
-- The song-of-the-day "day" was a UTC calendar day, which resets
-- at 4/5pm Pacific — chimp picked every real day but the UTC
-- boundary split one pick across two "days" and broke the streak.
-- From now on a day is a Pacific calendar day (America/Los_Angeles,
-- so PST/PDT switches are handled automatically), matching the new
-- app-side pacificDate() helper.
--
-- Also backfills chimp's gap days so their current streak equals
-- Luca's at the moment this runs (Luca 2026-08-23: "match chimp's
-- streak with my own").
-- ============================================================

-- Today's date on a Pacific clock. Used by the default, the streak
-- function, and the backfill below — one definition, no drift.
create or replace function public.pacific_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'America/Los_Angeles')::date;
$$;

alter table public.song_of_day
  alter column picked_on set default public.pacific_today();

-- Same window-trick streak as migration 009; the only change is the
-- anchor window now opens on the Pacific today, not the UTC one.
create or replace function public.get_sotd_streak(user_uuid uuid)
returns integer
language plpgsql
stable
as $$
declare
  anchor date;
  streak integer;
begin
  select max(picked_on) into anchor
    from public.song_of_day
   where user_id = user_uuid
     and picked_on >= public.pacific_today() - 1;

  if anchor is null then
    return 0;
  end if;

  select count(*) into streak
    from (
      -- ::int matters: row_number() yields bigint and Postgres has no
      -- date - bigint operator (only date - integer).
      select picked_on,
             (row_number() over (order by picked_on desc) - 1)::int as row_offset
        from public.song_of_day
       where user_id = user_uuid
         and picked_on <= anchor
    ) t
   where t.picked_on = anchor - t.row_offset;

  return coalesce(streak, 0);
end;
$$;

-- ------------------------------------------------------------
-- One-time backfill: make chimp's live streak equal Luca's.
--
-- Fills the missing days in the run ending at chimp's anchor day
-- (today's pick, or yesterday if today is still pending) by copying
-- chimp's most recent pick into each gap. Inserts only — no real
-- pick is touched, and days chimp actually filled stay theirs.
-- ------------------------------------------------------------
do $$
declare
  luca_id  uuid;
  chimp_id uuid;
  target   integer;
  anchor   date;
  filler   public.song_of_day%rowtype;
begin
  select id into luca_id  from public.profiles where username = 'luca';
  select id into chimp_id from public.profiles where username = 'chimp';
  if luca_id is null or chimp_id is null then
    raise notice 'luca or chimp profile not found — backfill skipped';
    return;
  end if;

  target := public.get_sotd_streak(luca_id);
  if target <= 0 then
    raise notice 'luca has no live streak — backfill skipped';
    return;
  end if;

  select * into filler
    from public.song_of_day
   where user_id = chimp_id
   order by picked_on desc
   limit 1;
  if filler.id is null then
    raise notice 'chimp has no picks to copy — backfill skipped';
    return;
  end if;

  -- Anchor the run on chimp's latest pick, but never earlier than
  -- yesterday: a run ending before that would not count as live.
  anchor := greatest(least(filler.picked_on, public.pacific_today()),
                     public.pacific_today() - 1);

  insert into public.song_of_day
    (user_id, picked_on, release_id, track_title, artist, cover_image, track_url)
  select chimp_id, g.d::date, filler.release_id, filler.track_title, filler.artist,
         filler.cover_image, filler.track_url
    from generate_series(anchor - (target - 1), anchor, interval '1 day') as g(d)
  on conflict (user_id, picked_on) do nothing;

  raise notice 'chimp streak is now % (target %)',
    public.get_sotd_streak(chimp_id), target;
end;
$$;
