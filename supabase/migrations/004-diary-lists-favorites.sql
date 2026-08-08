-- =============================================================================
-- Migration 004 — Listening Diary, Lists, Profile Favorites
-- =============================================================================
-- The Letterboxd layer: log what you listen to (diary), curate shareable
-- lists, and showcase four favorite albums on your profile.
-- Safe to re-run: every statement is guarded with "if not exists" or
-- "on conflict", and policies are dropped before being recreated.
-- Run in the Supabase SQL Editor.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. DIARY ENTRIES — the core Letterboxd loop, adapted to music.
--    Lighter than a review: date + rating + optional one-line note.
--    An entry can link to a release in our catalog (release_id) OR be
--    free-text (title/artist) for music we haven't imported yet.
-- ---------------------------------------------------------------------------
create table if not exists public.diary_entries (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  release_id   uuid references public.releases(id) on delete set null,
  title        text not null,                -- denormalized so the diary renders even without a catalog release
  artist       text not null,
  cover_image  text,
  listened_on  date not null default current_date,
  rating       numeric(3,1) check (rating >= 0 and rating <= 10),  -- optional: you can log without rating
  note         text check (char_length(note) <= 500),              -- short thought, not a full review
  is_relisten  boolean not null default false,                     -- "listened again" flag (Letterboxd's rewatch)
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_diary_user_date  on public.diary_entries (user_id, listened_on desc);
create index if not exists idx_diary_release    on public.diary_entries (release_id);
create index if not exists idx_diary_created_at on public.diary_entries (created_at desc);

comment on table public.diary_entries is 'Listening log: one row per listen (album/track), with date, optional rating and note.';

alter table public.diary_entries enable row level security;

drop policy if exists "Diary entries are viewable by everyone" on public.diary_entries;
create policy "Diary entries are viewable by everyone"
  on public.diary_entries for select using (true);

drop policy if exists "Users can insert their own diary entries" on public.diary_entries;
create policy "Users can insert their own diary entries"
  on public.diary_entries for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own diary entries" on public.diary_entries;
create policy "Users can update their own diary entries"
  on public.diary_entries for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own diary entries" on public.diary_entries;
create policy "Users can delete their own diary entries"
  on public.diary_entries for delete using (auth.uid() = user_id);

drop trigger if exists trg_diary_entries_updated_at on public.diary_entries;
create trigger trg_diary_entries_updated_at
  before update on public.diary_entries
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 2. LISTS — "best albums of 2026", "3am driving music", etc.
-- ---------------------------------------------------------------------------
create table if not exists public.lists (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  slug         text not null,
  title        text not null check (char_length(title) between 1 and 120),
  description  text check (char_length(description) <= 2000),
  is_ranked    boolean not null default false,   -- ranked lists show 1, 2, 3… badges
  is_public    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),

  constraint uq_lists_user_slug unique (user_id, slug)
);

create index if not exists idx_lists_user_id    on public.lists (user_id);
create index if not exists idx_lists_created_at on public.lists (created_at desc);

comment on table public.lists is 'User-curated album/track lists (Letterboxd-style).';

create table if not exists public.list_items (
  id           uuid primary key default uuid_generate_v4(),
  list_id      uuid not null references public.lists(id) on delete cascade,
  release_id   uuid references public.releases(id) on delete set null,
  title        text not null,               -- denormalized display fields (same pattern as diary)
  artist       text not null,
  cover_image  text,
  note         text check (char_length(note) <= 500),   -- optional per-item blurb
  position     integer not null default 0,              -- ordering within the list
  created_at   timestamptz not null default now()
);

create index if not exists idx_list_items_list on public.list_items (list_id, position);

comment on table public.list_items is 'Entries within a list, ordered by position.';

create table if not exists public.list_likes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  list_id     uuid not null references public.lists(id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint uq_list_likes_user_list unique (user_id, list_id)
);

create index if not exists idx_list_likes_list on public.list_likes (list_id);

-- RLS: public lists are visible to all; owners see and manage their own.
alter table public.lists enable row level security;

drop policy if exists "Public lists are viewable by everyone" on public.lists;
create policy "Public lists are viewable by everyone"
  on public.lists for select using (is_public = true or auth.uid() = user_id);

drop policy if exists "Users can create their own lists" on public.lists;
create policy "Users can create their own lists"
  on public.lists for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update their own lists" on public.lists;
create policy "Users can update their own lists"
  on public.lists for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own lists" on public.lists;
create policy "Users can delete their own lists"
  on public.lists for delete using (auth.uid() = user_id);

alter table public.list_items enable row level security;

-- Items inherit visibility from their parent list.
drop policy if exists "List items visible when list is visible" on public.list_items;
create policy "List items visible when list is visible"
  on public.list_items for select
  using (exists (
    select 1 from public.lists l
    where l.id = list_id and (l.is_public = true or l.user_id = auth.uid())
  ));

drop policy if exists "List owners can add items" on public.list_items;
create policy "List owners can add items"
  on public.list_items for insert
  with check (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));

