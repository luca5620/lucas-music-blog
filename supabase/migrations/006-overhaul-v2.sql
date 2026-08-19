-- ============================================================
-- Migration 006 — Overhaul v2 (2026-08-18)
-- Run AFTER 004 and 005 in the Supabase SQL Editor.
--
-- What this does, in order:
--   1. WIPES all content (reviews, comments, likes, catalog,
--      lists, favorites, rooms). Keeps accounts, roles/badges,
--      and the follow graph.
--   2. Removes the diary feature entirely.
--   3. Adds catalog-source columns (Spotify + Genius) so every
--      review points at a real release — no more hand-typed
--      cover URLs.
--   4. Adds Steam-style profile customization columns.
--   5. Adds debate rooms (topic + two sides + votes + live chat).
--   6. Enforces unique, well-formed usernames (case-insensitive).
--   7. Creates public storage buckets for avatar/banner uploads.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CONTENT WIPE — destructive, by design.
--    truncate ... cascade clears dependent rows (likes, comments,
--    room messages, list items) in one shot.
-- ------------------------------------------------------------
truncate table
  public.reviews,
  public.comments,
  public.review_likes,
  public.artists,
  public.releases,
  public.release_artists,
  public.artist_follows,
  public.release_follows,
  public.release_rooms,
  public.room_messages,
  public.room_reactions,
  public.lists,
  public.list_items,
  public.list_likes,
  public.profile_favorites
cascade;

-- ------------------------------------------------------------
-- 2. DIARY REMOVAL — table, its policies/triggers (dropped with
--    the table), and the stats function.
-- ------------------------------------------------------------
drop table if exists public.diary_entries cascade;
drop function if exists public.get_diary_stats(uuid);

-- ------------------------------------------------------------
-- 3. CATALOG SOURCES — releases/artists can now come from
--    Spotify OR Genius (Genius covers unreleased/leaked work).
--    Rows are created on demand the first time someone reviews
--    or lists a release; source ids make imports idempotent.
-- ------------------------------------------------------------
alter table public.releases
  add column if not exists genius_id text,
  add column if not exists source text not null default 'spotify',
  add column if not exists is_unreleased boolean not null default false;

alter table public.releases
  drop constraint if exists releases_source_check;
alter table public.releases
  add constraint releases_source_check
  check (source in ('spotify', 'genius', 'manual'));

create unique index if not exists idx_releases_genius_id
  on public.releases (genius_id) where genius_id is not null;
create unique index if not exists idx_releases_spotify_id
  on public.releases (spotify_id) where spotify_id is not null;

alter table public.artists
  add column if not exists genius_id text;
create unique index if not exists idx_artists_genius_id
  on public.artists (genius_id) where genius_id is not null;

-- Reviews must reference a real catalog release from now on.
-- (Column already exists from the earlier backfill; make sure,
-- then index it. NOT NULL is enforced at the API layer so any
-- legacy code paths fail soft rather than 500.)
alter table public.reviews
  add column if not exists release_id uuid references public.releases(id) on delete set null;
create index if not exists idx_reviews_release_id on public.reviews (release_id);

-- ------------------------------------------------------------
-- 4. PROFILE CUSTOMIZATION — Steam-style.
--    theme        : named CRT theme (accent palette + effects)
--    showcases    : ordered jsonb array of showcase blocks the
--                   user arranges on their profile, e.g.
--                   [{"type":"favorites"},{"type":"stats"},
--                    {"type":"featured_review"},{"type":"badges"}]
--    pronouns/location/tagline : identity flair
--    featured_review_id : pinned review showcase
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists theme text not null default 'crt-blue',
  add column if not exists showcases jsonb not null default '["favorites","stats","recent_reviews"]'::jsonb,
  add column if not exists pronouns text,
  add column if not exists location text,
  add column if not exists tagline text,
  add column if not exists featured_review_id uuid references public.reviews(id) on delete set null;

alter table public.profiles
  drop constraint if exists profiles_theme_check;
