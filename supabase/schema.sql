-- =============================================================================
-- Peak Music Reviews — Full Database Schema
-- =============================================================================
-- Supabase/Postgres migration for a music review social platform.
-- Run this in the Supabase SQL Editor or via `supabase db push`.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "uuid-ossp";


-- ---------------------------------------------------------------------------
-- 1. PROFILES (extends Supabase auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  username        text unique not null check (username = lower(username)),
  display_name    text,
  bio             text,
  avatar_url      text,
  banner_url      text,                          -- custom profile background
  profile_color   text default '#1e90ff',        -- primary accent color
  profile_gradient text,                         -- optional CSS gradient for background
  profile_song_url   text,                       -- URL to a song that plays on profile
  profile_song_title text,                       -- display title for the song
  spotify_url       text,                        -- link to Spotify profile
  soundcloud_url    text,                        -- link to SoundCloud profile
  statsfm_url        text,                        -- link to stats.fm profile
  apple_music_url   text,                        -- link to Apple Music profile
  favorite_genres   text[],                      -- array of genres
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_profiles_username on public.profiles (username);

comment on table public.profiles is 'Public user profiles, one-to-one with auth.users.';


-- ---------------------------------------------------------------------------
-- 2. REVIEWS
-- ---------------------------------------------------------------------------
create table public.reviews (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  slug            text not null,
  title           text not null,                 -- album / track title
  artist          text not null,
  rating          numeric(3,1) not null check (rating >= 0 and rating <= 10),
  genre           text,
  release_type    text check (release_type in ('single', 'EP', 'album', 'mixtape')),
  release_date    date,
  review_date     date,
  summary         text,                          -- full review text
  snippet         text,                          -- short description
  cover_image     text,                          -- URL to cover image
  standout_tracks jsonb default '[]'::jsonb,     -- array of {title, spotifyUrl}
  is_published    boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  -- slug must be unique per user, not globally
  constraint uq_reviews_user_slug unique (user_id, slug)
);

create index idx_reviews_user_id    on public.reviews (user_id);
create index idx_reviews_slug       on public.reviews (slug);
create index idx_reviews_genre      on public.reviews (genre);
create index idx_reviews_rating     on public.reviews (rating);
create index idx_reviews_created_at on public.reviews (created_at desc);

comment on table public.reviews is 'Music reviews posted by users.';


-- ---------------------------------------------------------------------------
-- 3. REVIEW_LIKES
-- ---------------------------------------------------------------------------
create table public.review_likes (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  review_id   uuid not null references public.reviews(id) on delete cascade,
  created_at  timestamptz not null default now(),

  constraint uq_review_likes_user_review unique (user_id, review_id)
);

create index idx_review_likes_review_id on public.review_likes (review_id);
create index idx_review_likes_user_id   on public.review_likes (user_id);

comment on table public.review_likes is 'Users can like reviews (one like per user per review).';


-- ---------------------------------------------------------------------------
-- 4. COMMENTS (threaded)
-- ---------------------------------------------------------------------------
create table public.comments (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  review_id   uuid not null references public.reviews(id) on delete cascade,
  parent_id   uuid references public.comments(id) on delete cascade,  -- null = top-level
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index idx_comments_review_id on public.comments (review_id);
create index idx_comments_user_id   on public.comments (user_id);

comment on table public.comments is 'Threaded comments on reviews.';


-- ---------------------------------------------------------------------------
-- 5. FOLLOWS
-- ---------------------------------------------------------------------------
create table public.follows (
  id            uuid primary key default uuid_generate_v4(),
  follower_id   uuid not null references public.profiles(id) on delete cascade,
  following_id  uuid not null references public.profiles(id) on delete cascade,
  created_at    timestamptz not null default now(),

  constraint uq_follows_pair unique (follower_id, following_id),
  constraint chk_no_self_follow check (follower_id <> following_id)
);

create index idx_follows_follower_id  on public.follows (follower_id);
create index idx_follows_following_id on public.follows (following_id);

comment on table public.follows is 'User-to-user follow relationships.';


-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

-- ---- profiles ----
alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---- reviews ----
alter table public.reviews enable row level security;

create policy "Published reviews are viewable by everyone"
  on public.reviews for select
  using (is_published = true or auth.uid() = user_id);

create policy "Users can insert their own reviews"
  on public.reviews for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own reviews"
  on public.reviews for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own reviews"
  on public.reviews for delete
  using (auth.uid() = user_id);

-- ---- review_likes ----
alter table public.review_likes enable row level security;

create policy "Likes are viewable by everyone"
  on public.review_likes for select
  using (true);

create policy "Authenticated users can like reviews"
  on public.review_likes for insert
  with check (auth.uid() = user_id);

create policy "Users can remove their own likes"
  on public.review_likes for delete
  using (auth.uid() = user_id);

-- ---- comments ----
alter table public.comments enable row level security;

create policy "Comments are viewable by everyone"
  on public.comments for select
  using (true);

create policy "Authenticated users can post comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own comments"
  on public.comments for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.comments for delete
  using (auth.uid() = user_id);

-- ---- follows ----
alter table public.follows enable row level security;

create policy "Follows are viewable by everyone"
  on public.follows for select
  using (true);

create policy "Authenticated users can follow others"
  on public.follows for insert
  with check (auth.uid() = follower_id);

create policy "Users can unfollow"
  on public.follows for delete
  using (auth.uid() = follower_id);


-- ===========================================================================
-- FUNCTIONS & TRIGGERS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- Auto-create a profile when a new auth user signs up
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  _username text;
begin
  -- Derive a username from the email (everything before the @), lowercased.
  -- If that username already exists, append a random suffix.
  _username := lower(split_part(new.email, '@', 1));

  -- Strip non-alphanumeric characters (keep letters, digits, underscores, hyphens)
  _username := regexp_replace(_username, '[^a-z0-9_-]', '', 'g');

  -- Handle empty username edge case
  if _username = '' then
    _username := 'user';
  end if;

  -- Ensure uniqueness by appending random digits if needed
  while exists (select 1 from public.profiles where username = _username) loop
    _username := _username || floor(random() * 10000)::text;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url)
  values (
    new.id,
    _username,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', _username),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', null)
  );

  return new;
