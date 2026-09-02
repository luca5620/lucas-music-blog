-- ============================================================
-- Migration 037 — remember which album a list item came from
-- (2026-09-02). Run in the Supabase SQL Editor after 036.
--
-- Playlist imports (/api/lists/from-playlist) deliberately do NOT
-- import 100 albums into the catalog — that would be 100 Spotify
-- round trips for a list the person may never publish. So imported
-- items land with release_id null, which also made them DEAD: the
-- list page has nothing to link to, and Luca hit exactly that —
-- "imported list from spotify playlist, but can't click on any of
-- the songs to view the release".
--
-- The import already KNOWS each track's album id; it was just
-- thrown away. Keeping it lets the release be resolved lazily on
-- the first click (/releases/spotify/<id>), which is the same
-- import-on-demand rule the whole catalog runs on.
--
-- Nullable and additive: every existing row stays valid, and items
-- added the normal way (through CatalogSearch, which already has a
-- real release_id) simply leave it null.
-- ============================================================

alter table public.list_items
  add column if not exists spotify_album_id text
    check (spotify_album_id is null
           or spotify_album_id ~ '^[A-Za-z0-9]{10,30}$');

-- The resolver looks releases up by spotify_id; make sure that path
-- is indexed (no-op if an earlier migration already added it).
create index if not exists releases_spotify_id_idx
  on public.releases (spotify_id);