alter table public.profiles
  add constraint profiles_theme_check
  check (theme in ('crt-blue', 'crt-green', 'crt-amber', 'crt-rose', 'crt-mono', 'vhs-static'));

-- Keep flair fields short — these render everywhere.
alter table public.profiles
  drop constraint if exists profiles_pronouns_len,
  drop constraint if exists profiles_location_len,
  drop constraint if exists profiles_tagline_len;
alter table public.profiles
  add constraint profiles_pronouns_len check (pronouns is null or char_length(pronouns) <= 30),
  add constraint profiles_location_len check (location is null or char_length(location) <= 60),
  add constraint profiles_tagline_len  check (tagline  is null or char_length(tagline)  <= 120);

-- ------------------------------------------------------------
-- 5. DEBATES — "Real app" style: a topic, two sides, a vote,
--    and a live chat where your message is badged with the side
--    you picked. Optionally tied to a release.
-- ------------------------------------------------------------
create table if not exists public.debates (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  title         text not null check (char_length(title) between 3 and 140),
  prompt        text check (prompt is null or char_length(prompt) <= 500),
  side_a_label  text not null check (char_length(side_a_label) between 1 and 40),
  side_b_label  text not null check (char_length(side_b_label) between 1 and 40),
  release_id    uuid references public.releases(id) on delete set null,
  created_by    uuid not null references public.profiles(id) on delete cascade,
  status        text not null default 'open' check (status in ('open', 'closed')),
  message_count integer not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_debates_created_at on public.debates (created_at desc);
create index if not exists idx_debates_release on public.debates (release_id);

create table if not exists public.debate_votes (
  debate_id  uuid not null references public.debates(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  side       text not null check (side in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (debate_id, user_id)
);

create table if not exists public.debate_messages (
  id         uuid primary key default gen_random_uuid(),
  debate_id  uuid not null references public.debates(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  side       text check (side in ('a', 'b')),
  content    text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_debate_messages_debate
  on public.debate_messages (debate_id, created_at desc);

alter table public.debates enable row level security;
alter table public.debate_votes enable row level security;
alter table public.debate_messages enable row level security;

drop policy if exists "Debates are viewable by everyone" on public.debates;
create policy "Debates are viewable by everyone"
  on public.debates for select using (true);

drop policy if exists "Authenticated users can create debates" on public.debates;
create policy "Authenticated users can create debates"
  on public.debates for insert
  with check (auth.uid() = created_by);

drop policy if exists "Creators can update their debates" on public.debates;
create policy "Creators can update their debates"
  on public.debates for update
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

drop policy if exists "Creators can delete their debates" on public.debates;
create policy "Creators can delete their debates"
  on public.debates for delete using (auth.uid() = created_by);

drop policy if exists "Votes are viewable by everyone" on public.debate_votes;
create policy "Votes are viewable by everyone"
  on public.debate_votes for select using (true);

drop policy if exists "Users vote as themselves" on public.debate_votes;
create policy "Users vote as themselves"
  on public.debate_votes for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can change their vote" on public.debate_votes;
create policy "Users can change their vote"
  on public.debate_votes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Debate messages are viewable by everyone" on public.debate_messages;
create policy "Debate messages are viewable by everyone"
  on public.debate_messages for select using (true);

drop policy if exists "Users post debate messages as themselves" on public.debate_messages;
create policy "Users post debate messages as themselves"
  on public.debate_messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete their own debate messages" on public.debate_messages;
create policy "Users can delete their own debate messages"
  on public.debate_messages for delete using (auth.uid() = user_id);

-- Keep debates.message_count fresh without client-side counting.
create or replace function public.bump_debate_message_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  update public.debates
     set message_count = message_count + 1
   where id = new.debate_id;
  return new;
end;
$$;

drop trigger if exists trg_debate_message_count on public.debate_messages;
create trigger trg_debate_message_count
  after insert on public.debate_messages
  for each row execute function public.bump_debate_message_count();

-- Realtime for live debate chat (release rooms already publish).
do $$
begin
  alter publication supabase_realtime add table public.debate_messages;
exception when duplicate_object then null;
end $$;

-- ------------------------------------------------------------
-- 6. USERNAME HARDENING — one account per name regardless of
--    case, and a sane format (3-20 chars: a-z, 0-9, underscore).
--    Existing usernames that violate the format are left alone
--    (constraint is NOT VALID so it only applies to new rows).
-- ------------------------------------------------------------
create unique index if not exists idx_profiles_username_lower
  on public.profiles (lower(username));

alter table public.profiles
  drop constraint if exists profiles_username_format;
alter table public.profiles
  add constraint profiles_username_format
  check (username ~ '^[a-zA-Z0-9_]{3,20}$') not valid;

-- ------------------------------------------------------------
-- 7. STORAGE — real avatar/banner uploads instead of pasted
--    URLs. Public read; users can only write inside a folder
--    named after their own user id ("<uid>/avatar.png").
-- ------------------------------------------------------------
-- ------------------------------------------------------------
-- 7.5 ON-DEMAND CATALOG IMPORT — regular users can't insert
--     into artists/releases directly (RLS: admin-only, by
--     design). Instead the app calls this SECURITY DEFINER
--     function with server-shaped Spotify/Genius data. It is
--     INSERT-ONLY: existing rows are never modified, so a
--     malicious caller can at worst add a well-formed release —
--     never vandalize one. All inputs are validated here again.
-- ------------------------------------------------------------
create or replace function public.catalog_import_release(payload jsonb)
returns public.releases
language plpgsql
security definer set search_path = public
as $$
declare
  rel        public.releases;
  rel_slug   text;
  rel_title  text;
  rel_type   text;
  rel_date   date;
  cover      text;
  sp_id      text;
  gn_id      text;
  unreleased boolean;
  tracks     jsonb;
  pop        integer;
  a          jsonb;
  artist_row public.artists;
  primary_id uuid;
  pos        integer := 0;
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;

  -- ---- Validate + coerce release fields ----
  rel_title := trim(payload->'release'->>'title');
  rel_slug  := payload->'release'->>'slug';
  rel_type  := payload->'release'->>'release_type';
  cover     := payload->'release'->>'cover_image';
  sp_id     := nullif(payload->'release'->>'spotify_id', '');
  gn_id     := nullif(payload->'release'->>'genius_id', '');
  unreleased := coalesce((payload->'release'->>'is_unreleased')::boolean, false);
  tracks    := coalesce(payload->'release'->'tracks', '[]'::jsonb);
  pop       := (payload->'release'->>'popularity')::integer;
  begin
    rel_date := (payload->'release'->>'release_date')::date;
  exception when others then
    rel_date := null;
  end;

  if rel_title is null or char_length(rel_title) not between 1 and 300 then
    raise exception 'invalid release title';
  end if;
  if rel_slug is null or rel_slug !~ '^[a-z0-9-]{1,160}$' then
    raise exception 'invalid release slug';
  end if;
  if rel_type not in ('single', 'EP', 'album', 'mixtape', 'compilation') then
    raise exception 'invalid release type';
  end if;
  if cover is not null and cover !~ '^https://' then
    raise exception 'invalid cover url';
  end if;
  if sp_id is null and gn_id is null then
    raise exception 'release needs a spotify_id or genius_id';
  end if;
  if jsonb_typeof(tracks) <> 'array' or jsonb_array_length(tracks) > 120 then
    raise exception 'invalid tracks payload';
  end if;
  if jsonb_array_length(coalesce(payload->'artists', '[]'::jsonb)) not between 1 and 30 then
    raise exception 'invalid artists payload';
  end if;

  -- ---- Already imported? Return the existing row untouched. ----
  if sp_id is not null then
    select * into rel from public.releases where spotify_id = sp_id;
    if found then return rel; end if;
  end if;
  if gn_id is not null then
    select * into rel from public.releases where genius_id = gn_id;
    if found then return rel; end if;
  end if;

  -- ---- Insert artists (insert-only, keyed by source id) ----
  for a in select * from jsonb_array_elements(payload->'artists')
  loop
    declare
      a_name  text := trim(a->>'name');
      a_slug  text := a->>'slug';
      a_sp    text := nullif(a->>'spotify_id', '');
      a_gn    text := nullif(a->>'genius_id', '');
      a_img   text := a->>'image_url';
      a_role  text := coalesce(a->>'role', 'primary');
    begin
      if a_name is null or char_length(a_name) not between 1 and 200 then
        raise exception 'invalid artist name';
      end if;
      if a_slug is null or a_slug !~ '^[a-z0-9-]{1,160}$' then
        raise exception 'invalid artist slug';
      end if;
      if a_img is not null and a_img !~ '^https://' then
        raise exception 'invalid artist image url';
      end if;
      if a_role not in ('primary', 'feature', 'producer', 'remix') then
        raise exception 'invalid artist role';
      end if;

      artist_row := null;
      if a_sp is not null then
        select * into artist_row from public.artists where spotify_id = a_sp;
      end if;
      if artist_row.id is null and a_gn is not null then
        select * into artist_row from public.artists where genius_id = a_gn;
      end if;
      if artist_row.id is null then
        -- Disambiguate slug collisions with a source-id suffix.
        if exists (select 1 from public.artists where slug = a_slug) then
          a_slug := a_slug || '-' || right(coalesce(a_sp, a_gn), 4);
        end if;
        insert into public.artists (slug, name, spotify_id, genius_id, image_url, genres, popularity)
        values (
          a_slug, a_name, a_sp, a_gn, a_img,
          coalesce(
            (select array_agg(x) from jsonb_array_elements_text(coalesce(a->'genres', '[]'::jsonb)) x),
            '{}'
          ),
          (a->>'popularity')::integer
        )
        returning * into artist_row;
      end if;

      if pos = 0 then
        primary_id := artist_row.id;
      end if;

      -- Attach to release later; remember via temp table-free approach:
      -- stash (artist_id, role, position) pairs in a jsonb accumulator.
      payload := jsonb_set(
        payload,
        array['_resolved', pos::text],
        jsonb_build_object('artist_id', artist_row.id, 'role', a_role, 'position', pos),
        true
      );
      pos := pos + 1;
    end;
  end loop;

  -- ---- Insert the release (slug disambiguation as above) ----
  if exists (select 1 from public.releases where slug = rel_slug) then
    rel_slug := rel_slug || '-' || right(coalesce(sp_id, gn_id), 4);
  end if;

  insert into public.releases
    (slug, title, primary_artist_id, release_type, release_date,
     cover_image, spotify_id, genius_id, source, is_unreleased,
     description, tracks, popularity)
  values
    (rel_slug, rel_title, primary_id, rel_type, rel_date,
     cover, sp_id, gn_id,
     case when sp_id is not null then 'spotify' else 'genius' end,
     unreleased, null, tracks, pop)
  returning * into rel;

  insert into public.release_artists (release_id, artist_id, role, position)
  select rel.id,
         (v->>'artist_id')::uuid,
         v->>'role',
         (v->>'position')::integer
    from jsonb_each(coalesce(payload->'_resolved', '{}'::jsonb)) as e(k, v)
  on conflict do nothing;

  return rel;
end;
$$;

revoke all on function public.catalog_import_release(jsonb) from public;
grant execute on function public.catalog_import_release(jsonb) to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly readable" on storage.objects;
create policy "Avatar images are publicly readable"
  on storage.objects for select
  using (bucket_id in ('avatars', 'banners'));

drop policy if exists "Users upload to their own folder" on storage.objects;
create policy "Users upload to their own folder"
  on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'banners')
    and auth.role() = 'authenticated'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update files in their own folder" on storage.objects;
create policy "Users update files in their own folder"
  on storage.objects for update
  using (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete files in their own folder" on storage.objects;
create policy "Users delete files in their own folder"
  on storage.objects for delete
  using (
    bucket_id in ('avatars', 'banners')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
