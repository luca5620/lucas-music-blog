-- =============================================================================
-- Phase 2a-1 — Artists + Releases foundation
-- =============================================================================
-- Adds canonical artist + release entities, junction (release_artists), follow
-- tables for both, and patches reviews.release_id. Plus RLS, indexes, and
-- stats functions. Runs after schema.sql + add-role-column.sql.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. ARTISTS
-- ---------------------------------------------------------------------------
create table if not exists public.artists (
  id           uuid primary key default uuid_generate_v4(),
  slug         text unique not null,
  name         text not null,
  spotify_id   text unique,
  image_url    text,
  bio          text,
  genres       text[] not null default '{}',
  popularity   int,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_artists_slug         on public.artists (slug);
create index if not exists idx_artists_spotify_id   on public.artists (spotify_id);
create index if not exists idx_artists_lower_name   on public.artists (lower(name));

create trigger trg_artists_updated_at
  before update on public.artists
  for each row execute function public.set_updated_at();

comment on table public.artists is 'Canonical artist entities, optionally synced from Spotify.';


-- ---------------------------------------------------------------------------
-- 2. RELEASES
-- ---------------------------------------------------------------------------
create table if not exists public.releases (
  id                 uuid primary key default uuid_generate_v4(),
  slug               text unique not null,
  title              text not null,
  primary_artist_id  uuid not null references public.artists(id) on delete restrict,
  release_type       text not null check (release_type in ('single','EP','album','mixtape','compilation')),
  release_date       date,
  cover_image        text,
  spotify_id         text unique,
  description        text,
  tracks             jsonb not null default '[]'::jsonb,
  popularity         int,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_releases_slug              on public.releases (slug);
create index if not exists idx_releases_spotify_id        on public.releases (spotify_id);
create index if not exists idx_releases_primary_artist_id on public.releases (primary_artist_id);
create index if not exists idx_releases_release_date      on public.releases (release_date desc);

create trigger trg_releases_updated_at
  before update on public.releases
  for each row execute function public.set_updated_at();

comment on table public.releases is 'Albums, EPs, mixtapes, singles — canonical release entities.';


-- ---------------------------------------------------------------------------
-- 3. RELEASE_ARTISTS  (junction)
-- ---------------------------------------------------------------------------
create table if not exists public.release_artists (
  release_id  uuid not null references public.releases(id) on delete cascade,
  artist_id   uuid not null references public.artists(id)  on delete cascade,
  role        text not null check (role in ('primary','feature','producer','remix')),
  position    int  not null default 0,

  primary key (release_id, artist_id, role)
);

create index if not exists idx_release_artists_release_id on public.release_artists (release_id);
create index if not exists idx_release_artists_artist_id  on public.release_artists (artist_id);

comment on table public.release_artists is 'Many-to-many join between releases and artists with role + position.';


-- ---------------------------------------------------------------------------
-- 4. ARTIST_FOLLOWS
-- ---------------------------------------------------------------------------
create table if not exists public.artist_follows (
  id           uuid primary key default uuid_generate_v4(),
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  artist_id    uuid not null references public.artists(id)  on delete cascade,
  created_at   timestamptz not null default now(),

  constraint uq_artist_follows_pair unique (follower_id, artist_id)
);

create index if not exists idx_artist_follows_follower_id on public.artist_follows (follower_id);
create index if not exists idx_artist_follows_artist_id   on public.artist_follows (artist_id);

comment on table public.artist_follows is 'Profiles following artists.';


-- ---------------------------------------------------------------------------
-- 5. RELEASE_FOLLOWS
-- ---------------------------------------------------------------------------
create table if not exists public.release_follows (
  id           uuid primary key default uuid_generate_v4(),
  follower_id  uuid not null references public.profiles(id) on delete cascade,
  release_id   uuid not null references public.releases(id) on delete cascade,
  created_at   timestamptz not null default now(),

  constraint uq_release_follows_pair unique (follower_id, release_id)
);

create index if not exists idx_release_follows_follower_id on public.release_follows (follower_id);
create index if not exists idx_release_follows_release_id  on public.release_follows (release_id);

comment on table public.release_follows is 'Profiles following individual releases.';


-- ---------------------------------------------------------------------------
-- 6. REVIEWS PATCH
-- ---------------------------------------------------------------------------
-- Add release_id linking reviews to canonical releases (nullable; legacy
-- title/artist/cover_image columns preserved untouched).
alter table public.reviews
  add column if not exists release_id uuid references public.releases(id) on delete set null;

create index if not exists idx_reviews_release_id on public.reviews (release_id);

-- Extend the existing release_type check constraint to include 'compilation'.
alter table public.reviews
  drop constraint if exists reviews_release_type_check;

alter table public.reviews
  add constraint reviews_release_type_check
  check (release_type in ('single','EP','album','mixtape','compilation'));


-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

-- ---- artists ----
alter table public.artists enable row level security;

create policy "Artists are viewable by everyone"
  on public.artists for select
  using (true);

create policy "Owners and admins can insert artists"
  on public.artists for insert
  with check (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );

create policy "Owners and admins can update artists"
  on public.artists for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );

create policy "Owners and admins can delete artists"
  on public.artists for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );


