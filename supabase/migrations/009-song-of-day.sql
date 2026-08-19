-- ============================================================
-- Migration 009 — Song of the Day + streaks (2026-08-19)
-- Run in the Supabase SQL Editor after 008.
--
-- One pick per user per calendar day (UTC). Picking on consecutive
-- days builds a streak; skipping a day breaks it. The current
-- streak is computed by get_sotd_streak() — no counter column to
-- drift out of sync.
-- ============================================================

create table if not exists public.song_of_day (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  picked_on   date not null default current_date,
  release_id  uuid references public.releases(id) on delete set null,
  track_title text not null check (char_length(track_title) between 1 and 300),
  artist      text not null check (char_length(artist) between 1 and 300),
  cover_image text check (cover_image is null or cover_image ~ '^https?://'),
  -- Playable preview or a link target (Spotify track page / our release page)
  track_url   text check (track_url is null or track_url ~ '^(https://|/)'),
  created_at  timestamptz not null default now(),
  -- THE rule: one song per day. Re-picking the same day updates it.
  unique (user_id, picked_on)
);

create index if not exists idx_sotd_user_date
  on public.song_of_day (user_id, picked_on desc);

alter table public.song_of_day enable row level security;

drop policy if exists "Songs of the day are viewable by everyone" on public.song_of_day;
create policy "Songs of the day are viewable by everyone"
  on public.song_of_day for select using (true);

drop policy if exists "Users set their own song of the day" on public.song_of_day;
create policy "Users set their own song of the day"
  on public.song_of_day for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can change today's pick" on public.song_of_day;
create policy "Users can change today's pick"
  on public.song_of_day for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own picks" on public.song_of_day;
create policy "Users can delete their own picks"
  on public.song_of_day for delete using (auth.uid() = user_id);

-- ------------------------------------------------------------
-- Current streak: consecutive days ending TODAY, or ending
-- YESTERDAY (today's pick still pending — streak alive, not yet
-- extended). Anything older means the streak is broken → 0.
--
-- The window trick: walking rows newest-first, picked_on equals
-- (anchor - row_offset) only while every step is exactly one day.
-- Dates are unique per user and strictly decreasing, so after the
-- first gap the equality can never hold again — the count is the
-- exact streak length.
-- ------------------------------------------------------------
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
     and picked_on >= current_date - 1;

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
