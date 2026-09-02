-- ---------------------------------------------------------------------------
-- 035 — Spotify playlists (Luca 2026-09-02)
--
-- Three doors for a playlist:
--   1. a POST can carry one (embedded on the post page, like a video)
--   2. any signed-in member can turn a playlist into a LIST of theirs
--      (no schema change — list_items already allows release_id null)
--   3. a PROFILE can feature one (embedded under the profile song)
--
-- We store ONLY the Spotify playlist id (22 base62 chars), never the
-- pasted URL — the embed iframe src is rebuilt from a fixed template
-- + the validated id, same XSS posture as posts.video_id.
-- ---------------------------------------------------------------------------

alter table public.posts
  add column if not exists playlist_id text;

alter table public.posts
  drop constraint if exists posts_playlist_id_shape;
alter table public.posts
  add constraint posts_playlist_id_shape
  check (playlist_id is null or playlist_id ~ '^[A-Za-z0-9]{22}$');

comment on column public.posts.playlist_id is
  'Spotify playlist id embedded on the post (validated shape, never a URL).';

alter table public.profiles
  add column if not exists featured_playlist_id text;

alter table public.profiles
  drop constraint if exists profiles_featured_playlist_id_shape;
alter table public.profiles
  add constraint profiles_featured_playlist_id_shape
  check (featured_playlist_id is null or featured_playlist_id ~ '^[A-Za-z0-9]{22}$');

comment on column public.profiles.featured_playlist_id is
  'Spotify playlist id shown on the profile (validated shape, never a URL).';

-- Reload PostgREST's schema cache so the new columns are visible
-- immediately (otherwise the first writes 400 with "column not found").
notify pgrst, 'reload schema';