-- ---- releases ----
alter table public.releases enable row level security;

create policy "Releases are viewable by everyone"
  on public.releases for select
  using (true);

create policy "Owners and admins can insert releases"
  on public.releases for insert
  with check (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );

create policy "Owners and admins can update releases"
  on public.releases for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );

create policy "Owners and admins can delete releases"
  on public.releases for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );


-- ---- release_artists ----
alter table public.release_artists enable row level security;

create policy "Release artists are viewable by everyone"
  on public.release_artists for select
  using (true);

create policy "Owners and admins can insert release_artists"
  on public.release_artists for insert
  with check (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );

create policy "Owners and admins can update release_artists"
  on public.release_artists for update
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  )
  with check (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );

create policy "Owners and admins can delete release_artists"
  on public.release_artists for delete
  using (
    (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );


-- ---- artist_follows ----
alter table public.artist_follows enable row level security;

create policy "Artist follows are viewable by everyone"
  on public.artist_follows for select
  using (true);

create policy "Authenticated users can follow artists"
  on public.artist_follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow artists"
  on public.artist_follows for delete
  using (auth.uid() = follower_id);


-- ---- release_follows ----
alter table public.release_follows enable row level security;

create policy "Release follows are viewable by everyone"
  on public.release_follows for select
  using (true);

create policy "Authenticated users can follow releases"
  on public.release_follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow releases"
  on public.release_follows for delete
  using (auth.uid() = follower_id);


-- ===========================================================================
-- FUNCTIONS — STATS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- get_artist_stats(artist_uuid)
-- ---------------------------------------------------------------------------
create or replace function public.get_artist_stats(artist_uuid uuid)
returns table (follower_count int, release_count int, review_count int)
language sql
stable
as $$
  select
    (select count(*)::int from public.artist_follows where artist_id = artist_uuid),
    (select count(*)::int from public.releases       where primary_artist_id = artist_uuid),
    (select count(*)::int
       from public.reviews r
       join public.releases rel on rel.id = r.release_id
      where rel.primary_artist_id = artist_uuid
        and r.is_published = true);
$$;

comment on function public.get_artist_stats is 'Returns follower_count, release_count, review_count for an artist.';


-- ---------------------------------------------------------------------------
-- get_release_stats(release_uuid)
-- ---------------------------------------------------------------------------
create or replace function public.get_release_stats(release_uuid uuid)
returns table (follower_count int, review_count int, avg_rating numeric)
language sql
stable
as $$
  select
    (select count(*)::int from public.release_follows where release_id = release_uuid),
    (select count(*)::int
       from public.reviews
      where release_id = release_uuid and is_published = true),
    (select avg(rating)::numeric
       from public.reviews
      where release_id = release_uuid and is_published = true);
$$;

comment on function public.get_release_stats is 'Returns follower_count, review_count, avg_rating for a release.';
