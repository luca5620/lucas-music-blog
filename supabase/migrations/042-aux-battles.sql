-- ============================================================
-- Migration 042 — AUX BATTLES + SoundCloud preview player
-- (2026-09-13). Run in the Supabase SQL Editor after 041.
--
-- Luca 2026-09-13: "lets replace debates with aux battles." A host
-- opens a ROOM on a topic (free text, a preset, or a random pick);
-- members join as PLAYERS or just watch; the host starts it and the
-- players go head to head — a single-round bracket or best-of-3
-- matches. Each GAME inside a match: both players put a song on
-- (Spotify / SoundCloud / YouTube), everyone listens through the
-- service's own embed, the crowd fires 🔥 / 💩 and votes, the host
-- calls it. Winner = majority vote (ties go to OVERTIME — new songs,
-- vote again — then the host picks) or the host's pick when the room
-- is set to "host decides". Odd player counts: one random player gets
-- a BYE (a free win) into the next round. The last one standing is
-- the CHAMPION; wins are counted and shown on players while they
-- play. PRIVATE rooms hide from the index and take a 6-letter code
-- the host hands out; the chat is live in every room.
--
-- The debates TABLES stay untouched (dropped later on Luca's word);
-- only the debates UI goes away.
--
-- Part B adds SoundCloud as a third preview player on release pages
-- (Spotify / Apple Music / SoundCloud), same lazy-resolve + cache
-- shape as Apple Music (migration 036).
-- ============================================================

-- ---------- B. SoundCloud preview player ----------

alter table public.releases
  add column if not exists soundcloud_url text,
  add column if not exists soundcloud_checked_at timestamptz;

alter table public.releases
  drop constraint if exists releases_soundcloud_url_shape;
alter table public.releases
  add constraint releases_soundcloud_url_shape
  check (soundcloud_url is null or soundcloud_url ~ '^https://soundcloud\.com/[A-Za-z0-9_./-]{3,300}$');

comment on column public.releases.soundcloud_url is
  'SoundCloud track or set permalink for the preview player. Resolved lazily via the SoundCloud API; null + checked_at = looked, not found.';

alter table public.profiles
  drop constraint if exists profiles_preferred_player_check;
alter table public.profiles
  add constraint profiles_preferred_player_check
  check (preferred_player in ('spotify', 'apple', 'soundcloud'));

-- Same narrow door as catalog_set_apple_music: only ever fills an
-- EMPTY soundcloud_url and stamps checked_at.
create or replace function public.catalog_set_soundcloud(
  p_release_id uuid,
  p_url        text
)
returns void
language plpgsql
security definer set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_url is not null and p_url !~ '^https://soundcloud\.com/[A-Za-z0-9_./-]{3,300}$' then
    raise exception 'BAD_SOUNDCLOUD_URL';
  end if;

  update public.releases
     set soundcloud_url = coalesce(soundcloud_url, p_url),
         soundcloud_checked_at = now()
   where id = p_release_id;
end;
$$;

revoke all on function public.catalog_set_soundcloud(uuid, text) from public;
grant execute on function public.catalog_set_soundcloud(uuid, text) to authenticated;

-- ---------- A. Aux battles ----------

create table if not exists public.aux_rooms (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  host_id         uuid not null references public.profiles(id) on delete cascade,
  topic           text not null check (char_length(topic) between 3 and 120),
  -- bo1 = one song each per match (a classic bracket round);
  -- bo3 = first to two games inside every match.
  format          text not null default 'bo1' check (format in ('bo1', 'bo3')),
  -- crowd = majority vote (OT on ties, host breaks a second tie);
  -- host = the host picks every winner.
  judge           text not null default 'crowd' check (judge in ('crowd', 'host')),
  is_private      boolean not null default false,
  host_plays      boolean not null default true,
  status          text not null default 'lobby' check (status in ('lobby', 'live', 'finished')),
  champion_id     uuid references public.profiles(id) on delete set null,
  -- The game everyone is looking at right now (no FK: games point at
  -- rooms, and a two-way FK makes deletes a headache).
  current_game_id uuid,
  player_count    integer not null default 0,
  message_count   integer not null default 0,
  created_at      timestamptz not null default now(),
  started_at      timestamptz,
  finished_at     timestamptz
);

create index if not exists idx_aux_rooms_status_created on public.aux_rooms (status, created_at desc);
create index if not exists idx_aux_rooms_host on public.aux_rooms (host_id);
create index if not exists idx_aux_rooms_champion on public.aux_rooms (champion_id);

-- The join code of a private room. NO row-level policies at all —
-- the only doors are the SECURITY DEFINER functions below, so the
-- code never leaks through a select on the room.
create table if not exists public.aux_room_codes (
  room_id uuid primary key references public.aux_rooms(id) on delete cascade,
  code    text not null check (code ~ '^[A-Z0-9]{6}$')
);

-- Who is in the room: players compete, viewers watch. Public rooms
-- need no viewer rows (anyone can look); private rooms need one for
-- every person allowed in, written by aux_join_with_code.
create table if not exists public.aux_members (
  room_id   uuid not null references public.aux_rooms(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'viewer' check (role in ('player', 'viewer')),
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id)
);

create index if not exists idx_aux_members_user on public.aux_members (user_id);

-- One node of the bracket. player_b null + is_bye = a free win.
create table if not exists public.aux_matches (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.aux_rooms(id) on delete cascade,
  round       integer not null check (round >= 1),
  position    integer not null check (position >= 0),
  player_a_id uuid not null references public.profiles(id) on delete cascade,
  player_b_id uuid references public.profiles(id) on delete cascade,
  is_bye      boolean not null default false,
  wins_a      integer not null default 0,
  wins_b      integer not null default 0,
  winner_id   uuid references public.profiles(id) on delete set null,
  status      text not null default 'pending' check (status in ('pending', 'live', 'done')),
  created_at  timestamptz not null default now(),
  unique (room_id, round, position)
);

create index if not exists idx_aux_matches_room on public.aux_matches (room_id, round, position);

-- One listening round inside a match. song_a / song_b are JSON:
-- { source: 'spotify'|'soundcloud'|'youtube', title, artist, artwork,
--   url, embed_id, release_id?, release_slug? } — written only by
-- aux_pick_song below, which checks the shape.
create table if not exists public.aux_games (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.aux_matches(id) on delete cascade,
  room_id     uuid not null references public.aux_rooms(id) on delete cascade,
  game_no     integer not null check (game_no >= 1),
  is_ot       boolean not null default false,
  song_a      jsonb,
  song_b      jsonb,
  phase       text not null default 'picking' check (phase in ('picking', 'listening', 'done')),
  winner_side text check (winner_side in ('a', 'b')),
  decided_by  text check (decided_by in ('crowd', 'host', 'bye')),
  votes_a     integer not null default 0,
  votes_b     integer not null default 0,
  created_at  timestamptz not null default now(),
  closed_at   timestamptz
);

create index if not exists idx_aux_games_match on public.aux_games (match_id, game_no);
create index if not exists idx_aux_games_room on public.aux_games (room_id);

create table if not exists public.aux_votes (
  game_id    uuid not null references public.aux_games(id) on delete cascade,
  room_id    uuid not null references public.aux_rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  side       text not null check (side in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (game_id, user_id)
);

create index if not exists idx_aux_votes_room on public.aux_votes (room_id);

-- The 🔥 / 💩 taps during the listening period. Many per person —
-- they are the crowd noise, not a vote.
create table if not exists public.aux_reactions (
  id         uuid primary key default gen_random_uuid(),
  game_id    uuid not null references public.aux_games(id) on delete cascade,
  room_id    uuid not null references public.aux_rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  side       text not null check (side in ('a', 'b')),
  kind       text not null check (kind in ('fire', 'poop')),
  created_at timestamptz not null default now()
);

create index if not exists idx_aux_reactions_game on public.aux_reactions (game_id);

create table if not exists public.aux_messages (
  id         uuid primary key default gen_random_uuid(),
  room_id    uuid not null references public.aux_rooms(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  content    text not null check (char_length(content) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists idx_aux_messages_room on public.aux_messages (room_id, created_at desc);

-- ---------- visibility helper ----------

-- Can the caller look at this room? Public rooms: everyone. Private
-- rooms: the host and the members (people who entered the code).
-- SECURITY DEFINER so policies on child tables can call it without
-- recursing through the rooms policy.
create or replace function public.aux_can_view(p_room_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.aux_rooms r
     where r.id = p_room_id
       and (
         not r.is_private
         or r.host_id = auth.uid()
         or exists (
           select 1 from public.aux_members m
            where m.room_id = r.id and m.user_id = auth.uid()
         )
       )
  );
$$;

revoke all on function public.aux_can_view(uuid) from public;
grant execute on function public.aux_can_view(uuid) to anon, authenticated;

create or replace function public.aux_is_host(p_room_id uuid)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (
    select 1 from public.aux_rooms r
     where r.id = p_room_id and r.host_id = auth.uid()
  );
$$;

revoke all on function public.aux_is_host(uuid) from public;
grant execute on function public.aux_is_host(uuid) to anon, authenticated;

-- ---------- RLS ----------

alter table public.aux_rooms      enable row level security;
alter table public.aux_room_codes enable row level security;
alter table public.aux_members    enable row level security;
alter table public.aux_matches    enable row level security;
alter table public.aux_games      enable row level security;
alter table public.aux_votes      enable row level security;
alter table public.aux_reactions  enable row level security;
alter table public.aux_messages   enable row level security;

-- rooms
drop policy if exists "Aux rooms: public or member" on public.aux_rooms;
create policy "Aux rooms: public or member"
  on public.aux_rooms for select
  using (
    not is_private
    or host_id = auth.uid()
    or exists (
      select 1 from public.aux_members m
       where m.room_id = aux_rooms.id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Aux rooms: host opens" on public.aux_rooms;
create policy "Aux rooms: host opens"
  on public.aux_rooms for insert
  with check (host_id = auth.uid());

drop policy if exists "Aux rooms: host runs it" on public.aux_rooms;
create policy "Aux rooms: host runs it"
  on public.aux_rooms for update
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

drop policy if exists "Aux rooms: host deletes" on public.aux_rooms;
create policy "Aux rooms: host deletes"
  on public.aux_rooms for delete
  using (host_id = auth.uid());

-- members
drop policy if exists "Aux members: visible with the room" on public.aux_members;
create policy "Aux members: visible with the room"
  on public.aux_members for select
  using (public.aux_can_view(room_id));

-- Joining a PUBLIC room is a plain insert of your own row while the
-- room is in the lobby (players) — or any time as a viewer. Private
-- rooms only get rows through aux_join_with_code.
drop policy if exists "Aux members: join a public room" on public.aux_members;
create policy "Aux members: join a public room"
  on public.aux_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.aux_rooms r
       where r.id = room_id
         and (not r.is_private or r.host_id = auth.uid())
         and (r.status = 'lobby' or aux_members.role = 'viewer')
    )
  );

drop policy if exists "Aux members: switch role in the lobby" on public.aux_members;
create policy "Aux members: switch role in the lobby"
  on public.aux_members for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.aux_rooms r
       where r.id = room_id and r.status = 'lobby'
    )
  );

drop policy if exists "Aux members: leave the lobby" on public.aux_members;
create policy "Aux members: leave the lobby"
  on public.aux_members for delete
  using (
    (user_id = auth.uid() or public.aux_is_host(room_id))
    and exists (
      select 1 from public.aux_rooms r
       where r.id = room_id and r.status = 'lobby'
    )
  );

-- matches + games: everyone in the room reads, only the host writes
-- (the bracket engine runs in the host's own request).
drop policy if exists "Aux matches: visible with the room" on public.aux_matches;
create policy "Aux matches: visible with the room"
  on public.aux_matches for select
  using (public.aux_can_view(room_id));

drop policy if exists "Aux matches: host writes" on public.aux_matches;
create policy "Aux matches: host writes"
  on public.aux_matches for all
  using (public.aux_is_host(room_id))
  with check (public.aux_is_host(room_id));

drop policy if exists "Aux games: visible with the room" on public.aux_games;
create policy "Aux games: visible with the room"
  on public.aux_games for select
  using (public.aux_can_view(room_id));

drop policy if exists "Aux games: host writes" on public.aux_games;
create policy "Aux games: host writes"
  on public.aux_games for all
  using (public.aux_is_host(room_id))
  with check (public.aux_is_host(room_id));

-- votes: one row per person per game, your own, only while the song
-- is playing. The two players of the match never vote on their own
-- game — checked here so a hand-rolled request can't either.
drop policy if exists "Aux votes: visible with the room" on public.aux_votes;
create policy "Aux votes: visible with the room"
  on public.aux_votes for select
  using (public.aux_can_view(room_id));

drop policy if exists "Aux votes: cast your own" on public.aux_votes;
create policy "Aux votes: cast your own"
  on public.aux_votes for insert
  with check (
    user_id = auth.uid()
    and public.aux_can_view(room_id)
    and exists (
      select 1 from public.aux_games g
      join public.aux_matches m on m.id = g.match_id
       where g.id = game_id
         and g.phase = 'listening'
         and m.player_a_id <> auth.uid()
         and coalesce(m.player_b_id, '00000000-0000-0000-0000-000000000000'::uuid) <> auth.uid()
    )
  );

drop policy if exists "Aux votes: switch your own" on public.aux_votes;
create policy "Aux votes: switch your own"
  on public.aux_votes for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.aux_games g
       where g.id = game_id and g.phase = 'listening'
    )
  );

-- reactions: your own, during the listening period.
drop policy if exists "Aux reactions: visible with the room" on public.aux_reactions;
create policy "Aux reactions: visible with the room"
  on public.aux_reactions for select
  using (public.aux_can_view(room_id));

drop policy if exists "Aux reactions: throw your own" on public.aux_reactions;
create policy "Aux reactions: throw your own"
  on public.aux_reactions for insert
  with check (
    user_id = auth.uid()
    and public.aux_can_view(room_id)
    and exists (
      select 1 from public.aux_games g
       where g.id = game_id and g.phase = 'listening'
    )
  );

-- chat
drop policy if exists "Aux messages: visible with the room" on public.aux_messages;
create policy "Aux messages: visible with the room"
  on public.aux_messages for select
  using (public.aux_can_view(room_id));

drop policy if exists "Aux messages: post your own" on public.aux_messages;
create policy "Aux messages: post your own"
  on public.aux_messages for insert
  with check (user_id = auth.uid() and public.aux_can_view(room_id));

drop policy if exists "Aux messages: delete your own" on public.aux_messages;
create policy "Aux messages: delete your own"
  on public.aux_messages for delete
  using (
    user_id = auth.uid()
    or public.aux_is_host(room_id)
    or exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  );

-- ---------- codes: the SECURITY DEFINER doors ----------

-- The host reads (or, on first call, mints) the room's code.
create or replace function public.aux_room_code(p_room_id uuid)
returns text
language plpgsql
security definer set search_path = public
as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  i int;
begin
  if not public.aux_is_host(p_room_id) then
    raise exception 'NOT_HOST';
  end if;
  select code into v_code from public.aux_room_codes where room_id = p_room_id;
  if v_code is not null then
    return v_code;
  end if;
  v_code := '';
  for i in 1..6 loop
    v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
  end loop;
  insert into public.aux_room_codes (room_id, code) values (p_room_id, v_code)
    on conflict (room_id) do nothing;
  select code into v_code from public.aux_room_codes where room_id = p_room_id;
  return v_code;
end;
$$;

revoke all on function public.aux_room_code(uuid) from public, anon;
grant execute on function public.aux_room_code(uuid) to authenticated;

-- A member enters the code: on a match they get a viewer row (which
-- is what unlocks the room for them) and the room id comes back.
create or replace function public.aux_join_with_code(p_slug text, p_code text)
returns uuid
language plpgsql
security definer set search_path = public
as $$
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
  insert into public.aux_members (room_id, user_id, role)
    values (v_room_id, auth.uid(), 'viewer')
    on conflict (room_id, user_id) do nothing;
  return v_room_id;
end;
$$;

revoke all on function public.aux_join_with_code(text, text) from public, anon;
grant execute on function public.aux_join_with_code(text, text) to authenticated;

-- The code gate needs to tell "no such room" from "private, not let
-- in yet" — RLS returns nothing for both. Leaks only whether the slug
-- the visitor typed exists.
create or replace function public.aux_slug_exists(p_slug text)
returns boolean
language sql
stable
security definer set search_path = public
as $$
  select exists (select 1 from public.aux_rooms r where r.slug = p_slug and r.is_private);
$$;

revoke all on function public.aux_slug_exists(text) from public;
grant execute on function public.aux_slug_exists(text) to anon, authenticated;

-- ---------- picking a song: the players' one write ----------

-- A player of the LIVE game sets their own side's song. Both set →
-- the game moves to 'listening' on its own, so no host tap is needed
-- between the picks and the play.
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
  if v_match.player_a_id = auth.uid() then
    v_side := 'a';
  elsif v_match.player_b_id = auth.uid() then
    v_side := 'b';
  else
    raise exception 'NOT_A_PLAYER';
  end if;

  -- Shape check: the API builds this object, but the DB is the wall.
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

-- ---------- counters ----------

create or replace function public.aux_bump_message_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.aux_rooms set message_count = message_count + 1 where id = new.room_id;
  elsif tg_op = 'DELETE' then
    update public.aux_rooms set message_count = greatest(0, message_count - 1) where id = old.room_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_aux_messages_count on public.aux_messages;
create trigger trg_aux_messages_count
  after insert or delete on public.aux_messages
  for each row execute function public.aux_bump_message_count();

create or replace function public.aux_bump_player_count()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_room uuid := coalesce(new.room_id, old.room_id);
begin
  update public.aux_rooms
     set player_count = (
       select count(*) from public.aux_members
        where room_id = v_room and role = 'player'
     )
   where id = v_room;
  return null;
end;
$$;

drop trigger if exists trg_aux_members_count on public.aux_members;
create trigger trg_aux_members_count
  after insert or update or delete on public.aux_members
  for each row execute function public.aux_bump_player_count();

-- Vote tallies live on the game row so one realtime UPDATE carries
-- the score to every screen (no per-vote refetch storm).
create or replace function public.aux_bump_vote_counts()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  v_game uuid := coalesce(new.game_id, old.game_id);
begin
  update public.aux_games
     set votes_a = (select count(*) from public.aux_votes where game_id = v_game and side = 'a'),
         votes_b = (select count(*) from public.aux_votes where game_id = v_game and side = 'b')
   where id = v_game;
  return null;
end;
$$;

drop trigger if exists trg_aux_votes_count on public.aux_votes;
create trigger trg_aux_votes_count
  after insert or update or delete on public.aux_votes
  for each row execute function public.aux_bump_vote_counts();

-- ---------- wins: the stat shown on players ----------

-- Battles won (champion of a finished room) + rounds won (matches).
create or replace function public.aux_wins_for(p_user_ids uuid[])
returns table (user_id uuid, battles integer, rounds integer)
language sql
stable
security definer set search_path = public
as $$
  select u.id as user_id,
         (select count(*)::int from public.aux_rooms r
           where r.champion_id = u.id and r.status = 'finished') as battles,
         (select count(*)::int from public.aux_matches m
           where m.winner_id = u.id and m.status = 'done' and not m.is_bye) as rounds
    from unnest(p_user_ids) as u(id);
$$;

revoke all on function public.aux_wins_for(uuid[]) from public;
grant execute on function public.aux_wins_for(uuid[]) to anon, authenticated;

-- ---------- moderation: the new report targets ----------

alter table public.content_reports
  drop constraint if exists content_reports_target_type_check;
alter table public.content_reports
  add constraint content_reports_target_type_check
  check (target_type in (
    'review', 'comment', 'list', 'debate', 'debate_message',
    'room_message', 'profile', 'post', 'aux_room', 'aux_message'
  ));

-- ---------- notifications: "hosted an aux battle" ----------

alter table public.notifications
  drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type in (
    'follow', 'review_like', 'comment', 'comment_reply', 'post_like',
    'list_like', 'new_review', 'new_post', 'new_list', 'new_debate',
    'new_aux'
  ));

-- ---------- realtime ----------

do $$
begin
  alter publication supabase_realtime add table public.aux_rooms;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.aux_members;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.aux_matches;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.aux_games;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.aux_reactions;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.aux_messages;
exception when duplicate_object then null;
end $$;

-- DELETE events need the old row's columns for the room filter.
alter table public.aux_members  replica identity full;
alter table public.aux_messages replica identity full;

notify pgrst, 'reload schema';
