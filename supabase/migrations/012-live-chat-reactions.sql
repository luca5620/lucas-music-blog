-- =============================================================================
-- Migration 008 — truly-live chat + reactions
--
-- 1. room_reactions gets REPLICA IDENTITY FULL: realtime DELETE events only
--    carry the columns in the replica identity, and postgres_changes filters
--    on DELETE match against the OLD row. With the default (pk-only) identity,
--    a `room_id=eq.X` filter can never match a delete, so un-reacts never
--    reached other clients.
-- 2. debate_message_reactions: emoji reactions on debate chat messages
--    (release-room messages already have room_reactions with
--    target_type = 'message'; debates needed their own table since
--    debate_messages live outside release rooms).
-- 3. Publication: debate_votes + debate_message_reactions join
--    supabase_realtime so vote bars and reactions stream live.
-- =============================================================================


-- ===========================================================================
-- 1. DELETE events must carry the full old row
-- ===========================================================================

alter table public.room_reactions replica identity full;


-- ===========================================================================
-- 2. debate_message_reactions
-- ===========================================================================

create table if not exists public.debate_message_reactions (
  id          uuid primary key default gen_random_uuid(),
  debate_id   uuid not null references public.debates(id) on delete cascade,
  message_id  uuid not null references public.debate_messages(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  emoji       text not null check (char_length(emoji) between 1 and 16),
  created_at  timestamptz not null default now(),

  constraint uq_debate_message_reactions unique (user_id, message_id, emoji)
);

create index if not exists idx_debate_message_reactions_message
  on public.debate_message_reactions (message_id);
create index if not exists idx_debate_message_reactions_debate
  on public.debate_message_reactions (debate_id);

comment on table public.debate_message_reactions is
  'Emoji reactions on debate chat messages. One row per (user, message, emoji).';

alter table public.debate_message_reactions enable row level security;

drop policy if exists "Debate reactions are viewable by everyone"
  on public.debate_message_reactions;
create policy "Debate reactions are viewable by everyone"
  on public.debate_message_reactions for select using (true);

drop policy if exists "Users react as themselves"
  on public.debate_message_reactions;
create policy "Users react as themselves"
  on public.debate_message_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can remove their own debate reactions"
  on public.debate_message_reactions;
create policy "Users can remove their own debate reactions"
  on public.debate_message_reactions for delete
  using (auth.uid() = user_id);

-- Same DELETE-event requirement as room_reactions above.
alter table public.debate_message_reactions replica identity full;


-- ===========================================================================
-- 3. Realtime publication
-- ===========================================================================
-- NOTE: unlike migrations 003/006 we do NOT swallow undefined_object here —
-- if the supabase_realtime publication were missing, silently skipping it
-- would ship dead realtime again. duplicate_object is still fine (re-runs).

do $$
begin
  alter publication supabase_realtime add table public.debate_votes;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.debate_message_reactions;
exception
  when duplicate_object then null;
end $$;
