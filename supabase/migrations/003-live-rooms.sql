-- =============================================================================
-- Phase 2b-1 — Live release rooms (chat + reactions)
-- =============================================================================
-- Adds per-release chat rooms with messages and emoji reactions, plus a
-- denormalized last_activity_at for the LIVE indicator. Self-contained and
-- re-runnable — safe to re-execute after a partial run.
--
-- Tables: release_rooms, room_messages, room_reactions
-- Function: get_release_room (security definer; lazy-creates the room)
-- Triggers: bump_room_activity (after insert/delete on messages, after insert
--           on reactions) — keeps message_count + last_activity_at fresh.
-- Realtime: room_messages and room_reactions are added to the
--           supabase_realtime publication so clients can subscribe.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- 0. set_updated_at() — defined here so the migration is self-sufficient
--    (also lives in schema.sql / 002; create-or-replace makes this idempotent).
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------------
-- 1. RELEASE_ROOMS
-- ---------------------------------------------------------------------------
create table if not exists public.release_rooms (
  id                uuid primary key default uuid_generate_v4(),
  release_id        uuid not null unique references public.releases(id) on delete cascade,
  message_count     int  not null default 0,
  last_activity_at  timestamptz,
  created_at        timestamptz not null default now()
);

create index if not exists idx_release_rooms_release_id     on public.release_rooms (release_id);
create index if not exists idx_release_rooms_last_activity  on public.release_rooms (last_activity_at desc);

comment on table public.release_rooms is 'One chat room per release; lazy-created on first activity.';


-- ---------------------------------------------------------------------------
-- 2. ROOM_MESSAGES
-- ---------------------------------------------------------------------------
create table if not exists public.room_messages (
  id              uuid primary key default uuid_generate_v4(),
  room_id         uuid not null references public.release_rooms(id) on delete cascade,
  user_id         uuid not null references public.profiles(id)      on delete cascade,
  content         text not null check (length(content) > 0 and length(content) <= 1000),
  track_position  int,
  created_at      timestamptz not null default now()
);

create index if not exists idx_room_messages_room_id  on public.room_messages (room_id, created_at desc);
create index if not exists idx_room_messages_user_id  on public.room_messages (user_id);

comment on table public.room_messages is 'Chat messages posted in a release room. Optionally track-anchored.';


-- ---------------------------------------------------------------------------
-- 3. ROOM_REACTIONS
-- ---------------------------------------------------------------------------
create table if not exists public.room_reactions (
  id              uuid primary key default uuid_generate_v4(),
  room_id         uuid not null references public.release_rooms(id) on delete cascade,
  user_id         uuid not null references public.profiles(id)      on delete cascade,
  target_type     text not null check (target_type in ('track','message')),
  track_position  int,
  message_id      uuid references public.room_messages(id) on delete cascade,
  emoji           text not null check (length(emoji) <= 16),
  created_at      timestamptz not null default now(),

  constraint chk_room_reactions_target check (
    (target_type = 'track'   and track_position is not null and message_id is null)
    or
    (target_type = 'message' and message_id is not null     and track_position is null)
  )
);

-- Idempotency: one reaction per user per (target, emoji). Two partial unique
-- indexes — one per target_type — avoids needing expression indexes over
-- coalesced nulls.
create unique index if not exists uq_room_reactions_track
  on public.room_reactions (user_id, room_id, track_position, emoji)
  where target_type = 'track';

create unique index if not exists uq_room_reactions_message
  on public.room_reactions (user_id, message_id, emoji)
  where target_type = 'message';

create index if not exists idx_room_reactions_room_id     on public.room_reactions (room_id);
create index if not exists idx_room_reactions_message_id  on public.room_reactions (message_id);
create index if not exists idx_room_reactions_track       on public.room_reactions (room_id, track_position);

comment on table public.room_reactions is 'Emoji reactions on tracks or messages within a release room.';


-- ---------------------------------------------------------------------------
-- 4. bump_room_activity() — keeps message_count + last_activity_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.bump_room_activity()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' and tg_table_name = 'room_messages' then
    update public.release_rooms
       set message_count    = message_count + 1,
           last_activity_at = now()
     where id = new.room_id;
    return new;

  elsif tg_op = 'DELETE' and tg_table_name = 'room_messages' then
    update public.release_rooms
       set message_count = greatest(message_count - 1, 0)
     where id = old.room_id;
    return old;

  elsif tg_op = 'INSERT' and tg_table_name = 'room_reactions' then
    update public.release_rooms
       set last_activity_at = now()
     where id = new.room_id;
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_room_messages_bump_activity on public.room_messages;
create trigger trg_room_messages_bump_activity
  after insert or delete on public.room_messages
  for each row execute function public.bump_room_activity();

drop trigger if exists trg_room_reactions_bump_activity on public.room_reactions;
create trigger trg_room_reactions_bump_activity
  after insert on public.room_reactions
  for each row execute function public.bump_room_activity();


-- ---------------------------------------------------------------------------
-- 5. get_release_room(release_uuid) — lazy-create + return the room row.
--    SECURITY DEFINER so callers don't need direct insert privilege on
--    release_rooms; abuse is bounded by the FK to releases (and the
--    caller is auth-checked at the API layer).
-- ---------------------------------------------------------------------------
create or replace function public.get_release_room(release_uuid uuid)
returns public.release_rooms
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  result public.release_rooms;
begin
  insert into public.release_rooms (release_id)
  values (release_uuid)
  on conflict (release_id) do update
    set release_id = excluded.release_id
  returning * into result;

  return result;
end;
$$;

comment on function public.get_release_room is 'Returns the release_rooms row for a release, lazy-creating it if missing.';


-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

-- ---- release_rooms ----
alter table public.release_rooms enable row level security;

drop policy if exists "Release rooms are viewable by everyone" on public.release_rooms;
create policy "Release rooms are viewable by everyone"
  on public.release_rooms for select
  using (true);

-- No direct insert/update/delete policies — clients route through the
-- get_release_room() security-definer function.


-- ---- room_messages ----
alter table public.room_messages enable row level security;

drop policy if exists "Room messages are viewable by everyone" on public.room_messages;
create policy "Room messages are viewable by everyone"
  on public.room_messages for select
  using (true);

drop policy if exists "Authenticated users can post room messages" on public.room_messages;
create policy "Authenticated users can post room messages"
  on public.room_messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update their own room messages" on public.room_messages;
create policy "Users can update their own room messages"
  on public.room_messages for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users and mods can delete room messages" on public.room_messages;
create policy "Users and mods can delete room messages"
  on public.room_messages for delete
  using (
    auth.uid() = user_id
    or (select role from public.profiles where id = auth.uid()) in ('owner','admin')
  );


-- ---- room_reactions ----
alter table public.room_reactions enable row level security;

drop policy if exists "Room reactions are viewable by everyone" on public.room_reactions;
create policy "Room reactions are viewable by everyone"
  on public.room_reactions for select
  using (true);

drop policy if exists "Authenticated users can add reactions" on public.room_reactions;
create policy "Authenticated users can add reactions"
  on public.room_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own reactions" on public.room_reactions;
create policy "Users can remove their own reactions"
  on public.room_reactions for delete
  using (auth.uid() = user_id);


-- ===========================================================================
-- REALTIME PUBLICATION
-- ===========================================================================
-- Add the activity tables to supabase_realtime so 2b-2 can subscribe.
-- Wrapped to swallow duplicate_object on re-run.

do $$
begin
  alter publication supabase_realtime add table public.room_messages;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.room_reactions;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;
