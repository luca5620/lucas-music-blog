-- ============================================================
-- Migration 043 — aux battles: a room NAME, a topic PER ROUND
-- (2026-09-13). Run in the Supabase SQL Editor after 042.
--
-- Luca: "Don't just choose a topic at the beginning, have it be a
-- name for the room first, and then for each round there should be
-- a new topic." So the room's `topic` column becomes `name` (what
-- the host calls the room), and every bracket round gets its own
-- topic, set by the host when the round opens — stored on each
-- match of that round (one round = one topic, the same value on all
-- of its matches, so the bracket view can read it off any card).
-- Nobody can put a song on until the round's topic is set.
-- ============================================================

alter table public.aux_rooms rename column topic to name;

alter table public.aux_matches
  add column if not exists topic text check (topic is null or char_length(topic) between 3 and 120);

-- aux_pick_song: the same function as in 042, plus the topic gate.
create or replace function public.aux_pick_song(p_game_id uuid, p_song jsonb)
returns void
language plpgsql
security definer set search_path = public
as $$
declare
  v_game public.aux_games%rowtype;
  v_match public.aux_matches%rowtype;
  v_side text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select * into v_game from public.aux_games where id = p_game_id for update;
  if v_game.id is null then
    raise exception 'NO_GAME';
  end if;
  if v_game.phase <> 'picking' then
    raise exception 'NOT_PICKING';
  end if;
  select * into v_match from public.aux_matches where id = v_game.match_id;
  -- The host names the round's topic first; picks wait for it.
  if v_match.topic is null then
    raise exception 'NO_TOPIC';
  end if;
  if v_match.player_a_id = auth.uid() then
    v_side := 'a';
  elsif v_match.player_b_id = auth.uid() then
    v_side := 'b';
  else
    raise exception 'NOT_A_PLAYER';
  end if;

  if jsonb_typeof(p_song) <> 'object'
     or not (p_song ? 'source') or not (p_song ? 'title') or not (p_song ? 'embed_id')
     or (p_song->>'source') not in ('spotify', 'soundcloud', 'youtube')
     or char_length(p_song->>'title') > 200
     or char_length(p_song->>'embed_id') > 300
     or char_length(p_song::text) > 4000 then
    raise exception 'BAD_SONG';
  end if;

  if v_side = 'a' then
    update public.aux_games set song_a = p_song where id = p_game_id;
  else
    update public.aux_games set song_b = p_song where id = p_game_id;
  end if;

  update public.aux_games
     set phase = 'listening'
   where id = p_game_id
     and song_a is not null
     and song_b is not null;
end;
$$;

revoke all on function public.aux_pick_song(uuid, jsonb) from public, anon;
grant execute on function public.aux_pick_song(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