end;
$$;

-- Trigger: fire after every new auth.users insert
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ---------------------------------------------------------------------------
-- get_review_stats(review_uuid) — returns like count & comment count
-- ---------------------------------------------------------------------------
create or replace function public.get_review_stats(review_uuid uuid)
returns table (like_count bigint, comment_count bigint)
language sql
stable
as $$
  select
    (select count(*) from public.review_likes where review_id = review_uuid),
    (select count(*) from public.comments      where review_id = review_uuid);
$$;

comment on function public.get_review_stats is 'Returns like_count and comment_count for a given review.';


-- ---------------------------------------------------------------------------
-- get_profile_stats(profile_uuid) — returns review, follower, following counts
-- ---------------------------------------------------------------------------
create or replace function public.get_profile_stats(profile_uuid uuid)
returns table (review_count bigint, follower_count bigint, following_count bigint)
language sql
stable
as $$
  select
    (select count(*) from public.reviews where user_id   = profile_uuid and is_published = true),
    (select count(*) from public.follows where following_id = profile_uuid),
    (select count(*) from public.follows where follower_id  = profile_uuid);
$$;

comment on function public.get_profile_stats is 'Returns review_count, follower_count, following_count for a given profile.';


-- ---------------------------------------------------------------------------
-- Auto-update updated_at columns
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger trg_reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();

create trigger trg_comments_updated_at
  before update on public.comments
  for each row execute function public.set_updated_at();


-- ===========================================================================
-- SEED DATA — Luca's profile and reviews
-- ===========================================================================
-- Replace this UUID with Luca's actual auth.users id after creating the account.
-- You can find it in the Supabase dashboard under Authentication > Users.

do $$
declare
  luca_id uuid := '8587299c-dbb8-49a9-b984-e25c089a65fc';
