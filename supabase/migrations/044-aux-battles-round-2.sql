-- ============================================================
-- Migration 044 — AUX BATTLES, round 2 (2026-09-14).
-- Run in the Supabase SQL Editor after 043.
--
-- Luca's list from the first real test (2026-09-14):
--   1. REACTIONS: "limit it to 1 reaction per person instead of
--      spamming it, and save the reactions until the next round."
--      -> one row per person per game (switchable, like a vote), and
--        the tallies live ON the game row so they survive a reload,
--        a late join and the whole listening period instead of only
--        existing in whichever browser happened to be watching.
--   2. LOBBY CAPS: "a maximum of 32 players for single round, so the
--      biggest the bracket can be will be a round of 32... for best
--      of 3 then the max players should be 10 so the first round will
--      be a max of 30 songs played." (10 players = 5 matches x up to
--      6 songs = 30.) Enforced in the DB, not just the API, so the
--      cap holds even against a hand-rolled request.
--   3. WINS: "for games where the host can play and be the judge,
--      their wins should not count as it would oversaturate people
--      farming wins in the stats." -> aux_wins_for skips a win the
--      winner handed themselves: host, playing, and judging. Luca's
--      test win disappears on its own — no row to delete.
--   4. LEADERBOARD: "top 10 players on aux battles, filter it for
--      all time wins and weekly wins."
-- ============================================================

-- ---------- 1. Reactions: one per person, counted on the game ----------

-- The fire/trash tallies move onto the game row (same shape as
-- votes_a / votes_b): one realtime UPDATE carries them to every
-- screen, and a phone that joins halfway through sees real numbers.
alter table public.aux_games
  add column if not exists fire_a integer not null default 0,
  add column if not exists poop_a integer not null default 0,
  add column if not exists fire_b integer not null default 0,
  add column if not exists poop_b integer not null default 0;

-- Spam from the old "many taps per person" rule: keep each person's
-- LAST reaction on each game, drop the rest, then make it a rule.
delete from public.aux_reactions a
 using public.aux_reactions b
 where a.game_id = b.game_id
   and a.user_id = b.user_id
   and (a.created_at, a.id) < (b.created_at, b.id);

create unique index if not exists idx_aux_reactions_one_per_person
  on public.aux_reactions (game_id, user_id);

create or replace function public.aux_bump_reaction_counts()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_game uuid;
begin
  v_game := coalesce(new.game_id, old.game_id);
  update public.aux_games g
     set fire_a = (select count(*) from public.aux_reactions r
                    where r.game_id = v_game and r.side = 'a' and r.kind = 'fire'),
         poop_a = (select count(*) from public.aux_reactions r
                    where r.game_id = v_game and r.side = 'a' and r.kind = 'poop'),
         fire_b = (select count(*) from public.aux_reactions r
                    where r.game_id = v_game and r.side = 'b' and r.kind = 'fire'),
         poop_b = (select count(*) from public.aux_reactions r
                    where r.game_id = v_game and r.side = 'b' and r.kind = 'poop')
   where g.id = v_game;
  return null;
end;
$fn$;

drop trigger if exists trg_aux_reactions_count on public.aux_reactions;
create trigger trg_aux_reactions_count
  after insert or update or delete on public.aux_reactions
  for each row execute function public.aux_bump_reaction_counts();

-- Backfill the games that already have reactions on them.
update public.aux_games g
   set fire_a = (select count(*) from public.aux_reactions r where r.game_id = g.id and r.side = 'a' and r.kind = 'fire'),
       poop_a = (select count(*) from public.aux_reactions r where r.game_id = g.id and r.side = 'a' and r.kind = 'poop'),
       fire_b = (select count(*) from public.aux_reactions r where r.game_id = g.id and r.side = 'b' and r.kind = 'fire'),
       poop_b = (select count(*) from public.aux_reactions r where r.game_id = g.id and r.side = 'b' and r.kind = 'poop')
 where exists (select 1 from public.aux_reactions r where r.game_id = g.id);

-- Switching fire -> trash is an UPDATE now, so it needs its own
-- policy (042's insert policy only covered the first one thrown).
drop policy if exists "Aux reactions: change your own" on public.aux_reactions;
create policy "Aux reactions: change your own"
  on public.aux_reactions for update
  using (user_id = auth.uid() and public.aux_can_view(room_id))
  with check (
    user_id = auth.uid()
    and public.aux_can_view(room_id)
    and exists (
      select 1 from public.aux_games g
       where g.id = game_id and g.phase = 'listening'
    )
  );

-- ---------- 2. Lobby caps ----------

-- How many PLAYERS a room of this format takes. Viewers are never
-- capped — only the people in the bracket.
create or replace function public.aux_player_cap(p_format text)
returns integer
language sql
immutable
as $fn$
  select case when p_format = 'bo3' then 10 else 32 end;
$fn$;

grant execute on function public.aux_player_cap(text) to anon, authenticated;

create or replace function public.aux_enforce_player_cap()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_format text;
  v_players integer;
begin
  -- Only a NEW player costs a seat: viewers are free, and a row that
  -- was already a player (a re-upsert) keeps the seat it has.
  if new.role <> 'player' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.role = 'player' then
    return new;
  end if;

  select format into v_format from public.aux_rooms where id = new.room_id;
  if v_format is null then
    return new;
  end if;

  select count(*) into v_players
    from public.aux_members
   where room_id = new.room_id
     and role = 'player'
     and user_id <> new.user_id;

  if v_players >= public.aux_player_cap(v_format) then
    raise exception 'ROOM_FULL';
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_aux_member_cap on public.aux_members;
create trigger trg_aux_member_cap
  before insert or update on public.aux_members
  for each row execute function public.aux_enforce_player_cap();

-- ---------- 3. Wins: no self-judged farming ----------

-- A room where the host PLAYS and is also the JUDGE is a room where
-- the host decides their own results. Their own wins in it count
-- nowhere (the chip on their name, the leaderboard). Everyone else's
-- wins in that room still count — they didn't pick the winner.
create or replace function public.aux_self_judged(
  p_host_id uuid, p_host_plays boolean, p_judge text, p_winner_id uuid
)
returns boolean
language sql
immutable
as $fn$
  select p_winner_id = p_host_id and p_host_plays and p_judge = 'host';
$fn$;

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
             and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, u.id)) as battles,
         (select count(*)::int from public.aux_matches m
            join public.aux_rooms r on r.id = m.room_id
           where m.winner_id = u.id
             and m.status = 'done'
             and not m.is_bye
             and not public.aux_self_judged(r.host_id, r.host_plays, r.judge, u.id)) as rounds
    from unnest(p_user_ids) as u(id);
$fn$;

revoke all on function public.aux_wins_for(uuid[]) from public;
grant execute on function public.aux_wins_for(uuid[]) to anon, authenticated;

-- ---------- 4. The leaderboard ----------

-- Top players by battles won (rounds won breaks the tie), either all
-- time or the last 7 days. Same self-judged exclusion as the chip.
create or replace function public.aux_leaderboard(
  p_period text default 'all',
  p_limit integer default 10
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
    select case when p_period = 'week'
                then now() - interval '7 days'
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

revoke all on function public.aux_leaderboard(text, integer) from public;
grant execute on function public.aux_leaderboard(text, integer) to anon, authenticated;

notify pgrst, 'reload schema';
