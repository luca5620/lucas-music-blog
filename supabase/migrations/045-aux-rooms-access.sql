-- ============================================================
-- Migration 045 — AUX BATTLES: who can watch, who can play, who's
-- out, and invites (2026-09-14). Run in the SQL Editor after 044.
--
-- Luca 2026-09-14, three things:
--
--  1. "the room that is private is restricted to only the players
--     with the code to PARTICIPATE, and maybe there should be an
--     option where private rooms can still be viewed publicly, so the
--     masses can vote on private session essentially, and that would
--     be the DEFAULT, so if people wanted a truly private lobby where
--     no one else could see or vote other than those with the code,
--     then they have to check that box."
--
--     So PRIVATE and HIDDEN come apart. `is_private` now means one
--     thing only: you need the code to take a SPOT in the bracket.
--     The new `is_hidden` is the "truly private" box — off by
--     default — and it is what everything about VISIBILITY keys on:
--     the index listing, aux_can_view, the code gate, and therefore
--     watching, voting, reacting and chatting.
--
--       public                → anyone watches, anyone plays
--       private (default)     → anyone watches and VOTES,
--                               only the code plays
--       private + hidden      → the code, or nothing
--
--     Rooms that already exist were fully hidden under the old
--     meaning, so they are backfilled is_hidden = is_private and
--     nothing changes underneath anyone.
--
--  2. "as a host of a aux battle room, you should have the choice to
--     remove people from the room or block them if they keep
--     spam-joining." → aux_bans, plus the host's delete reach
--     extended past the lobby.
--
--  3. "there should be a way to invite someone to your aux battle you
--     are friends with (follow each other only) and it pops up in the
--     notification center to join." → aux_invite(), which checks the
--     follow goes BOTH ways and hands the invitee a SEAT, so an
--     invite into a private room IS the code.
--
-- THE SEAT (aux_seats). Under the old rules, holding an aux_members
-- row in a private room was itself proof you had typed the code,
-- because aux_join_with_code was the only thing that could make one.
-- Now that a stranger can hold a viewer row in a visible-private
-- room, the row proves nothing — so the right to take a spot gets
-- its own table. It has a SELECT policy and NOTHING else, exactly
-- like aux_room_codes: the only doors are the SECURITY DEFINER
-- functions below, so a hand-rolled request can never grant itself
-- one. (A plain column would not do: the client owns its own member
-- row and could simply write the flag true.)
-- ============================================================

-- ---------- 1. private is not the same as hidden ----------

alter table public.aux_rooms
  add column if not exists is_hidden boolean not null default false;

-- Everything opened before today meant "private" the old way.
update public.aux_rooms set is_hidden = true
 where is_private and not is_hidden;

