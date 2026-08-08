-- =============================================================================
-- Migration 005 — Security Hardening
-- =============================================================================
-- Fixes found in the 2026-08 security audit. Run in the Supabase SQL Editor.
-- Safe to re-run.
--
-- Why DB-level constraints? Some pages write to Supabase directly from the
-- browser (e.g. the profile settings page), so client-side validation can be
-- bypassed by anyone with the browser console. RLS + these constraints are
-- the real security boundary.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 1. CRITICAL: prevent role self-escalation.
--    The base schema's update policy let any user set role = 'owner' on
--    their own profile row. Pin the role column in the with-check clause.
-- ---------------------------------------------------------------------------
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));


-- ---------------------------------------------------------------------------
-- 2. Profile field constraints.
--    "not valid" = only enforced on NEW writes, so any pre-existing rows
--    that would violate a rule don't block the migration.
-- ---------------------------------------------------------------------------
alter table public.profiles drop constraint if exists chk_profiles_username_format;
alter table public.profiles add constraint chk_profiles_username_format
  check (username ~ '^[a-z0-9_-]{3,30}$') not valid;

alter table public.profiles drop constraint if exists chk_profiles_bio_len;
alter table public.profiles add constraint chk_profiles_bio_len
  check (bio is null or char_length(bio) <= 1000) not valid;

alter table public.profiles drop constraint if exists chk_profiles_display_name_len;
alter table public.profiles add constraint chk_profiles_display_name_len
  check (display_name is null or char_length(display_name) <= 60) not valid;

-- URL fields must be https:// — blocks stored-XSS via javascript: URIs,
-- which would execute for every visitor who clicks a profile link.
alter table public.profiles drop constraint if exists chk_profiles_urls_https;
alter table public.profiles add constraint chk_profiles_urls_https
  check (
    (spotify_url      is null or spotify_url      like 'https://%') and
    (soundcloud_url   is null or soundcloud_url   like 'https://%') and
    (statsfm_url      is null or statsfm_url      like 'https://%') and
    (apple_music_url  is null or apple_music_url  like 'https://%') and
    (avatar_url       is null or avatar_url       like 'https://%' or avatar_url like '/%') and
    (banner_url       is null or banner_url       like 'https://%' or banner_url like '/%') and
    (profile_song_url is null or profile_song_url like 'https://%' or profile_song_url like '/%')
  ) not valid;

-- profile_gradient is injected into a CSS background — restrict to a safe
-- charset (no url(), quotes, semicolons or expression tricks).
alter table public.profiles drop constraint if exists chk_profiles_gradient_safe;
alter table public.profiles add constraint chk_profiles_gradient_safe
  check (
    profile_gradient is null
    or (char_length(profile_gradient) <= 300 and profile_gradient ~ '^[a-zA-Z0-9#%(),.\s-]*$')
  ) not valid;

-- profile_color: strict hex color only (it's concatenated into inline styles)
alter table public.profiles drop constraint if exists chk_profiles_color_hex;
alter table public.profiles add constraint chk_profiles_color_hex
  check (profile_color is null or profile_color ~ '^#[0-9a-fA-F]{3,8}$') not valid;


-- ---------------------------------------------------------------------------
-- 3. Content length caps (were unbounded → storage-abuse vector).
-- ---------------------------------------------------------------------------
alter table public.comments drop constraint if exists chk_comments_content_len;
alter table public.comments add constraint chk_comments_content_len
  check (char_length(content) between 1 and 2000) not valid;

alter table public.reviews drop constraint if exists chk_reviews_text_len;
alter table public.reviews add constraint chk_reviews_text_len
  check (
    char_length(title) <= 200 and
    char_length(artist) <= 200 and
    (summary is null or char_length(summary) <= 20000) and
    (snippet is null or char_length(snippet) <= 500)
  ) not valid;

alter table public.reviews drop constraint if exists chk_reviews_slug_format;
alter table public.reviews add constraint chk_reviews_slug_format
  check (slug ~ '^[a-z0-9-]{1,120}$') not valid;


-- ---------------------------------------------------------------------------
-- 4. Respect the username chosen at signup (was silently ignored — the
--    trigger always derived it from the email local-part).
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  _username text;
begin
  -- Prefer the username the user picked at signup (sent in raw_user_meta_data);
  -- fall back to the email local-part if it's missing or invalid.
  _username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if _username !~ '^[a-z0-9_-]{3,30}$' then
    _username := lower(split_part(new.email, '@', 1));
  end if;

  -- Strip non-alphanumeric characters (keep letters, digits, underscores, hyphens)
  _username := regexp_replace(_username, '[^a-z0-9_-]', '', 'g');

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
