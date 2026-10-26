-- ============================================================
-- Migration 066 — merge duplicate records + artists (2026-10-26)
-- Run in the Supabase SQL Editor (after 065). Nothing to paste in.
-- The merge runs as ONE block: if anything fails, nothing changes.
-- Re-running is safe (already-merged pairs are skipped).
--
-- WHY (Luca 2026-10-26: "merge the duplicate albums thats a must"):
-- the catalog had the same record twice — Spotify keeps several album
-- ids for one record (two "Beauty Behind The Madness", plus deluxe /
-- anniversary editions of Morning Glory, Dark Side of the Moon and
-- Fragile) — and 10 artists twice (an artist first seen on Genius,
-- through a leak, then again from Spotify: The Weeknd, Kanye West,
-- Playboi Carti, Nettspend, Lil Uzi Vert, Ariana Grande, Che,
-- Juice WRLD, Yes, Pearl Jam). Reviews and artist pages split in two.
--
-- WHAT IT DOES
--   1. public.slug_redirects — old page addresses → the kept page, so
--      links and Google results to a merged copy still land.
--   2. public.catalog_merge() — moves EVERYTHING pointing at the copy
--      (reviews, ratings, saves, lists, rooms, posts …, found
--      automatically from the foreign keys, so a table added later is
--      covered too) onto the kept row, then deletes the copy. Triggers
--      are paused while rows move, so moved reviews don't turn into
--      "Edited today" and nobody gets notified.
--   3. Merges the 4 records + 10 artists found on 2026-10-26.
--      Kept: the standard edition / the Spotify artist. Nobody had
--      reviewed both copies, so no review is lost (7 reviews move).
--      "Echoes Of Silence" (single) vs the album is NOT a duplicate.
--   4. Stops new copies: catalog_import_release now matches an artist
--      by name when the source is new, and a Spotify record by
--      artist + type + title-without-edition-tags.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Redirects for merged pages
-- ------------------------------------------------------------
create table if not exists public.slug_redirects (
  kind       text not null check (kind in ('release', 'artist')),
  old_slug   text not null,
  new_slug   text not null,
  created_at timestamptz not null default now(),
  primary key (kind, old_slug)
);

alter table public.slug_redirects enable row level security;

drop policy if exists "Slug redirects are public" on public.slug_redirects;
create policy "Slug redirects are public"
  on public.slug_redirects for select using (true);


-- ------------------------------------------------------------
-- 2. Title key: lowercase, edition tags stripped.
--    "(What's The Story) Morning Glory? (Deluxe Remastered Edition)"
--    and "The Dark Side Of The Moon (50th Anniversary) [2023 Remaster]"
--    → "what s the story morning glory" / "the dark side of the moon".
--    "(Original)", "(Version 2)", "(Remix)" are kept on purpose.
-- ------------------------------------------------------------
create or replace function public.release_title_key(p_title text)
returns text
language sql
immutable
as $fn$
  select trim(regexp_replace(
           regexp_replace(
             regexp_replace(
               lower(coalesce(p_title, '')),
               '\s*[\(\[][^\)\]]*(deluxe|remaster|anniversary|expanded|edition|explicit|clean|bonus)[^\)\]]*[\)\]]',
               '', 'g'),
             '\s+-\s+[^-]*(deluxe|remaster|anniversary|edition).*$', '', 'g'),
           '[^a-z0-9]+', ' ', 'g'));
$fn$;