-- Visibility keys on HIDDEN now, not private.
create or replace function public.aux_can_view(p_room_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $fn$
  select exists (
    select 1 from public.aux_rooms r
     where r.id = p_room_id
       and (
         not r.is_hidden
         or r.host_id = auth.uid()
         or exists (
           select 1 from public.aux_members m
            where m.room_id = r.id and m.user_id = auth.uid()
         )
       )
  );
$fn$;

revoke all on function public.aux_can_view(uuid) from public;
grant execute on function public.aux_can_view(uuid) to anon, authenticated;

drop policy if exists "Aux rooms: public or member" on public.aux_rooms;
create policy "Aux rooms: public or member"
  on public.aux_rooms for select
  using (
    not is_hidden
    or host_id = auth.uid()
    or exists (
      select 1 from public.aux_members m
       where m.room_id = aux_rooms.id and m.user_id = auth.uid()
    )
  );

-- The code gate is for HIDDEN rooms. A visible private room renders
-- like any other and asks for the code only at "grab a spot".
create or replace function public.aux_slug_exists(p_slug text)
returns boolean
language sql
stable
security definer set search_path = public
as $fn$
  select exists (select 1 from public.aux_rooms r where r.slug = p_slug and r.is_hidden);
$fn$;

revoke all on function public.aux_slug_exists(text) from public;
grant execute on function public.aux_slug_exists(text) to anon, authenticated;

-- ---------- 2. the seat: the right to take a spot ----------

create table if not exists public.aux_seats (
  room_id    uuid not null references public.aux_rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  -- 'code' = typed the six letters · 'invite' = the host invited them
  source     text not null default 'code' check (source in ('code', 'invite')),
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.aux_seats enable row level security;

-- SELECT and nothing else, on purpose — see the header note.
drop policy if exists "Aux seats: visible with the room" on public.aux_seats;
create policy "Aux seats: visible with the room"
  on public.aux_seats for select
  using (public.aux_can_view(room_id));

-- Everyone already inside a private room typed the code to get there.
insert into public.aux_seats (room_id, user_id, source)
select m.room_id, m.user_id, 'code'
  from public.aux_members m
  join public.aux_rooms r on r.id = m.room_id
 where r.is_private
on conflict (room_id, user_id) do nothing;

create or replace function public.aux_has_seat(p_room_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $fn$
  select exists (
    select 1 from public.aux_seats s
     where s.room_id = p_room_id and s.user_id = auth.uid()
  );
$fn$;

revoke all on function public.aux_has_seat(uuid) from public;
grant execute on function public.aux_has_seat(uuid) to anon, authenticated;

-- ---------- 3. bans ----------

-- The host's block list. Its own table rather than a flag on
-- aux_members, so the ban outlives the row it removed — which is the
-- whole point against someone who keeps re-joining.
create table if not exists public.aux_bans (
  room_id    uuid not null references public.aux_rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

alter table public.aux_bans enable row level security;

drop policy if exists "Aux bans: visible with the room" on public.aux_bans;
create policy "Aux bans: visible with the room"
  on public.aux_bans for select
  using (public.aux_can_view(room_id));

drop policy if exists "Aux bans: the host blocks" on public.aux_bans;
create policy "Aux bans: the host blocks"
  on public.aux_bans for insert
  with check (public.aux_is_host(room_id) and user_id <> auth.uid());

drop policy if exists "Aux bans: the host lifts" on public.aux_bans;
create policy "Aux bans: the host lifts"
  on public.aux_bans for delete
  using (public.aux_is_host(room_id));

create or replace function public.aux_is_banned(p_room_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $fn$
  select exists (
    select 1 from public.aux_bans b
     where b.room_id = p_room_id and b.user_id = auth.uid()
  );
$fn$;

revoke all on function public.aux_is_banned(uuid) from public;
grant execute on function public.aux_is_banned(uuid) to anon, authenticated;

-- ---------- 4. members: the new join rules ----------

-- WATCHING needs nothing but a room you can see. Taking a SPOT in a
-- private room needs a seat (the code, or an invite) — or the host's
-- own chair. A banned user gets neither.
drop policy if exists "Aux members: join a public room" on public.aux_members;
drop policy if exists "Aux members: join a room" on public.aux_members;
create policy "Aux members: join a room"
  on public.aux_members for insert
  with check (
    user_id = auth.uid()
    and not public.aux_is_banned(room_id)
    and public.aux_can_view(room_id)
    and exists (
      select 1 from public.aux_rooms r
       where r.id = room_id
         and (r.status = 'lobby' or aux_members.role = 'viewer')
         and (
           aux_members.role = 'viewer'
           or not r.is_private
           or r.host_id = auth.uid()
           or public.aux_has_seat(room_id)
         )
    )
  );

drop policy if exists "Aux members: switch role in the lobby" on public.aux_members;
create policy "Aux members: switch role in the lobby"
  on public.aux_members for update
  using (user_id = auth.uid() and not public.aux_is_banned(room_id))
  with check (
    user_id = auth.uid()
    and not public.aux_is_banned(room_id)
    and exists (
      select 1 from public.aux_rooms r
       where r.id = room_id
         and r.status = 'lobby'
         and (
           aux_members.role = 'viewer'
           or not r.is_private
           or r.host_id = auth.uid()
           or public.aux_has_seat(room_id)
         )
    )
  );

-- You leave in the lobby; the HOST can remove someone at any point
-- (that's the kick), but never themselves.
drop policy if exists "Aux members: leave the lobby" on public.aux_members;
drop policy if exists "Aux members: leave, or the host removes" on public.aux_members;
create policy "Aux members: leave, or the host removes"
  on public.aux_members for delete
  using (
    (
      user_id = auth.uid()
      and exists (
        select 1 from public.aux_rooms r
         where r.id = room_id and r.status = 'lobby'
      )
    )
    or (public.aux_is_host(room_id) and user_id <> auth.uid())
  );

-- A ban silences them wherever they still stand.
drop policy if exists "Aux messages: post your own" on public.aux_messages;
create policy "Aux messages: post your own"
  on public.aux_messages for insert
  with check (
    user_id = auth.uid()
    and public.aux_can_view(room_id)
    and not public.aux_is_banned(room_id)
  );

drop policy if exists "Aux votes: cast your own" on public.aux_votes;
create policy "Aux votes: cast your own"
  on public.aux_votes for insert
  with check (
    user_id = auth.uid()
    and public.aux_can_view(room_id)
    and not public.aux_is_banned(room_id)
    and exists (
      select 1 from public.aux_games g
      join public.aux_matches m on m.id = g.match_id
       where g.id = game_id
         and g.phase = 'listening'
         and m.player_a_id <> auth.uid()
         and coalesce(m.player_b_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
    )
  );

drop policy if exists "Aux reactions: throw your own" on public.aux_reactions;
create policy "Aux reactions: throw your own"
  on public.aux_reactions for insert
  with check (
    user_id = auth.uid()
    and public.aux_can_view(room_id)
    and not public.aux_is_banned(room_id)
    and exists (
      select 1 from public.aux_games g
       where g.id = game_id and g.phase = 'listening'
    )
  );

-- Typing the code buys the seat (and, in a hidden room, the member
-- row that makes the place visible at all).
create or replace function public.aux_join_with_code(p_slug text, p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_room_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select r.id into v_room_id
    from public.aux_rooms r
    join public.aux_room_codes c on c.room_id = r.id
   where r.slug = p_slug
     and c.code = upper(trim(p_code));
  if v_room_id is null then
    raise exception 'BAD_CODE';
  end if;
  if exists (select 1 from public.aux_bans b
              where b.room_id = v_room_id and b.user_id = auth.uid()) then
    raise exception 'BANNED';
  end if;
  insert into public.aux_seats (room_id, user_id, source)
    values (v_room_id, auth.uid(), 'code')
    on conflict (room_id, user_id) do nothing;
  insert into public.aux_members (room_id, user_id, role)
    values (v_room_id, auth.uid(), 'viewer')
    on conflict (room_id, user_id) do nothing;
  return v_room_id;
end;
$fn$;

revoke all on function public.aux_join_with_code(text, text) from public, anon;
grant execute on function public.aux_join_with_code(text, text) to authenticated;

-- ---------- 5. invites ----------

-- The host invites someone they and the invitee BOTH follow. The
-- invitee gets a seat, so an invite into a private room is the code:
-- they can take a spot without ever being told six letters. Returns
-- the invitee's id; the API turns that into the notification.
create or replace function public.aux_invite(p_room_id uuid, p_user_id uuid)
returns uuid
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_host uuid;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  select host_id, status into v_host, v_status
    from public.aux_rooms where id = p_room_id;
  if v_host is null then
    raise exception 'NO_ROOM';
  end if;
  if v_host <> auth.uid() then
    raise exception 'NOT_HOST';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'SELF';
  end if;
  if v_status = 'finished' then
    raise exception 'FINISHED';
  end if;
  -- Friends only, and "friend" here means the follow goes both ways.
  if not exists (
    select 1 from public.follows f
     where f.follower_id = auth.uid() and f.following_id = p_user_id
  ) or not exists (
    select 1 from public.follows f
     where f.follower_id = p_user_id and f.following_id = auth.uid()
  ) then
    raise exception 'NOT_MUTUAL';
  end if;
  if exists (select 1 from public.aux_bans b
              where b.room_id = p_room_id and b.user_id = p_user_id) then
    raise exception 'BANNED';
  end if;

  insert into public.aux_seats (room_id, user_id, source)
    values (p_room_id, p_user_id, 'invite')
    on conflict (room_id, user_id) do nothing;
  -- The member row is what makes a HIDDEN room visible to them; in
  -- any other room it just means they're expected.
  insert into public.aux_members (room_id, user_id, role)
    values (p_room_id, p_user_id, 'viewer')
    on conflict (room_id, user_id) do nothing;

  return p_user_id;
end;
$fn$;

revoke all on function public.aux_invite(uuid, uuid) from public, anon;
grant execute on function public.aux_invite(uuid, uuid) to authenticated;

-- Who the host can invite: the people who follow them back, with a
-- flag for the ones already in the room. One query for the picker.
create or replace function public.aux_invitable(p_room_id uuid)
returns table (
  user_id      uuid,
  username     text,
  display_name text,
  avatar_url   text,
  role         text,
  already_in   boolean
)
language sql
stable
security definer set search_path = public
as $fn$
  select p.id, p.username, p.display_name, p.avatar_url, p.role,
         exists (
           select 1 from public.aux_members m
            where m.room_id = p_room_id and m.user_id = p.id
         ) as already_in
    from public.follows mine
    join public.follows back
      on back.follower_id = mine.following_id
     and back.following_id = auth.uid()
    join public.profiles p on p.id = mine.following_id
   where mine.follower_id = auth.uid()
     and public.aux_is_host(p_room_id)
     and not exists (
       select 1 from public.aux_bans b
        where b.room_id = p_room_id and b.user_id = p.id
     )
   order by already_in asc, coalesce(p.display_name, p.username) asc
   limit 50;
$fn$;

revoke all on function public.aux_invitable(uuid) from public, anon;
grant execute on function public.aux_invitable(uuid) to authenticated;

-- The bell learns one more word.
alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'follow', 'review_like', 'comment', 'comment_reply', 'post_like',
    'list_like', 'new_review', 'new_post', 'new_list', 'new_debate',
    'new_aux', 'aux_invite'
  ));

-- ---------- 6. the leaderboard skips hidden rooms ----------

-- A truly private room is the one place a result can be cooked with
-- nobody watching — the same worry that took self-judged wins out in
-- 044. Visible private rooms still count: the masses vote in those.
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
       and not r.is_hidden
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
       and not r.is_hidden
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

-- ---------- realtime ----------

do $$
begin
  alter publication supabase_realtime add table public.aux_bans;
exception when duplicate_object then null;
end $$;

notify pgrst, 'reload schema';
