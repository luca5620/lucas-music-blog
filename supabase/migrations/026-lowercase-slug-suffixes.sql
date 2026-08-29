-- ============================================================
-- Migration 026 — lowercase slug collision suffixes (2026-08-28)
-- Run AFTER 025 in the Supabase SQL Editor.
--
-- THE BUG (found live): catalog_import_release disambiguates slug
-- collisions by appending the last 4 chars of the source id — but
-- Spotify ids are MIXED CASE, and the suffix was appended raw. So
-- when a second edition of an album came in (e.g. Beauty Behind
-- The Madness), its row got a slug like
--   beauty-behind-the-madness-the-weeknd-GL7s
-- Release pages don't care, but REVIEW slugs are built from the
-- release slug, and chk_reviews_slug_format (migration 005) only
-- allows ^[a-z0-9-]{1,120}$ — so every review of such a release
-- failed its insert and surfaced as "Failed to create review."
--
-- The API now normalizes review slugs defensively either way; this
-- migration fixes the SOURCE so the catalog never mints an
-- uppercase slug again, and lowercases the rows already minted.
--
-- Two changes vs 006's function, both marked with -- (026):
--   * artist suffix:  lower(right(coalesce(a_sp, a_gn), 4))
--   * release suffix: lower(right(coalesce(sp_id, gn_id), 4))
-- Everything else is copied from 006 verbatim.
-- ============================================================

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
  -- Accumulates resolved (artist_id, role, position) rows as we loop.
  -- A plain local array — jsonb_set can't create nested paths.
  resolved   jsonb := '[]'::jsonb;
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
        -- (026) lower(): source ids are mixed-case, slugs are not.
        if exists (select 1 from public.artists where slug = a_slug) then
          a_slug := a_slug || '-' || lower(right(coalesce(a_sp, a_gn), 4));
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

      -- Remember the junction row for after the release insert.
      resolved := resolved || jsonb_build_array(
        jsonb_build_object('artist_id', artist_row.id, 'role', a_role, 'position', pos)
      );
      pos := pos + 1;
    end;
  end loop;

  -- ---- Insert the release (slug disambiguation as above) ----
  -- (026) lower(): source ids are mixed-case, slugs are not.
  if exists (select 1 from public.releases where slug = rel_slug) then
    rel_slug := rel_slug || '-' || lower(right(coalesce(sp_id, gn_id), 4));
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
    from jsonb_array_elements(resolved) as v
  on conflict do nothing;

  return rel;
end;
$$;

revoke all on function public.catalog_import_release(jsonb) from public;
grant execute on function public.catalog_import_release(jsonb) to authenticated;

-- ------------------------------------------------------------
-- Repair the rows already minted with uppercase suffixes.
-- Guarded: skip any row whose lowercased slug is already taken
-- (would trip the unique constraint) — the review API's
-- normalization covers those stragglers anyway.
-- ------------------------------------------------------------
update public.releases r
   set slug = lower(r.slug)
 where r.slug ~ '[A-Z]'
   and not exists (
     select 1 from public.releases o
      where o.slug = lower(r.slug) and o.id <> r.id
   );

update public.artists a
   set slug = lower(a.slug)
 where a.slug ~ '[A-Z]'
   and not exists (
     select 1 from public.artists o
      where o.slug = lower(a.slug) and o.id <> a.id
   );