begin

  -- -------------------------------------------------------------------------
  -- Profile
  -- -------------------------------------------------------------------------
  insert into public.profiles (id, username, display_name, bio, profile_color, favorite_genres)
  values (
    luca_id,
    'luca',
    'Luca',
    'Peak Music Reviews. Rating music so you do not have to.',
    '#1e90ff',
    array['R&B', 'Hip-Hop', 'Pop', 'Alternative']
  )
  on conflict (id) do nothing;

  -- -------------------------------------------------------------------------
  -- Reviews
  -- -------------------------------------------------------------------------

  -- 1. House Of Balloons — The Weeknd (10.0)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, review_date, summary, snippet, cover_image, standout_tracks, is_published)
  values (
    luca_id,
    'house-of-balloons-the-weeknd',
    'House Of Balloons',
    'The Weeknd',
    10.0,
    'R&B',
    'mixtape',
    '2011-03-21',
    '2026-03-01',
    'As my first 10/10 rating I have what I say is the "Greatest Album of All Time" which is the debut mixtape/album by The Weeknd, who I also think is the greatest artist of all time. I have never heard an album before that has put me in such a vivid experience that I can see and feel, more than this mixtape. House Of Balloons is a life-changing album that is so dark and eerie, that makes you want to open a window and breath as you are surrounded by girls, drinks, and drugs all around you in the most drug-induced experience ever. With this explanation I am referring to my favorite track of this mixtape as well as my favorite song of all time, "House Of Balloons / Glass Table Girls". I truly do not believe any song on this album is bad, even the bonus song "Twenty Eight" being great as well. To round out my top 3 songs however I would say "The Knowing" and "Wicked Games" are truly fantastic songs and overall this album would be my personal recommendation for anyone in music to give a listen and see if they agree with this 10/10 review of mine.',
    'The "Greatest Album of All Time" — a life-changing, dark, and eerie experience. The first and only 10/10.',
    '/reviews/house-of-balloons-the-weeknd.png',
    '[{"title": "House Of Balloons / Glass Table Girls", "spotifyUrl": "https://open.spotify.com/track/2r7BPog74oaTG5shNYiUnV"}, {"title": "The Knowing", "spotifyUrl": "https://open.spotify.com/track/6tjsbysvZh8Pq8DZA5ldrn"}, {"title": "Wicked Games", "spotifyUrl": "https://open.spotify.com/track/00aqkszH1FdUiJJWvX6iEl"}]'::jsonb,
    true
  ) on conflict (user_id, slug) do nothing;

  -- 2. The Romantic — Bruno Mars (8.1)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, review_date, summary, snippet, cover_image, standout_tracks, is_published)
  values (
    luca_id,
    'the-romantic-bruno-mars',
    'The Romantic',
    'Bruno Mars',
    8.1,
    'Pop',
    'album',
    '2026-02-27',
    '2026-03-01',
    'After nearly 10 years, Bruno Mars comes back with a short solo album, with many Latin influences. The album sounds familiar as the formula many have learned to fall in love with over the years continues to win over hearts, especially with standout tracks such as "Risk It All", "Why You Wanna Fight?", and "On My Soul" being my personal favorites. This fantastic album was all killer no filler but personally after such a long wait I wish we could have had a bit more, although Bruno Mars is not known for lengthy solo albums, for the wait it would have been a nice touch. The production and story of the album is great with a few low-lights in my opinion such as "God Was Showing Off", and "Something Serious", dropping my rating slightly but still putting this album in elite territory for 2026 releases, going with a strong 8.1/10.',
    'After nearly 10 years, Bruno Mars comes back with a short solo album. All killer no filler — elite territory for 2026.',
    '/reviews/the-romantic-bruno-mars.png',
    '[{"title": "Risk It All", "spotifyUrl": "https://open.spotify.com/track/5y2ijHECwFYWqcAHKTZgzD"}, {"title": "Why You Wanna Fight?", "spotifyUrl": "https://open.spotify.com/track/3Ac4AjYkqsvop2ydbSAhTX"}, {"title": "On My Soul", "spotifyUrl": "https://open.spotify.com/track/4i4BVY2JiH4mDSLIBdNGKD"}]'::jsonb,
    true
  ) on conflict (user_id, slug) do nothing;

  -- 3. Channel Orange — Frank Ocean (9.8)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'channel-orange-frank-ocean',
    'Channel Orange',
    'Frank Ocean',
    9.8,
    'R&B',
    'album',
    '2012-07-10',
    '9.8/10 — Full review coming soon.',
    '/reviews/channel-orange-frank-ocean.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 4. Thursday — The Weeknd (9.7)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'thursday-the-weeknd',
    'Thursday',
    'The Weeknd',
    9.7,
    'R&B',
    'mixtape',
    '2011-08-18',
    '9.7/10 — Full review coming soon.',
    '/reviews/thursday-the-weeknd.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 5. Fever — Buckshot & fakemink (9.5)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'fever-buckshot-fakemink',
    'Fever',
    'Buckshot & fakemink',
    9.5,
    'Hip-Hop',
    'single',
    '2025-08-22',
    '9.5/10 — Full review coming soon.',
    '/reviews/fever-buckshot-fakemink.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 6. Blonde — Frank Ocean (9.4)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'blonde-frank-ocean',
    'Blonde',
    'Frank Ocean',
    9.4,
    'R&B',
    'album',
    '2016-08-20',
    '9.4/10 — Full review coming soon.',
    '/reviews/blonde-frank-ocean.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 7. Echoes of Silence — The Weeknd (9.2)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'echoes-of-silence-the-weeknd',
    'Echoes of Silence',
    'The Weeknd',
    9.2,
    'R&B',
    'mixtape',
    '2011-12-21',
    '9.2/10 — Full review coming soon.',
    '/reviews/echoes-of-silence-the-weeknd.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 8. After Hours — The Weeknd (9.0)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'after-hours-the-weeknd',
    'After Hours',
    'The Weeknd',
    9.0,
    'R&B',
    'album',
    '2020-03-20',
    '9.0/10 — Full review coming soon.',
    '/reviews/after-hours-the-weeknd.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 9. In Rainbows — Radiohead (9.0)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'in-rainbows-radiohead',
    'In Rainbows',
    'Radiohead',
    9.0,
    'Alternative',
    'album',
    '2007-10-10',
    '9.0/10 — Full review coming soon.',
    '/reviews/in-rainbows-radiohead.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 10. Playboi Carti — Playboi Carti (8.8)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'playboi-carti-playboi-carti',
    'Playboi Carti',
    'Playboi Carti',
    8.8,
    'Hip-Hop',
    'mixtape',
    '2017-04-14',
    '8.8/10 — Full review coming soon.',
    '/reviews/playboi-carti-playboi-carti.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 11. Get Up — NewJeans (8.8)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'get-up-newjeans',
    'Get Up',
    'NewJeans',
    8.8,
    'Pop',
    'EP',
    '2023-07-21',
    '8.8/10 — Full review coming soon.',
    '/reviews/get-up-newjeans.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 12. Rodeo — Travis Scott (8.7)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'rodeo-travis-scott',
    'Rodeo',
    'Travis Scott',
    8.7,
    'Hip-Hop',
    'album',
    '2015-09-04',
    '8.7/10 — Full review coming soon.',
    '/reviews/rodeo-travis-scott.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 13. Who Really Cares — TV Girl (8.7)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'who-really-cares-tv-girl',
    'Who Really Cares',
    'TV Girl',
    8.7,
    'Alternative',
    'album',
    '2016-03-04',
    '8.7/10 — Full review coming soon.',
    '/reviews/who-really-cares-tv-girl.png',
    true
  ) on conflict (user_id, slug) do nothing;

  -- 14. Die Lit — Playboi Carti (8.3)
  insert into public.reviews (user_id, slug, title, artist, rating, genre, release_type, release_date, snippet, cover_image, is_published)
  values (
    luca_id,
    'die-lit-playboi-carti',
    'Die Lit',
    'Playboi Carti',
    8.3,
    'Hip-Hop',
    'album',
    '2018-05-11',
    '8.3/10 — Full review coming soon.',
    '/reviews/die-lit-playboi-carti.png',
    true
  ) on conflict (user_id, slug) do nothing;

end;
$$;