-- ------------------------------------------------------------
-- 3. The merge. p_table is public.releases or public.artists.
-- ------------------------------------------------------------
create or replace function public.catalog_merge(p_table regclass, p_keep uuid, p_dup uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
declare
  fk       record;
  ux       record;
  v_attnum smallint;
  v_match  text;
begin
  if p_keep is null or p_dup is null or p_keep = p_dup then
    return;
  end if;

  -- Every single-column foreign key that points at p_table.
  for fk in
    select c.conrelid::regclass as tbl, a.attname as col, c.conkey[1] as attnum
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
     where c.contype = 'f'
       and c.confrelid = p_table
       and array_length(c.conkey, 1) = 1
  loop
    -- Pause that table's own triggers (updated_at stamps, notifications,
    -- catalog checks). Re-enabled below; a failure rolls this back too.
    execute format('alter table %s disable trigger user', fk.tbl);

    -- A unique rule that includes the column (one review per person per
    -- record, one room per record …): if the KEPT row already has the
    -- same entry, the copy's entry goes instead of colliding.
    for ux in
      select i.indexrelid,
             array(select att.attname
                     from pg_attribute att
                    where att.attrelid = i.indrelid
                      and att.attnum = any(i.indkey::smallint[])
                      and att.attnum <> fk.attnum) as others
        from pg_index i
       where i.indrelid = fk.tbl
         and i.indisunique
         and i.indexprs is null
         and fk.attnum = any(i.indkey::smallint[])
    loop
      select coalesce(string_agg(format('k.%1$I is not distinct from d.%1$I', o), ' and '), 'true')
        into v_match
        from unnest(ux.others) as o;
      execute format(
        'delete from %1$s d where d.%2$I = $2 and exists '
        '(select 1 from %1$s k where k.%2$I = $1 and %3$s)',
        fk.tbl, fk.col, v_match)
        using p_keep, p_dup;
    end loop;

    execute format('update %1$s set %2$I = $1 where %2$I = $2', fk.tbl, fk.col)
      using p_keep, p_dup;

    execute format('alter table %s enable trigger user', fk.tbl);
  end loop;

  execute format('delete from %s where id = $1', p_table) using p_dup;
end;
$fn$;

revoke all on function public.catalog_merge(regclass, uuid, uuid)
  from public, anon, authenticated;


-- ------------------------------------------------------------
-- 4. The 2026-10-26 duplicates (by slug: stable, readable).
--    Artists first; then records; then the kept artists whose
--    page address had an id suffix get the clean one.
-- ------------------------------------------------------------
do $$
declare
  pair   text[];
  v_keep public.artists;
  v_dup  public.artists;
  r_keep public.releases;
  r_dup  public.releases;
