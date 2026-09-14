-- ============================================================
-- Migration 046 — AUX BATTLES: a topic per GAME inside a best-of-3,
-- and staff can take a room down (2026-09-14). Run after 045.
--
-- 1. Luca 2026-09-14: "for best of 3 its the same topic for all
--    rounds within that, maybe there should be an option to have the
--    best of 3 have different topics for each round within it."
--
--    So `aux_rooms.topic_each_game` — an opt-in, bo3 only, OFF by
--    default. One topic per match stays the default because it's the
--    fair version: both players answer the same brief three times.
--    Turned on, the host names a fresh topic before every game, which
--    makes a best-of-3 its own little tournament.
--
--    The topic gets a home on `aux_games` alongside the one on
--    `aux_matches`, and the GAME's wins when it's there — so the
--    bracket card keeps showing the match topic for ordinary rooms
--    and nothing changes for them.
--
-- 2. Compliance sweep (App Store 1.2, the guideline the 1.0 rejection
--    was about). Everything user-typed in an aux battle is already
--    filtered on the way in (room name, round topic, chat) and
--    reportable (aux_room, aux_message) — but staff could not DELETE
--    a reported room: aux_rooms only had a host delete policy, so the
--    "Delete content" button in /admin/reports had nothing to call.
--    A room's NAME and TOPICS are host-written text on a public page,
--    so that gap had to close.
-- ============================================================

-- ---------- 1. a topic per game ----------

alter table public.aux_rooms
  add column if not exists topic_each_game boolean not null default false;

alter table public.aux_games
  add column if not exists topic text
  check (topic is null or char_length(topic) between 3 and 120);

-- The topic that applies to a game: its own if it has one, otherwise
-- the round's. One place to ask, so the picker, the stage and
-- aux_pick_song can never disagree.
create or replace function public.aux_game_topic(p_game_id uuid)
returns text
language sql
stable
security definer set search_path = public
as $fn$
  select coalesce(g.topic, m.topic)
    from public.aux_games g
    join public.aux_matches m on m.id = g.match_id
   where g.id = p_game_id;
$fn$;

revoke all on function public.aux_game_topic(uuid) from public;
grant execute on function public.aux_game_topic(uuid) to anon, authenticated;

-- aux_pick_song: same function as 043, except the topic gate now asks
-- the game first and falls back to the round.
create or replace function public.aux_pick_song(p_game_id uuid, p_song jsonb)
returns void
language plpgsql
security definer set search_path = public
as $fn$
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
  -- The host names the topic first; picks wait for it. In a
  -- topic_each_game room that means THIS game's topic.
  if coalesce(v_game.topic, v_match.topic) is null then
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
$fn$;

revoke all on function public.aux_pick_song(uuid, jsonb) from public, anon;
grant execute on function public.aux_pick_song(uuid, jsonb) to authenticated;

-- ---------- 2. staff can take a reported room down ----------

-- Mirrors the admin delete policies from migration 007 on every other
-- user-made thing. Owners and admins only; the host's own policy is
-- untouched and still stands beside this one.
drop policy if exists "Aux rooms: staff delete" on public.aux_rooms;
create policy "Aux rooms: staff delete"
  on public.aux_rooms for delete
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  );

-- Same for the round topics, so a single bad topic can be pulled
-- without taking the whole room down with it.
drop policy if exists "Aux matches: staff clears a topic" on public.aux_matches;
create policy "Aux matches: staff clears a topic"
  on public.aux_matches for update
  using (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  );

notify pgrst, 'reload schema';
