-- ============================================================
-- Migration 067 — released songs that came in through Genius get
-- their Spotify copy (2026-10-26). Run AFTER 066. Safe to re-run.
-- Nothing to paste in.
--
-- WHY (Luca 2026-10-26): a friend's review of KARINA's "UP" went
-- through the song's Genius result, so its page had no Spotify player
-- and no previews — Genius is only meant for leaks. From now on the
-- site checks Spotify before importing a Genius pick and takes the
-- Spotify copy when the same song is there (lib/catalog.ts
-- findSpotifyTwin). This file fixes the 5 already in the catalog —
-- found by the same matcher on 2026-10-26:
--   Mood — 24kGoldn  →  "Mood (feat. iann dior)" on Spotify
--   UP — KARINA  →  "UP - KARINA Solo" on Spotify
--   The Gates of Delirium — Yes  →  "The Gates of Delirium" on Spotify
--   Once — Pearl Jam  →  "Once" on Spotify
--   BOYS DON’T CRY — GONE.Fludd  →  "BOYS DON'T CRY" on Spotify
--
-- HOW: upgraded IN PLACE — same page address, same reviews, same
-- Genius id (picking the Genius result again lands here). It gains
-- the Spotify track id, cover and tracklist, so the player shows up.
-- None of these songs had a Spotify page of its own yet (checked).
-- ============================================================

with fix (slug, track_id, track_name, duration_ms, release_date, cover, sp_artist_id) as (
  values
    ('mood-24kgoldn', '4jPy3l0RUwlUI9T5XHBW2m', 'Mood (feat. iann dior)', 140525, '2021-03-26'::date, 'https://i.scdn.co/image/ab67616d0000b273b4141fad9af613c35f55d589', '6fWVd57NKTalqvmjRd2t8Z'),
    ('up-karina', '5sjnkOfTLCLNfkkchI2re2', 'UP - KARINA Solo', 166640, '2024-10-09'::date, 'https://i.scdn.co/image/ab67616d0000b273253096eda3b7826c11c7fab8', null),
    ('the-gates-of-delirium-yes', '4UpLnnndbsuj0ymhQwQsts', 'The Gates of Delirium', 1311973, null::date, 'https://i.scdn.co/image/ab67616d0000b2731d0a98db675f174fe4dbbe9a', '7AC976RDJzL2asmZuz7qil'),
    ('once-pearl-jam', '4nRyBgsqXEP2oPfzaMeZr7', 'Once', 231368, '1991-08-27'::date, 'https://i.scdn.co/image/ab67616d0000b2732d0e5ab5bd2e234fbcffa3e0', '1w5Kfo2jwwIPruYS2UWh56'),
    ('boys-dont-cry-gonefludd', '68s7W3oLQpF4tUBomslhNC', 'BOYS DON''T CRY', 147195, '2018-04-20'::date, 'https://i.scdn.co/image/ab67616d0000b2734e0672cfe2f3a1980bb4659b', '0ohUvVskERzK18bvWXFEqi')
),
upgraded as (
  update public.releases r
     set spotify_id   = f.track_id,
         source       = 'spotify',
         is_unreleased = false,
         cover_image  = coalesce(f.cover, r.cover_image),
         -- keep our date (Genius has the single's own date; Spotify's is
         -- the album the song sits on — Mood would read 2021, not 2020)
         release_date = coalesce(r.release_date, f.release_date),
         -- One track whose id IS the record's id → the compact track
         -- player (components/releases/SpotifyEmbed isTrackId).
         tracks = jsonb_build_array(jsonb_build_object(
           'position', 1,
           'title', r.title,
           'duration_ms', f.duration_ms,
           'spotify_id', f.track_id
         ))
    from fix f
   where r.slug = f.slug
     and r.spotify_id is null
     -- never two rows with one Spotify id
     and not exists (select 1 from public.releases o where o.spotify_id = f.track_id)
  returning r.primary_artist_id, f.sp_artist_id
)
-- The Genius artist learns its Spotify id when it's the same artist
-- (24kGoldn, GONE.Fludd) and no other artist row already has it.
update public.artists a
   set spotify_id = u.sp_artist_id
  from upgraded u
 where a.id = u.primary_artist_id
   and u.sp_artist_id is not null
   and a.spotify_id is null
   and not exists (select 1 from public.artists o where o.spotify_id = u.sp_artist_id);


-- Verify (5 rows, all source = spotify):
--   select slug, source, spotify_id from public.releases
--    where slug in ('mood-24kgoldn', 'up-karina', 'the-gates-of-delirium-yes', 'once-pearl-jam', 'boys-dont-cry-gonefludd');
