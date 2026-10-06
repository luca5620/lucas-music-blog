-- ============================================================
-- Migration 053 — AUX WARS: a transactional engine, rooms that can't
-- get stuck, fair host calls, one "this week" (2026-10-05).
-- Run in the Supabase SQL Editor. Run it, THEN deploy the code that
-- ships with it (see "ORDER" at the bottom).
--
-- Five findings from the code review, fixed together because they
-- all live in the same few functions:
--
--  1. "CALL IT" COULD HIT THE WRONG GAME. The engine acted on whatever
--     game was current, and the screen only sent a side. A stale tab
--     or the host's second device could "call" the NEXT game while it
--     was still in picking — which the engine read as a FORFEIT and
--     handed the match to side A. Now the screen sends the game id
--     AND the phase it was looking at, and aux_call_game refuses
--     (STALE_GAME / STALE_PHASE → the API answers 409) unless both
--     still match. The whole call — close the game, open the next,
--     finish the match, draw the next round, crown the champion — is
--     ONE plpgsql function holding a `for update` lock on the room,
--     so it is all-or-nothing and two taps can't interleave.
--
--  2. THE VOTE "SWITCH" POLICY was never tightened in 045. A crafted
--     PATCH could move an existing vote onto your own match, or let a
--     banned user keep voting. Insert and update now share ONE check
--     (aux_can_vote) — same rules as before, applied to both:
--     you, a room you can see, not banned, the game that is live
--     right now and in its listening phase, and not your own match.
--     (Players still vote on every OTHER match — Luca's standing rule
--     from 2026-09-14, unchanged.)
--
--  3. LEADERBOARD FARMING VIA FORFEIT. aux_self_judged only covered
--     host-JUDGED rooms. In a crowd room where the host plays, the
--     forfeit button, "nobody voted — you pick" and the OT tie-break
--     all let the host pick THEMSELVES, and those wins counted.
--     The rule we picked: the host can still make the call (a room
--     must never get stuck because the host happens to be playing),
--     but a match where the host handed a game to THEMSELVES is
--     marked `self_decided`, and the host's win of that match — and
--     a championship that ran through it — counts nowhere: not on
--     the chip, not on the leaderboard, not on Your Friends This
--     Week. The opponent's wins are untouched. Same spirit as 044.
--     Also closed: the host's direct-write policies on matches and
--     games are gone, and a guard trigger stops a client from writing
--     status / champion / current game on aux_rooms by hand (that was
--     a one-request way to crown yourself). Every one of those writes
--     now goes through the functions below.
--
--  4. ROOMS GOT STUCK FOREVER. Every engine step was a separate write
--     that ignored errors and marked the game done FIRST, so a failed
--     later step left every retry throwing "already called". Fixed by
--     (1). And nothing ever timed out: a room the host walked away
--     from sat "live" on the arena forever. Now:
--       · aux_rooms.last_activity_at — bumped by anything that
--         happens in the room (a pick, a vote, a reaction, a chat
--         message, someone joining, the host's moves), at most once a
--         minute so it doesn't spam realtime.
--       · A room quiet for TWO HOURS is hidden from the arena shelves
--         and auto-finished (no champion, end_reason = 'idle') —
--         lazily, by aux_close_idle_rooms(), which the arena page and
--         the room page call on read. No cron needed. Two hours is
--         long enough that no real room trips it (a single song is
--         three minutes, and the chat alone keeps a room awake) and
--         short enough that a dead room is gone by the same evening.
--       · Ending a room (host or idle) also closes the game that was
--         open, so nobody can keep voting on a room that's over.
--       · The host can always resolve a stalled game: forfeit while
--         picking, "you pick" when nobody voted, break a second tie.
--         The idle close is the fallback when the host is the one
--         who disappeared.
--
--  5. "THIS WEEK" MEANT TWO THINGS. aux_leaderboard('week') was a
--     rolling 7 days; /social's boards reset Friday 00:00 US Eastern.
--     aux_leaderboard now takes `p_since` (like social_week_leaders,
--     049) and the arena passes the same Friday. Called without it,
--     'week' still falls back to the rolling 7 days, so nothing
--     breaks for a caller that hasn't been updated.
--
-- WHO OWNS WHAT, after this migration:
--   aux_rooms   — the client may INSERT a lobby and edit lobby
--                 settings / the name. Status, champion, current game,
--                 timestamps and counters: functions only.
--   aux_matches — functions only (plus 046's staff topic policy).
--   aux_games   — functions only.
-- ============================================================


-- ---------- 0. new columns ----------

-- When anything last happened in the room (see 4 above).
alter table public.aux_rooms
  add column if not exists last_activity_at timestamptz;

-- Backfill from the best evidence each room already has: the latest
-- of its own timestamps, its newest chat message, its newest game and
-- its newest member. greatest() skips nulls.
update public.aux_rooms r
   set last_activity_at = greatest(
         r.created_at,
         r.started_at,
         r.finished_at,
         (select max(m.created_at) from public.aux_messages m where m.room_id = r.id),
         (select max(coalesce(g.closed_at, g.created_at)) from public.aux_games g where g.room_id = r.id),
         (select max(am.joined_at) from public.aux_members am where am.room_id = r.id)
       )
 where r.last_activity_at is null;

alter table public.aux_rooms alter column last_activity_at set default now();
alter table public.aux_rooms alter column last_activity_at set not null;

-- Why a room ended without a champion: the host pulled the plug, or
-- it went quiet and the idle close shut it. Null = it had a champion
-- (or it ended before this column existed).
alter table public.aux_rooms
  add column if not exists end_reason text;
alter table public.aux_rooms
  drop constraint if exists aux_rooms_end_reason_check;
alter table public.aux_rooms
  add constraint aux_rooms_end_reason_check
  check (end_reason is null or end_reason in ('host', 'idle'));

-- The open rooms, by how long they've been quiet — the idle close's
-- one query, and the arena shelves' filter.
create index if not exists idx_aux_rooms_open_activity
  on public.aux_rooms (last_activity_at)
  where status in ('lobby', 'live');

-- A match where the HOST handed a game to THEMSELVES (see 3 above).
alter table public.aux_matches
  add column if not exists self_decided boolean not null default false;

-- Backfill: every match the host played in where a game was decided
-- by the host in the host's own favour. (In a host-JUDGED room that's
-- every one of their wins — already voided by aux_self_judged, so
-- marking them too changes nothing there.)
update public.aux_matches m
   set self_decided = true
  from public.aux_rooms r
 where r.id = m.room_id
   and not m.self_decided
   and (m.player_a_id = r.host_id or m.player_b_id = r.host_id)
   and exists (
     select 1 from public.aux_games g
      where g.match_id = m.id
        and g.decided_by = 'host'
        and g.winner_side = case when m.player_a_id = r.host_id then 'a' else 'b' end
   );


-- ---------- 1. the idle window ----------

-- One place for "how long is too quiet". lib/aux-wars/limits.ts has
-- the same number (AUX_IDLE_MS) for the arena shelf filter — change
-- both together.
create or replace function public.aux_idle_window()
returns interval
language sql
immutable
as $fn$
  select interval '2 hours';
$fn$;

grant execute on function public.aux_idle_window() to anon, authenticated;


-- ---------- 2. the guard on aux_rooms ----------

-- A client (PostgREST runs every request as `anon` or `authenticated`)
-- may open a LOBBY and edit its settings. Everything that decides an
-- outcome — status, champion, the current game — is written only by
-- the SECURITY DEFINER functions below, which run as the function
-- OWNER, so `current_user` tells the two apart. This trigger is
-- deliberately NOT security definer: it has to see who's really
-- calling.
create or replace function public.aux_rooms_guard()
returns trigger
language plpgsql
set search_path = public
as $fn$
begin
  if current_user not in ('anon', 'authenticated') then
    return new; -- our own functions and the SQL editor
  end if;

  if tg_op = 'INSERT' then
    -- Whatever the request said, a new room is an empty lobby.
    new.status           := 'lobby';
    new.champion_id      := null;
    new.current_game_id  := null;
    new.started_at       := null;
    new.finished_at      := null;
    new.end_reason       := null;
    new.player_count     := 0;
    new.message_count    := 0;
    new.created_at       := now();
    new.last_activity_at := now();
    return new;
  end if;

  -- UPDATE: the engine's columns are off limits…
  if new.id <> old.id
     or new.host_id <> old.host_id
     or new.slug <> old.slug
     or new.status is distinct from old.status
     or new.champion_id is distinct from old.champion_id
     or new.current_game_id is distinct from old.current_game_id
     or new.started_at is distinct from old.started_at
     or new.finished_at is distinct from old.finished_at
     or new.end_reason is distinct from old.end_reason
     or new.player_count <> old.player_count
     or new.message_count <> old.message_count
     or new.last_activity_at is distinct from old.last_activity_at
     or new.created_at <> old.created_at then
    raise exception 'AUX_ENGINE_ONLY';
  end if;

  -- …and the rules lock once the war starts. (Flipping a room to
  -- "crowd judges" AFTER judging it yourself used to slip a
  -- self-judged win past aux_self_judged.) The NAME stays editable.
  if old.status <> 'lobby'
     and (new.format, new.judge, new.host_plays, new.topic_each_game, new.is_private, new.is_hidden)
         is distinct from
         (old.format, old.judge, old.host_plays, old.topic_each_game, old.is_private, old.is_hidden) then
    raise exception 'SETTINGS_LOCKED';
  end if;

  return new;
end;
$fn$;

drop trigger if exists trg_aux_rooms_guard on public.aux_rooms;
create trigger trg_aux_rooms_guard
  before insert or update on public.aux_rooms
  for each row execute function public.aux_rooms_guard();

-- Matches and games: no more direct host writes. The engine functions
-- are the only door. (046's "staff clears a topic" policy stays.)
drop policy if exists "Aux matches: host writes" on public.aux_matches;
drop policy if exists "Aux games: host writes" on public.aux_games;


-- ---------- 3. activity: keep last_activity_at fresh ----------

-- Called from triggers on everything people do in a room. Two
-- details that matter:
--   · At most once a minute per room — aux_rooms is on realtime, and
--     every UPDATE to it goes out to every screen in the room.
--   · SKIP LOCKED: if the host's call is mid-flight it holds the room
--     row, and this must never WAIT for it (a vote waiting on the room
--     while the call waits on the vote's game = deadlock). Skipping
--     is harmless: the call bumps the room itself.
create or replace function public.aux_touch_room()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_room uuid;
  v_hit  uuid;
begin
  v_room := case when tg_op = 'DELETE' then old.room_id else new.room_id end;
  select id into v_hit
    from public.aux_rooms
   where id = v_room
     and status <> 'finished'
     and last_activity_at < now() - interval '1 minute'
     for update skip locked;
  if v_hit is not null then
    update public.aux_rooms set last_activity_at = now() where id = v_hit;
  end if;
  return null;
end;
$fn$;

revoke all on function public.aux_touch_room() from public, anon, authenticated;

drop trigger if exists trg_aux_touch_messages on public.aux_messages;
create trigger trg_aux_touch_messages
  after insert on public.aux_messages
  for each row execute function public.aux_touch_room();

drop trigger if exists trg_aux_touch_votes on public.aux_votes;
create trigger trg_aux_touch_votes
  after insert or update on public.aux_votes
  for each row execute function public.aux_touch_room();

drop trigger if exists trg_aux_touch_reactions on public.aux_reactions;
create trigger trg_aux_touch_reactions
  after insert or update on public.aux_reactions
  for each row execute function public.aux_touch_room();

drop trigger if exists trg_aux_touch_members on public.aux_members;
create trigger trg_aux_touch_members
  after insert or update on public.aux_members
  for each row execute function public.aux_touch_room();

-- A player putting a song on (aux_pick_song writes song_a / song_b).
-- Not every games update — the vote and reaction tallies land on the
-- game row too, and those already bump through their own tables.
drop trigger if exists trg_aux_touch_picks on public.aux_games;
create trigger trg_aux_touch_picks
  after update on public.aux_games
  for each row
  when (old.song_a is distinct from new.song_a or old.song_b is distinct from new.song_b)
  execute function public.aux_touch_room();


-- ---------- 4. the engine's inner steps (NOT callable by clients) ----------

-- Put a pending match on air with its first game, and point the room
-- at that game.
create or replace function public.aux_go_live(p_match_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_room uuid;
  v_game uuid;
begin
  update public.aux_matches set status = 'live'
   where id = p_match_id
   returning room_id into v_room;
  insert into public.aux_games (match_id, room_id, game_no, is_ot)
    values (p_match_id, v_room, 1, false)
    returning id into v_game;
  update public.aux_rooms
     set current_game_id = v_game, last_activity_at = now()
   where id = v_room;
  return v_game;
end;
$fn$;

-- Draw one round: shuffle the players, pair them off, and the odd one
-- out (if any) gets a BYE — already done, with themselves as winner.
-- Returns the first REAL match (null if there's none).
create or replace function public.aux_create_round(
  p_room_id uuid, p_round integer, p_players uuid[]
)
returns uuid
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_order uuid[];
  v_n     integer;
  v_i     integer := 1;
  v_pos   integer := 0;
  v_id    uuid;
  v_first uuid;
begin
  select array_agg(x order by random()) into v_order from unnest(p_players) as x;
  v_n := coalesce(array_length(v_order, 1), 0);

  while v_i + 1 <= v_n loop
    insert into public.aux_matches (room_id, round, position, player_a_id, player_b_id)
      values (p_room_id, p_round, v_pos, v_order[v_i], v_order[v_i + 1])
      returning id into v_id;
    if v_first is null then
      v_first := v_id;
    end if;
    v_pos := v_pos + 1;
    v_i := v_i + 2;
  end loop;

  if v_n % 2 = 1 then
    insert into public.aux_matches
      (room_id, round, position, player_a_id, player_b_id, is_bye, winner_id, status)
      values (p_room_id, p_round, v_pos, v_order[v_n], null, true, v_order[v_n], 'done');
  end if;

  return v_first;
end;
$fn$;

-- After a match closes: the next pending match in the round, else the
-- next round, else the CHAMPION. Returns what the screen needs to know.
create or replace function public.aux_advance(p_room_id uuid)
returns jsonb
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_last    integer;
  v_pending uuid;
  v_winners uuid[];
  v_champ   uuid;
  v_first   uuid;
begin
  select max(round) into v_last from public.aux_matches where room_id = p_room_id;

  select id into v_pending
    from public.aux_matches
   where room_id = p_room_id and round = v_last and status = 'pending'
   order by position
   limit 1;
  if v_pending is not null then
    perform public.aux_go_live(v_pending);
    return '{}'::jsonb;
  end if;

  if exists (select 1 from public.aux_matches
              where room_id = p_room_id and round = v_last and status = 'live') then
    return '{}'::jsonb;
  end if;

  select array_agg(winner_id order by position) into v_winners
    from public.aux_matches
   where room_id = p_room_id and round = v_last and winner_id is not null;

  if coalesce(array_length(v_winners, 1), 0) <= 1 then
    v_champ := v_winners[1]; -- null when the array is empty
    update public.aux_rooms
       set status = 'finished',
           champion_id = v_champ,
           current_game_id = null,
           finished_at = now(),
           last_activity_at = now()
     where id = p_room_id;
    return jsonb_build_object('champion', v_champ, 'finished', true);
  end if;

  v_first := public.aux_create_round(p_room_id, v_last + 1, v_winners);
  if v_first is null then
    -- Only possible with one winner, handled above — but never hang.
    raise exception 'NO_MATCH';
  end if;
  perform public.aux_go_live(v_first);
  return '{}'::jsonb;
end;
$fn$;

-- Close a room with NO champion — the host ending it, or the idle
-- close. Shuts the open game (so the vote closes with it) and puts an
-- unfinished match back to pending, so the bracket doesn't keep
-- showing ON AIR on a room that's over.
create or replace function public.aux_shut_room(p_room_id uuid, p_reason text)
returns void
language plpgsql
security definer set search_path = public
as $fn$
begin
  update public.aux_games
     set phase = 'done', closed_at = coalesce(closed_at, now())
   where room_id = p_room_id and phase <> 'done';
  update public.aux_matches
     set status = 'pending'
   where room_id = p_room_id and status = 'live';
  update public.aux_rooms
     set status = 'finished',
         current_game_id = null,
         finished_at = now(),
         end_reason = p_reason,
         -- An idle room keeps the real time it went quiet.
         last_activity_at = case when p_reason = 'idle' then last_activity_at else now() end
   where id = p_room_id and status <> 'finished';
end;
$fn$;

-- None of the four above is a door: they trust their caller to have
-- checked the host and taken the lock. Only the owner (and so only
-- the functions below) can run them.
revoke all on function public.aux_go_live(uuid) from public, anon, authenticated;
revoke all on function public.aux_create_round(uuid, integer, uuid[]) from public, anon, authenticated;
revoke all on function public.aux_advance(uuid) from public, anon, authenticated;
revoke all on function public.aux_shut_room(uuid, text) from public, anon, authenticated;


-- ---------- 5. the doors: start, call, topic, end, idle close ----------

-- START: the host draws round 1 and puts the first match on air.
create or replace function public.aux_start_room(p_room_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_room    public.aux_rooms%rowtype;
  v_players uuid[];
  v_first   uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select * into v_room from public.aux_rooms where id = p_room_id for update;
  if v_room.id is null then
    raise exception 'NO_ROOM';
  end if;
  if v_room.host_id <> auth.uid() then
    raise exception 'NOT_HOST';
  end if;
  if v_room.status <> 'lobby' then
    raise exception 'ALREADY_STARTED';
  end if;

  -- A playing host is always in, even if they never tapped "join".
  -- (The player-cap trigger still applies: ROOM_FULL if there's no
  -- seat left for them.)
  if v_room.host_plays then
    insert into public.aux_members (room_id, user_id, role)
      values (p_room_id, v_room.host_id, 'player')
      on conflict (room_id, user_id) do update set role = 'player';
  end if;

  select array_agg(user_id) into v_players
    from public.aux_members
   where room_id = p_room_id
     and role = 'player'
     and (v_room.host_plays or user_id <> v_room.host_id);

  if coalesce(array_length(v_players, 1), 0) < 2 then
    raise exception 'NEED_PLAYERS';
  end if;

  update public.aux_rooms
     set status = 'live', started_at = now(), last_activity_at = now()
   where id = p_room_id;

  v_first := public.aux_create_round(p_room_id, 1, v_players);
  if v_first is null then
    raise exception 'NO_MATCH';
  end if;
  perform public.aux_go_live(v_first);
end;
$fn$;

revoke all on function public.aux_start_room(uuid) from public, anon;
grant execute on function public.aux_start_room(uuid) to authenticated;

-- CALL: the host closes the game everyone just listened to (or, while
-- still picking, forfeits the match to one side).
--
--   p_game_id — the game the host's SCREEN was showing
--   p_phase   — the phase it was showing ('picking' | 'listening')
--   p_side    — 'a' | 'b' | null (see below)
--
-- Both have to match what's really live, or STALE_GAME / STALE_PHASE.
-- That's the whole fix for "call it hits the wrong game": a forfeit
-- tapped on a picking screen can never land on a listening game, and
-- a tap meant for game 2 can never close game 3.
--
-- Returns JSON for the host's screen: { needsHost: 'tie'|'no_votes' }
-- (crowd room, the host has to pick), { overtime: true }, or
-- { winnerSide, matchWon, champion?, finished? }.
create or replace function public.aux_call_game(
  p_room_id uuid,
  p_game_id uuid,
  p_phase   text,
  p_side    text default null
)
returns jsonb
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_room      public.aux_rooms%rowtype;
  v_game      public.aux_games%rowtype;
  v_match     public.aux_matches%rowtype;
  v_host_side text;
  v_winner    text;
  v_decided   text := 'crowd';
  v_self      boolean := false;
  v_wins_a    integer;
  v_wins_b    integer;
  v_needed    integer;
  v_winner_id uuid;
  v_next      uuid;
  v_after     jsonb;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_side is not null and p_side not in ('a', 'b') then
    raise exception 'BAD_SIDE';
  end if;
  if p_phase is null or p_phase not in ('picking', 'listening') then
    raise exception 'BAD_PHASE';
  end if;
  if p_game_id is null then
    raise exception 'STALE_GAME'; -- a call has to say WHICH game
  end if;

  -- THE LOCK. Everything below happens with the room row held, so a
  -- second tap (or a second device) waits, then sees the new state
  -- and fails the staleness check instead of acting twice.
  select * into v_room from public.aux_rooms where id = p_room_id for update;
  if v_room.id is null then
    raise exception 'NO_ROOM';
  end if;
  if v_room.host_id <> auth.uid() then
    raise exception 'NOT_HOST';
  end if;
  if v_room.status <> 'live' or v_room.current_game_id is null then
    raise exception 'NOT_LIVE';
  end if;
  if v_room.current_game_id <> p_game_id then
    raise exception 'STALE_GAME';
  end if;

  select * into v_game from public.aux_games where id = p_game_id for update;
  if v_game.id is null then
    raise exception 'NO_GAME';
  end if;
  if v_game.phase <> p_phase then
    raise exception 'STALE_PHASE';
  end if;
  select * into v_match from public.aux_matches where id = v_game.match_id for update;
  if v_match.id is null then
    raise exception 'NO_MATCH';
  end if;

  -- Is the host one of the two players in THIS match? (See 3 above.)
  v_host_side := case
    when v_match.player_a_id = v_room.host_id then 'a'
    when v_match.player_b_id = v_room.host_id then 'b'
    else null
  end;

  /* FORFEIT: still picking — the host hands the whole match to one
     side (a player walked off and never put a song on). */
  if v_game.phase = 'picking' then
    if p_side is null then
      raise exception 'NEED_SIDE';
    end if;
    update public.aux_games
       set phase = 'done', winner_side = p_side, decided_by = 'host', closed_at = now()
     where id = v_game.id;
    v_winner_id := case when p_side = 'a' then v_match.player_a_id else v_match.player_b_id end;
    update public.aux_matches
       set winner_id = v_winner_id,
           status = 'done',
           self_decided = self_decided or (v_host_side is not null and v_host_side = p_side)
     where id = v_match.id;
    v_after := public.aux_advance(v_room.id);
    update public.aux_rooms set last_activity_at = now() where id = v_room.id;
    return jsonb_build_object('winnerSide', p_side, 'matchWon', true) || v_after;
  end if;

  /* LISTENING: who won this game? */
  if v_room.judge = 'host' then
    if p_side is null then
      raise exception 'NEED_SIDE';
    end if;
    v_winner := p_side;
    v_decided := 'host';
  elsif v_game.votes_a <> v_game.votes_b then
    -- The host can't overrule a clear crowd — that's the whole point.
    v_winner := case when v_game.votes_a > v_game.votes_b then 'a' else 'b' end;
  elsif v_game.votes_a + v_game.votes_b = 0 then
    if p_side is null then
      return jsonb_build_object('needsHost', 'no_votes');
    end if;
    v_winner := p_side;
    v_decided := 'host';
  elsif not v_game.is_ot then
    -- A tie → OVERTIME: new songs, vote again.
    update public.aux_games set phase = 'done', closed_at = now() where id = v_game.id;
    insert into public.aux_games (match_id, room_id, game_no, is_ot)
      values (v_match.id, v_room.id, v_game.game_no + 1, true)
      returning id into v_next;
    update public.aux_rooms
       set current_game_id = v_next, last_activity_at = now()
     where id = v_room.id;
    return jsonb_build_object('overtime', true);
  else
    if p_side is null then
      return jsonb_build_object('needsHost', 'tie');
    end if;
    v_winner := p_side;
    v_decided := 'host';
  end if;

  -- The host gave a game to themselves.
  v_self := v_decided = 'host' and v_host_side is not null and v_host_side = v_winner;

  update public.aux_games
     set phase = 'done', winner_side = v_winner, decided_by = v_decided, closed_at = now()
   where id = v_game.id;

  v_wins_a := v_match.wins_a + case when v_winner = 'a' then 1 else 0 end;
  v_wins_b := v_match.wins_b + case when v_winner = 'b' then 1 else 0 end;
  v_needed := case when v_room.format = 'bo3' then 2 else 1 end;

  if v_wins_a < v_needed and v_wins_b < v_needed then
    -- Same match, next game. OT games count in game_no so it stays unique.
    update public.aux_matches
       set wins_a = v_wins_a, wins_b = v_wins_b, self_decided = self_decided or v_self
     where id = v_match.id;
    insert into public.aux_games (match_id, room_id, game_no, is_ot)
      values (v_match.id, v_room.id, v_game.game_no + 1, false)
      returning id into v_next;
    update public.aux_rooms
       set current_game_id = v_next, last_activity_at = now()
     where id = v_room.id;
    return jsonb_build_object('winnerSide', v_winner, 'matchWon', false);
  end if;

  v_winner_id := case when v_winner = 'a' then v_match.player_a_id else v_match.player_b_id end;
  update public.aux_matches
     set wins_a = v_wins_a,
         wins_b = v_wins_b,
         winner_id = v_winner_id,
         status = 'done',
         self_decided = self_decided or v_self
   where id = v_match.id;

  v_after := public.aux_advance(v_room.id);
  update public.aux_rooms set last_activity_at = now() where id = v_room.id;
  return jsonb_build_object('winnerSide', v_winner, 'matchWon', true) || v_after;
end;
$fn$;

revoke all on function public.aux_call_game(uuid, uuid, text, text) from public, anon;
grant execute on function public.aux_call_game(uuid, uuid, text, text) to authenticated;

-- TOPIC: the host names the current round's topic (or, in a
-- topic_each_game room, this game's). Same rules as the old route:
-- only while the game is picking and no song is on yet. The content
-- filter stays in the API route, which runs before this.
create or replace function public.aux_set_topic(
  p_room_id uuid,
  p_game_id uuid,
  p_topic   text
)
returns jsonb
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_room  public.aux_rooms%rowtype;
  v_game  public.aux_games%rowtype;
  v_match public.aux_matches%rowtype;
  v_clean text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  v_clean := btrim(coalesce(p_topic, ''));
  if char_length(v_clean) < 3 or char_length(v_clean) > 120 then
    raise exception 'BAD_TOPIC';
  end if;

  select * into v_room from public.aux_rooms where id = p_room_id for update;
  if v_room.id is null then
    raise exception 'NO_ROOM';
  end if;
  if v_room.host_id <> auth.uid() then
    raise exception 'NOT_HOST';
  end if;
  if v_room.status <> 'live' or v_room.current_game_id is null then
    raise exception 'NOT_LIVE';
  end if;
  if p_game_id is not null and p_game_id <> v_room.current_game_id then
    raise exception 'STALE_GAME';
  end if;

  select * into v_game from public.aux_games where id = v_room.current_game_id for update;
  if v_game.id is null then
    raise exception 'NO_GAME';
  end if;
  if v_game.phase <> 'picking' or v_game.song_a is not null or v_game.song_b is not null then
    raise exception 'SONGS_ON';
  end if;
  select * into v_match from public.aux_matches where id = v_game.match_id;

  if v_room.topic_each_game then
    update public.aux_games set topic = v_clean where id = v_game.id;
  else
    update public.aux_matches set topic = v_clean
     where room_id = v_room.id and round = v_match.round;
  end if;
  update public.aux_rooms set last_activity_at = now() where id = v_room.id;

  return jsonb_build_object(
    'topic', v_clean,
    'round', v_match.round,
    'perGame', v_room.topic_each_game
  );
end;
$fn$;

revoke all on function public.aux_set_topic(uuid, uuid, text) from public, anon;
grant execute on function public.aux_set_topic(uuid, uuid, text) to authenticated;

-- END: the host pulls the plug. No champion; the chat stays readable.
create or replace function public.aux_end_room(p_room_id uuid)
returns void
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_room public.aux_rooms%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select * into v_room from public.aux_rooms where id = p_room_id for update;
  if v_room.id is null then
    raise exception 'NO_ROOM';
  end if;
  if v_room.host_id <> auth.uid() then
    raise exception 'NOT_HOST';
  end if;
  if v_room.status = 'finished' then
    return;
  end if;
  perform public.aux_shut_room(p_room_id, 'host');
end;
$fn$;

revoke all on function public.aux_end_room(uuid) from public, anon;
grant execute on function public.aux_end_room(uuid) to authenticated;

-- IDLE CLOSE: finish every open room that's been quiet longer than
-- aux_idle_window(). Anyone may trigger it (the arena page calls it
-- on read, signed in or not) because it only ever does what the clock
-- already says. SKIP LOCKED: a room someone is acting on right now
-- isn't idle anyway. Capped per call so one page load stays cheap.
create or replace function public.aux_close_idle_rooms()
returns integer
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_id uuid;
  v_n  integer := 0;
begin
  for v_id in
    select id from public.aux_rooms
     where status in ('lobby', 'live')
       and last_activity_at < now() - public.aux_idle_window()
     order by last_activity_at
     limit 50
     for update skip locked
  loop
    perform public.aux_shut_room(v_id, 'idle');
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$fn$;

revoke all on function public.aux_close_idle_rooms() from public;
grant execute on function public.aux_close_idle_rooms() to anon, authenticated;


-- ---------- 6. votes: one rule for casting AND switching ----------

-- Everything a vote has to satisfy, in one place, so the insert and
-- the update policies can never drift apart again (2 above).
create or replace function public.aux_can_vote(p_room_id uuid, p_game_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $fn$
  select auth.uid() is not null
     and public.aux_can_view(p_room_id)
     and not public.aux_is_banned(p_room_id)
     and exists (
       select 1
         from public.aux_games g
         join public.aux_matches m on m.id = g.match_id
         join public.aux_rooms r on r.id = g.room_id
        where g.id = p_game_id
          and g.room_id = p_room_id           -- the row's room IS the game's room
          and g.phase = 'listening'
          and r.status = 'live'
          and r.current_game_id = g.id        -- the game that's on right now
          -- Luca's rule: never on your OWN match, free everywhere else.
          and m.player_a_id <> auth.uid()
          and m.player_b_id is distinct from auth.uid()
     );
$fn$;

revoke all on function public.aux_can_vote(uuid, uuid) from public;
grant execute on function public.aux_can_vote(uuid, uuid) to anon, authenticated;

drop policy if exists "Aux votes: cast your own" on public.aux_votes;
create policy "Aux votes: cast your own"
  on public.aux_votes for insert
  with check (
    user_id = auth.uid()
    and public.aux_can_vote(room_id, game_id)
  );

drop policy if exists "Aux votes: switch your own" on public.aux_votes;
create policy "Aux votes: switch your own"
  on public.aux_votes for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and public.aux_can_vote(room_id, game_id)
  );


-- ---------- 7. wins: the host can't hand themselves one ----------

-- True when this winner is the HOST and they got through this room by
-- calling at least one of their own matches for themselves. Used for
-- championships; a single match win checks `self_decided` directly.
-- Not a door (no grant): only the counting functions below call it.
create or replace function public.aux_host_helped_self(
  p_room_id uuid, p_host_id uuid, p_winner_id uuid
)
returns boolean
language sql
stable
set search_path = public
as $fn$
  select p_winner_id = p_host_id
     and exists (
       select 1 from public.aux_matches m
        where m.room_id = p_room_id
          and m.self_decided
          and m.winner_id = p_host_id
     );
$fn$;

revoke all on function public.aux_host_helped_self(uuid, uuid, uuid) from public, anon, authenticated;

-- The WINS stat on every chip and profile — 044's function plus the
-- self-decided rule.
create or replace function public.aux_wins_for(p_user_ids uuid[])
returns table (user_id uuid, battles integer, rounds integer)
language sql
stable
security definer set search_path = public
as $fn$
  select u.id as user_id,
         (select count(*)::int from public.aux_rooms r
           where r.champion_id = u.id
             and r.status = 'finished'
             and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, u.id)
             and not public.aux_host_helped_self(r.id, r.host_id, u.id)) as battles,
         (select count(*)::int from public.aux_matches m
            join public.aux_rooms r on r.id = m.room_id
           where m.winner_id = u.id
             and m.status = 'done'
             and not m.is_bye
             and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, u.id)
             and not (m.self_decided and u.id = r.host_id)) as rounds
    from unnest(p_user_ids) as u(id);
$fn$;

revoke all on function public.aux_wins_for(uuid[]) from public;
grant execute on function public.aux_wins_for(uuid[]) to anon, authenticated;

-- The leaderboard — 047's function plus the self-decided rule and the
-- caller-supplied week boundary (5 above). The old two-argument
-- version is dropped first so PostgREST has exactly one to pick.
drop function if exists public.aux_leaderboard(text, integer);

create or replace function public.aux_leaderboard(
  p_period text default 'all',
  p_limit  integer default 10,
  p_since  timestamptz default null
)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  role         text,
  battles      integer,
  rounds       integer
)
language sql
stable
security definer set search_path = public
as $fn$
  with bounds as (
    select case
             when p_period = 'week' then coalesce(p_since, now() - interval '7 days')
             else '-infinity'::timestamptz
           end as since
  ),
  champs as (
    select r.champion_id as uid, count(*)::int as battles
      from public.aux_rooms r
     cross join bounds b
     where r.status = 'finished'
       and r.champion_id is not null
       and coalesce(r.finished_at, r.created_at) >= b.since
       and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, r.champion_id)
       and not public.aux_host_helped_self(r.id, r.host_id, r.champion_id)
     group by r.champion_id
  ),
  won_rounds as (
    select m.winner_id as uid, count(*)::int as rounds
      from public.aux_matches m
      join public.aux_rooms r on r.id = m.room_id
     cross join bounds b
     where m.status = 'done'
       and not m.is_bye
       and m.winner_id is not null
       and coalesce(m.created_at, r.created_at) >= b.since
       and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, m.winner_id)
       and not (m.self_decided and m.winner_id = r.host_id)
     group by m.winner_id
  ),
  totals as (
    select coalesce(c.uid, w.uid) as uid,
           coalesce(c.battles, 0) as battles,
           coalesce(w.rounds, 0)  as rounds
      from champs c
      full outer join won_rounds w on w.uid = c.uid
  )
  select p.id, p.username, p.display_name, p.avatar_url, p.role,
         t.battles, t.rounds
    from totals t
    join public.profiles p on p.id = t.uid
   where t.battles > 0 or t.rounds > 0
   order by t.battles desc, t.rounds desc, p.username asc
   limit greatest(1, least(coalesce(p_limit, 10), 50));
$fn$;

revoke all on function public.aux_leaderboard(text, integer, timestamptz) from public;
grant execute on function public.aux_leaderboard(text, integer, timestamptz) to anon, authenticated;

-- Your Friends This Week (049) counts Aux War wins too, so it gets the
-- same rule. Copied from 049 verbatim except the one marked line.
create or replace function public.social_week_leaders(
  p_since timestamptz,
  p_limit integer default 3
)
returns table (
  metric       text,
  rank         integer,
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  role         text,
  score        integer
)
language sql
stable
security definer set search_path = public
as $fn$
  with circle as (
    select auth.uid() as uid
    union
    select f.following_id
      from public.follows f
     where f.follower_id = auth.uid()
  ),
  aux_won as (
    select r.champion_id as uid, count(*)::int as score
      from public.aux_rooms r
     where r.status = 'finished'
       and r.champion_id is not null
       and r.champion_id in (select uid from circle)
       and coalesce(r.finished_at, r.created_at) >= p_since
       and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, r.champion_id)
       and not public.aux_host_helped_self(r.id, r.host_id, r.champion_id) -- (053)
     group by r.champion_id
  ),
  reviewed as (
    select rv.user_id as uid, count(*)::int as score
      from public.reviews rv
     where rv.user_id in (select uid from circle)
       and rv.is_published
       and rv.created_at >= p_since
     group by rv.user_id
  ),
  liked as (
    select rv.user_id as uid, count(*)::int as score
      from public.review_likes rl
      join public.reviews rv on rv.id = rl.review_id
     where rv.user_id in (select uid from circle)
       and rl.created_at >= p_since
     group by rv.user_id
  ),
  unioned as (
    select 'aux'::text     as metric, uid, score from aux_won
    union all
    select 'reviews'::text as metric, uid, score from reviewed
    union all
    select 'likes'::text   as metric, uid, score from liked
  ),
  ranked as (
    select u.metric,
           u.uid,
           u.score,
           row_number() over (
             partition by u.metric
             order by u.score desc, u.uid
           ) as rnk
      from unioned u
     where u.score > 0
  )
  select r.metric,
         r.rnk::int,
         p.id,
         p.username,
         p.display_name,
         p.avatar_url,
         p.role,
         r.score
    from ranked r
    join public.profiles p on p.id = r.uid
   where r.rnk <= greatest(1, least(coalesce(p_limit, 3), 10))
   order by r.metric, r.rnk;
$fn$;

revoke all on function public.social_week_leaders(timestamptz, integer) from public, anon;
grant execute on function public.social_week_leaders(timestamptz, integer) to authenticated;


-- ---------- 8. tidy up what's already stuck ----------

-- Rooms abandoned before today finish now instead of waiting for the
-- first page view.
select public.aux_close_idle_rooms();

notify pgrst, 'reload schema';

-- ============================================================
-- ORDER: run this, then deploy. From the moment it runs until the
-- new code is live, the OLD engine (direct writes from the route)
-- can't start, call or end a room — the guard and the dropped host
-- policies refuse it. Best run when no war is live, with the deploy
-- right behind it. Votes, chat, picks and reactions keep working
-- throughout.
--
-- VERIFY after running (all should return rows / true):
--   select last_activity_at, end_reason from aux_rooms limit 1;
--   select self_decided from aux_matches limit 1;
--   select proname from pg_proc where proname in
--     ('aux_call_game','aux_start_room','aux_end_room','aux_set_topic',
--      'aux_close_idle_rooms','aux_can_vote','aux_host_helped_self');
--   select pg_get_function_identity_arguments('public.aux_leaderboard'::regproc);
--     → p_period text, p_limit integer, p_since timestamp with time zone
-- ============================================================
