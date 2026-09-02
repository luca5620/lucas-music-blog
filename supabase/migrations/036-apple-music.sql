-- ---------------------------------------------------------------------------
-- 036 — Apple Music preview player (Luca 2026-09-02)
--
-- One preview player per release page, never two: the viewer picks
-- Spotify (default) or Apple Music in Settings, and the release page
-- shows that one. Apple's player is the public embed
-- (embed.music.apple.com) — 30s previews for everyone, full playback
-- for Apple Music subscribers signed in to their browser — so no
-- MusicKit developer key is involved anywhere.
--
-- The Apple side of a release is resolved lazily the first time an
-- Apple-preferring viewer opens it: Spotify gives us the UPC/ISRC,
-- Apple's public lookup (itunes.apple.com/lookup) turns that into an
-- Apple Music album id, and we cache it here so every later view is
-- free. apple_music_checked_at records a miss so we don't re-ask
-- Apple on every render for releases Apple doesn't carry.
-- ---------------------------------------------------------------------------

alter table public.releases
  add column if not exists apple_music_id text,
  add column if not exists apple_music_checked_at timestamptz;

-- "collectionId" for albums, "collectionId:trackId" for single-track
-- releases (the embed needs both to open on the song).
alter table public.releases
  drop constraint if exists releases_apple_music_id_shape;
alter table public.releases
  add constraint releases_apple_music_id_shape
  check (apple_music_id is null or apple_music_id ~ '^[0-9]{1,20}(:[0-9]{1,20})?$');

comment on column public.releases.apple_music_id is
  'Apple Music album id, or album:track for singles. Resolved lazily via the public iTunes lookup; null + checked_at = looked, not found.';

alter table public.profiles
  add column if not exists preferred_player text not null default 'spotify';

alter table public.profiles
  drop constraint if exists profiles_preferred_player_check;
alter table public.profiles
  add constraint profiles_preferred_player_check
  check (preferred_player in ('spotify', 'apple'));

comment on column public.profiles.preferred_player is
  'Which preview player release pages show this member: spotify (default) or apple.';

-- Regular members can't write to releases (RLS: owners/admins only),
-- and the lookup runs in the viewer's own request, so the cache write
-- goes through a narrow SECURITY DEFINER door — same pattern as
-- catalog_import_release. It only ever fills an EMPTY apple_music_id
-- and stamps checked_at; it can't overwrite or clear a real value.
create or replace function public.catalog_set_apple_music(
  p_release_id uuid,
  p_apple_id   text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_apple_id is not null and p_apple_id !~ '^[0-9]{1,20}(:[0-9]{1,20})?$' then
    raise exception 'BAD_APPLE_ID';
  end if;

  update public.releases
     set apple_music_id = coalesce(apple_music_id, p_apple_id),
         apple_music_checked_at = now()
   where id = p_release_id;
end;
$$;

revoke all on function public.catalog_set_apple_music(uuid, text) from public;
grant execute on function public.catalog_set_apple_music(uuid, text) to authenticated;

notify pgrst, 'reload schema';