begin
  -- Artists: { kept (Spotify) slug, copy slug }
  foreach pair slice 1 in array array[
    ['kanye-west',        'kanye-west-72'],
    ['the-weeknd',        'the-weeknd-2358'],
    ['playboi-carti',     'playboi-carti-9976'],
    ['nettspend',         'nettspend-6257'],
    ['lil-uzi-vert-xpfz', 'lil-uzi-vert'],
    ['ariana-grande',     'ariana-grande-6507'],
    ['che-kumf',          'che'],
    ['juice-wrld-memz',   'juice-wrld'],
    ['yes-7qil',          'yes'],
    ['pearl-jam',         'pearl-jam-2696']
  ]
  loop
    select * into v_keep from public.artists where slug = pair[1];
    select * into v_dup  from public.artists where slug = pair[2];
    continue when v_keep.id is null or v_dup.id is null;

    perform public.catalog_merge('public.artists', v_keep.id, v_dup.id);
    -- The kept row learns the copy's Genius id (future leaks match it).
    update public.artists
       set genius_id = coalesce(genius_id, v_dup.genius_id),
           image_url = coalesce(image_url, v_dup.image_url)
     where id = v_keep.id;
    insert into public.slug_redirects (kind, old_slug, new_slug)
    values ('artist', v_dup.slug, v_keep.slug)
    on conflict (kind, old_slug) do update set new_slug = excluded.new_slug;
  end loop;

  -- Clean addresses for kept artists that only had a suffixed one
  -- (/artists/lil-uzi-vert, not /artists/lil-uzi-vert-xpfz).
  foreach pair slice 1 in array array[
    ['lil-uzi-vert-xpfz', 'lil-uzi-vert'],
    ['che-kumf',          'che'],
    ['juice-wrld-memz',   'juice-wrld'],
    ['yes-7qil',          'yes']
  ]
  loop
    continue when not exists (select 1 from public.artists where slug = pair[1])
               or exists (select 1 from public.artists where slug = pair[2]);
    update public.artists set slug = pair[2] where slug = pair[1];
    -- Old suffixed address → clean one; earlier redirects follow along.
    insert into public.slug_redirects (kind, old_slug, new_slug)
    values ('artist', pair[1], pair[2])
    on conflict (kind, old_slug) do update set new_slug = excluded.new_slug;
    update public.slug_redirects set new_slug = pair[2]
     where kind = 'artist' and new_slug = pair[1];
    delete from public.slug_redirects where kind = 'artist' and old_slug = pair[2];
  end loop;

  -- Records: { kept slug, copy slug }
  foreach pair slice 1 in array array[
    ['whats-the-story-morning-glory-oasis', 'whats-the-story-morning-glory-deluxe-remastered-edition-oasis'],
    ['beauty-behind-the-madness-the-weeknd', 'beauty-behind-the-madness-the-weeknd-gl7s'],
    ['the-dark-side-of-the-moon-pink-floyd', 'the-dark-side-of-the-moon-50th-anniversary-2023-remaster-pink-floyd'],
    ['fragile-yes', 'fragile-super-deluxe-yes']
  ]
  loop
    select * into r_keep from public.releases where slug = pair[1];
    select * into r_dup  from public.releases where slug = pair[2];
    continue when r_keep.id is null or r_dup.id is null;

    -- No song ratings sit on the copies (checked 2026-10-26), so the
    -- per-position track ratings need no remapping.
    perform public.catalog_merge('public.releases', r_keep.id, r_dup.id);
    insert into public.slug_redirects (kind, old_slug, new_slug)
    values ('release', r_dup.slug, r_keep.slug)
    on conflict (kind, old_slug) do update set new_slug = excluded.new_slug;
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 5. The import, with the two "is this already here?" checks added
--    (marked (066) below; the rest is 026's function unchanged).
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
      -- (066) Same name, but this source id is new to us: the artist
      -- came in from the OTHER source before (a Genius leak, then a
      -- Spotify album). Use that row and remember this id on it, instead
      -- of minting a second "The Weeknd". Only a row that doesn't have
      -- an id of this kind yet — two different Spotify artists who share
      -- a name stay two artists.
      if artist_row.id is null then
        select * into artist_row
          from public.artists x
         where lower(x.name) = lower(a_name)
           and ((a_sp is not null and x.spotify_id is null)
             or (a_gn is not null and x.genius_id is null))
         order by x.created_at
         limit 1;
        if artist_row.id is not null then
          update public.artists
             set spotify_id = coalesce(spotify_id, a_sp),
                 genius_id  = coalesce(genius_id, a_gn)
           where id = artist_row.id
          returning * into artist_row;
        end if;
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

  -- ---- (066) Same record under another Spotify id? ----
  -- Spotify keeps several album ids for one record (regional copies,
  -- deluxe and anniversary editions). Same primary artist, same type,
  -- same title once edition tags are stripped → hand back the one we
  -- already have, so its reviews don't split across two pages.
  -- Spotify-only on both sides: Genius leaks ("Not Real (Version 2)")
  -- are deliberately distinct songs.
  if sp_id is not null then
    select r.* into rel
      from public.releases r
     where r.primary_artist_id = primary_id
       and r.release_type = rel_type
       and r.spotify_id is not null
       and public.release_title_key(r.title) = public.release_title_key(rel_title)
     order by r.created_at
     limit 1;
    if found then return rel; end if;
  end if;

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

notify pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verify:
--   select * from public.slug_redirects order by kind, old_slug;   -- 14 rows
--   select name, count(*) from public.artists group by 1 having count(*) > 1;  -- none
--   select title, slug from public.releases where title ilike '%beauty behind%';  -- one
-- ------------------------------------------------------------
