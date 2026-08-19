-- ============================================================
-- Migration 011 — profile links locked to their real domains
-- Run in the Supabase SQL Editor after 010.
--
-- Profile link fields render as clickable links on PUBLIC pages,
-- and nothing stopped a user from saving any URL in any slot
-- (this was found being abused in the wild on day two). Fix:
--   1. Scrub existing links that aren't from the right domain.
--   2. CHECK constraints so it can never happen again — enforced
--      at the database, so even direct API calls can't bypass it.
-- ============================================================

-- ---- 1. Scrub bad existing data ----
update public.profiles
   set spotify_url = null
 where spotify_url is not null
   and spotify_url not like 'https://open.spotify.com/%';

update public.profiles
   set soundcloud_url = null
 where soundcloud_url is not null
   and soundcloud_url not like 'https://soundcloud.com/%'
   and soundcloud_url not like 'https://www.soundcloud.com/%'
   and soundcloud_url not like 'https://on.soundcloud.com/%';

update public.profiles
   set statsfm_url = null
 where statsfm_url is not null
   and statsfm_url not like 'https://stats.fm/%'
   and statsfm_url not like 'https://www.stats.fm/%'
   and statsfm_url not like 'https://spotistats.app/%';

update public.profiles
   set apple_music_url = null
 where apple_music_url is not null
   and apple_music_url not like 'https://music.apple.com/%';

-- Profile songs are app-generated now: Spotify 30s previews, Spotify
-- track pages, or our own release pages. Anything else predates the
-- catalog picker (or was hand-crafted) — clear it.
update public.profiles
   set profile_song_url = null,
       profile_song_title = null
 where profile_song_url is not null
   and profile_song_url not like 'https://p.scdn.co/%'
   and profile_song_url not like 'https://open.spotify.com/%'
   and profile_song_url not like '/releases/%';

-- ---- 2. Constraints so it stays clean ----
alter table public.profiles
  drop constraint if exists profiles_spotify_url_domain,
  drop constraint if exists profiles_soundcloud_url_domain,
  drop constraint if exists profiles_statsfm_url_domain,
  drop constraint if exists profiles_apple_music_url_domain,
  drop constraint if exists profiles_profile_song_url_domain;

alter table public.profiles
  add constraint profiles_spotify_url_domain check (
    spotify_url is null or spotify_url like 'https://open.spotify.com/%'
  ),
  add constraint profiles_soundcloud_url_domain check (
    soundcloud_url is null
    or soundcloud_url like 'https://soundcloud.com/%'
    or soundcloud_url like 'https://www.soundcloud.com/%'
    or soundcloud_url like 'https://on.soundcloud.com/%'
  ),
  add constraint profiles_statsfm_url_domain check (
    statsfm_url is null
    or statsfm_url like 'https://stats.fm/%'
    or statsfm_url like 'https://www.stats.fm/%'
    or statsfm_url like 'https://spotistats.app/%'
  ),
  add constraint profiles_apple_music_url_domain check (
    apple_music_url is null or apple_music_url like 'https://music.apple.com/%'
  ),
  add constraint profiles_profile_song_url_domain check (
    profile_song_url is null
    or profile_song_url like 'https://p.scdn.co/%'
    or profile_song_url like 'https://open.spotify.com/%'
    or profile_song_url like '/releases/%'
  );
