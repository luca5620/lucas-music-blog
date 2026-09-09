-- ============================================================
-- Migration 041 — per-track ratings (Luca 2026-09-08). Run in the
-- Supabase SQL Editor after 040.
--
-- "Restructure releases to show ratings for individual songs off an
-- album." A review rates the RECORD (reviews.rating); this table
-- rates the SONGS. One row per member per track of a release, keyed
-- by the track's position in releases.tracks (the jsonb tracklist —
-- positions come from Spotify/Genius and never move once imported).
-- Same 0–10 scale as reviews so the color language (lib/rating.ts)
-- carries over unchanged.
--
-- No review required: rating tracks is the lightest possible action
-- on a release page — tap a row, drag, done — so it doubles as the
-- low-friction "come back and do one thing" hook.
-- ============================================================

create table if not exists public.track_ratings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  release_id      uuid not null references public.releases(id) on delete cascade,
  track_position  int  not null check (track_position between 1 and 120),
  rating          numeric(3,1) not null check (rating >= 0 and rating <= 10),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint uq_track_ratings_member_track unique (user_id, release_id, track_position)
);

-- The release page reads every rating for one release in one query;
-- profiles read one member's rows.
create index if not exists idx_track_ratings_release on public.track_ratings (release_id);
create index if not exists idx_track_ratings_user    on public.track_ratings (user_id, created_at desc);

drop trigger if exists trg_track_ratings_updated_at on public.track_ratings;
create trigger trg_track_ratings_updated_at
  before update on public.track_ratings
  for each row execute function public.set_updated_at();

comment on table public.track_ratings is
  'Per-song ratings (0-10) on a release, keyed by the track position in releases.tracks. Independent of reviews.';

-- RLS: everyone reads (community averages are public), members write
-- only their own rows.
alter table public.track_ratings enable row level security;

drop policy if exists "Track ratings are viewable by everyone" on public.track_ratings;
create policy "Track ratings are viewable by everyone"
  on public.track_ratings for select using (true);

drop policy if exists "Members rate tracks as themselves" on public.track_ratings;
create policy "Members rate tracks as themselves"
  on public.track_ratings for insert
  with check (auth.uid() = user_id);

drop policy if exists "Members update their own track ratings" on public.track_ratings;
create policy "Members update their own track ratings"
  on public.track_ratings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Members delete their own track ratings" on public.track_ratings;
create policy "Members delete their own track ratings"
  on public.track_ratings for delete
  using (auth.uid() = user_id);

-- PostgREST caches the schema — without this the new table 404s
-- until the next restart.
notify pgrst, 'reload schema';
