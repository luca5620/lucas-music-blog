-- ============================================================
-- Migration 039 — profile badges, connected platforms, debate sides
-- (2026-09-02). Run in the Supabase SQL Editor after 038.
--
-- Three of Luca's asks from one session, in one file so there is
-- ONE thing to run on the dashboard:
--
--   A. CONNECTED PLATFORMS — five new link columns (Instagram, X,
--      Discord, Amazon Music, YouTube Music) next to the four that
--      already exist, plus `visible_links`: the ORDERED list of
--      platform keys the member wants shown on their profile, left
--      to right. NULL = legacy behaviour (every saved link shows in
--      the default order), an empty array = show none.
--
--   B. BADGES — the reviews trophy, likes trophy and years-of-
--      service badge are COMPUTED from data that already exists
--      (review count, likes received, created_at), so they need no
--      storage. This section is the home for badges that CAN'T be
--      computed: event badges ("Release Night: <album>", "Beta
--      2026", contest winners…). `profile_badges` is one row per
--      award; the app renders whichever keys it knows about, so a
--      badge that predates a deploy simply doesn't show until the
--      code catches up (never crashes). Awarded only through
--      award_badge() — same owner-only, security-definer shape as
--      grant_badge (migration 019) — never by a plain insert.
--
--   C. DEBATE SIDES — a debate can now tie EACH side to a release
--      (side A = album X, side B = album Y). The old whole-debate
--      `release_id` ("pin a release") stays for single-topic rooms.
-- ============================================================

-- ---------- A. connected platforms ----------

alter table public.profiles
  add column if not exists instagram_url     text,
  add column if not exists x_url             text,
  add column if not exists discord_url       text,
  add column if not exists amazon_music_url  text,
  add column if not exists youtube_music_url text,
  -- Ordered platform keys, e.g. '{spotify,instagram,discord}'. The
  -- app validates keys; the check only bounds the size so a bad
  -- client can't store a novel here.
  add column if not exists visible_links     text[];

alter table public.profiles
  drop constraint if exists profiles_visible_links_size,
  add constraint profiles_visible_links_size check (
    visible_links is null or cardinality(visible_links) <= 12
  );

-- Domain allow-lists, mirroring migration 011: a link is only ever
-- the platform it claims to be (defence in depth — the settings page
-- rejects anything else before it gets here, and the profile page
-- re-checks before rendering). All `not valid` so existing rows
-- can never block the migration.
alter table public.profiles
  drop constraint if exists profiles_instagram_url_domain,
  drop constraint if exists profiles_x_url_domain,
  drop constraint if exists profiles_discord_url_domain,
  drop constraint if exists profiles_amazon_music_url_domain,
  drop constraint if exists profiles_youtube_music_url_domain;

alter table public.profiles
  add constraint profiles_instagram_url_domain check (
    instagram_url is null
    or instagram_url like 'https://instagram.com/%'
    or instagram_url like 'https://www.instagram.com/%'
  ) not valid,
  add constraint profiles_x_url_domain check (
    x_url is null
    or x_url like 'https://x.com/%'
    or x_url like 'https://www.x.com/%'
    or x_url like 'https://twitter.com/%'
    or x_url like 'https://www.twitter.com/%'
  ) not valid,
  add constraint profiles_discord_url_domain check (
    discord_url is null
    or discord_url like 'https://discord.gg/%'
    or discord_url like 'https://discord.com/%'
    or discord_url like 'https://www.discord.com/%'
    or discord_url like 'https://discordapp.com/%'
  ) not valid,
  add constraint profiles_amazon_music_url_domain check (
    amazon_music_url is null
    or amazon_music_url like 'https://music.amazon.%'
  ) not valid,
  add constraint profiles_youtube_music_url_domain check (
    youtube_music_url is null
    or youtube_music_url like 'https://music.youtube.com/%'
    or youtube_music_url like 'https://www.youtube.com/%'
    or youtube_music_url like 'https://youtube.com/%'
  ) not valid;

-- ---------- B. awarded badges ----------

create table if not exists public.profile_badges (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  -- Machine key the app maps to art + label, e.g. 'beta_2026',
  -- 'release_night_utopia'. Unknown keys are ignored by the renderer.
  badge_key   text not null check (badge_key ~ '^[a-z0-9_-]{2,40}$'),
  -- Optional flavour shown in the badge's tooltip ("Won the
  -- September debate cup").
  note        text check (note is null or char_length(note) <= 140),
  awarded_at  timestamptz not null default now(),
  unique (user_id, badge_key)
);

create index if not exists idx_profile_badges_user on public.profile_badges(user_id);

alter table public.profile_badges enable row level security;

-- World-readable (they're on public profiles); NO insert/update/
-- delete policy for anyone — award_badge() below is the only door.
drop policy if exists "Badges are viewable by everyone" on public.profile_badges;
create policy "Badges are viewable by everyone"
  on public.profile_badges for select using (true);

-- award_badge(username, key, note) — founder only, like grant_badge.
-- Idempotent: awarding the same key twice just updates the note.
-- Pass revoke := true to take one back.
create or replace function public.award_badge(
  target_username text,
  badge_key       text,
  note            text default null,
  revoke          boolean default false
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_id   uuid;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'owner' then
    raise exception 'Only the founder can award badges';
  end if;

  select id into target_id
    from public.profiles
   where lower(username) = lower(trim(target_username));
  if target_id is null then
    raise exception 'No user named "%"', target_username;
  end if;

  if revoke then
    delete from public.profile_badges
     where user_id = target_id and profile_badges.badge_key = award_badge.badge_key;
    return 'revoked';
  end if;

  insert into public.profile_badges (user_id, badge_key, note)
  values (target_id, award_badge.badge_key, award_badge.note)
  on conflict (user_id, badge_key)
  do update set note = excluded.note;
  return 'awarded';
end;
$$;

revoke all on function public.award_badge(text, text, text, boolean) from public, anon;
grant execute on function public.award_badge(text, text, text, boolean) to authenticated;

-- ---------- C. debate sides ----------

alter table public.debates
  add column if not exists side_a_release_id uuid references public.releases(id) on delete set null,
  add column if not exists side_b_release_id uuid references public.releases(id) on delete set null;

create index if not exists idx_debates_side_a_release on public.debates(side_a_release_id);
create index if not exists idx_debates_side_b_release on public.debates(side_b_release_id);

-- PostgREST caches the schema — without this the new columns 404
-- until the next restart.
notify pgrst, 'reload schema';