drop policy if exists "List owners can update items" on public.list_items;
create policy "List owners can update items"
  on public.list_items for update
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));

drop policy if exists "List owners can delete items" on public.list_items;
create policy "List owners can delete items"
  on public.list_items for delete
  using (exists (select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()));

alter table public.list_likes enable row level security;

drop policy if exists "List likes are viewable by everyone" on public.list_likes;
create policy "List likes are viewable by everyone"
  on public.list_likes for select using (true);

drop policy if exists "Authenticated users can like lists" on public.list_likes;
create policy "Authenticated users can like lists"
  on public.list_likes for insert with check (auth.uid() = user_id);

drop policy if exists "Users can unlike lists" on public.list_likes;
create policy "Users can unlike lists"
  on public.list_likes for delete using (auth.uid() = user_id);

drop trigger if exists trg_lists_updated_at on public.lists;
create trigger trg_lists_updated_at
  before update on public.lists
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------------
-- 3. PROFILE FAVORITES — the "four favorites" showcase (Letterboxd style).
--    Exactly 4 slots (positions 1-4), each pointing at a release or free-text.
-- ---------------------------------------------------------------------------
create table if not exists public.profile_favorites (
  id           uuid primary key default uuid_generate_v4(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  position     integer not null check (position between 1 and 4),
  release_id   uuid references public.releases(id) on delete set null,
  title        text not null,
  artist       text not null,
  cover_image  text,
  created_at   timestamptz not null default now(),

  constraint uq_profile_favorites_slot unique (user_id, position)
);

comment on table public.profile_favorites is 'Four-favorites showcase on profiles, one row per slot (1-4).';

alter table public.profile_favorites enable row level security;

drop policy if exists "Favorites are viewable by everyone" on public.profile_favorites;
create policy "Favorites are viewable by everyone"
  on public.profile_favorites for select using (true);

drop policy if exists "Users manage their own favorites (insert)" on public.profile_favorites;
create policy "Users manage their own favorites (insert)"
  on public.profile_favorites for insert with check (auth.uid() = user_id);

drop policy if exists "Users manage their own favorites (update)" on public.profile_favorites;
create policy "Users manage their own favorites (update)"
  on public.profile_favorites for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "Users manage their own favorites (delete)" on public.profile_favorites;
create policy "Users manage their own favorites (delete)"
  on public.profile_favorites for delete using (auth.uid() = user_id);


-- ---------------------------------------------------------------------------
-- 4. STATS FUNCTIONS
-- ---------------------------------------------------------------------------

-- Rating distribution across a user's diary entries + reviews, bucketed by
-- whole number (0-10). Powers the histogram on profiles.
create or replace function public.get_rating_distribution(profile_uuid uuid)
returns table (bucket int, count bigint)
language sql
stable
as $$
  select floor(r)::int as bucket, count(*) as count
  from (
    select rating as r from public.diary_entries
      where user_id = profile_uuid and rating is not null
    union all
    select rating as r from public.reviews
      where user_id = profile_uuid and is_published = true
  ) ratings
  group by 1
  order by 1;
$$;

comment on function public.get_rating_distribution is 'Whole-number rating histogram from a user''s diary + published reviews.';

-- Diary summary stats for a profile: total logs, logs this year, relistens,
-- and average rating.
create or replace function public.get_diary_stats(profile_uuid uuid)
returns table (total_entries bigint, entries_this_year bigint, relistens bigint, avg_rating numeric)
language sql
stable
as $$
  select
    count(*),
    count(*) filter (where listened_on >= date_trunc('year', current_date)),
    count(*) filter (where is_relisten),
    round(avg(rating), 1)
  from public.diary_entries
  where user_id = profile_uuid;
$$;

comment on function public.get_diary_stats is 'Diary totals for a profile: all-time, this year, relistens, average rating.';
