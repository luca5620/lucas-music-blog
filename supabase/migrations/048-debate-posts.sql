-- ============================================================
-- Migration 048 — DEBATES COME BACK, AS A KIND OF POST
-- (2026-09-16). Run in the SQL Editor after 047.
--
-- Luca: "I would like to figure out a way to incorporate debates
-- being reintroduced through posts, like having it as an option to
-- make a debate post when creating a post, I don't feel like we
-- should fully kill it, and may entice people to make more posts."
--
-- Debates were removed as their own section when Aux Wars replaced
-- them (2026-09-13). The old `debates` tables were deliberately left
-- in place and are still untouched — this migration does NOT revive
-- them and does NOT drop them. This is a new, much smaller thing:
-- a post can carry TWO SIDES and a vote, and that's it. No rooms, no
-- live chat, no brackets. Aux Wars keeps all of that.
--
-- WHY ON POSTS rather than a new section: a debate with no audience
-- is a dead page, and /posts is where people already are. Hanging it
-- off a post also means it inherits everything posts already have —
-- drafts, likes, reports, blocks, the feed, moderation, deletion.
--
-- SHAPE. A post IS a debate when side_a_label is set; the pair is
-- forced on or off together by chk_posts_debate_pair, so there is no
-- such thing as half a debate. Each side can optionally point at a
-- release (the same "side A = this record, side B = that one" idea
-- migration 039 added to the old debates table).
--
-- The tallies live ON THE POST ROW, maintained by a trigger, exactly
-- like aux_games.votes_a/votes_b. That is what lets the feed show a
-- vote split without a second query per card.
-- ============================================================

-- ---------- 1. the two sides ----------

alter table public.posts
  add column if not exists side_a_label      text,
  add column if not exists side_b_label      text,
  add column if not exists side_a_release_id uuid references public.releases(id) on delete set null,
  add column if not exists side_b_release_id uuid references public.releases(id) on delete set null,
  add column if not exists debate_votes_a    integer not null default 0,
  add column if not exists debate_votes_b    integer not null default 0;

alter table public.posts
  drop constraint if exists chk_posts_debate_pair,
  drop constraint if exists chk_posts_side_a_len,
  drop constraint if exists chk_posts_side_b_len;

-- Both sides, or neither. Never one.
alter table public.posts
  add constraint chk_posts_debate_pair
    check ((side_a_label is null) = (side_b_label is null)),
  add constraint chk_posts_side_a_len
    check (side_a_label is null or char_length(side_a_label) between 1 and 40),
  add constraint chk_posts_side_b_len
    check (side_b_label is null or char_length(side_b_label) between 1 and 40);

create index if not exists idx_posts_side_a_release on public.posts (side_a_release_id);
create index if not exists idx_posts_side_b_release on public.posts (side_b_release_id);

-- ---------- 2. the votes ----------

create table if not exists public.post_debate_votes (
  post_id    uuid not null references public.posts(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  side       text not null check (side in ('a', 'b')),
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index if not exists idx_post_debate_votes_post on public.post_debate_votes (post_id);

alter table public.post_debate_votes enable row level security;

drop policy if exists "Post debate votes are viewable by everyone" on public.post_debate_votes;
create policy "Post debate votes are viewable by everyone"
  on public.post_debate_votes for select using (true);

-- You may vote as yourself, on a post that (a) exists, (b) is
-- actually a debate, and (c) you are allowed to see. The author CAN
-- vote on their own — unlike Aux Wars, where a player sits out their
-- own game, here the author is the person ASKING, not a side.
drop policy if exists "Users vote on debate posts as themselves" on public.post_debate_votes;
create policy "Users vote on debate posts as themselves"
  on public.post_debate_votes for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.posts p
       where p.id = post_id
         and p.side_a_label is not null
         and (p.is_published or p.user_id = auth.uid())
    )
  );

drop policy if exists "Users can change their debate post vote" on public.post_debate_votes;
create policy "Users can change their debate post vote"
  on public.post_debate_votes for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "Users can take back their debate post vote" on public.post_debate_votes;
create policy "Users can take back their debate post vote"
  on public.post_debate_votes for delete
  using (user_id = auth.uid());

-- ---------- 3. the tallies, kept on the post row ----------

create or replace function public.post_debate_votes_recount()
returns trigger
language plpgsql
security definer set search_path = public
as $fn$
declare
  v_post uuid := coalesce(new.post_id, old.post_id);
begin
  update public.posts
     set debate_votes_a = (select count(*) from public.post_debate_votes
                            where post_id = v_post and side = 'a'),
         debate_votes_b = (select count(*) from public.post_debate_votes
                            where post_id = v_post and side = 'b')
   where id = v_post;
  return null;
end;
$fn$;

drop trigger if exists trg_post_debate_votes_count on public.post_debate_votes;
create trigger trg_post_debate_votes_count
  after insert or update or delete on public.post_debate_votes
  for each row execute function public.post_debate_votes_recount();

-- Backfill, so re-running this is always consistent.
update public.posts p
   set debate_votes_a = (select count(*) from public.post_debate_votes v
                          where v.post_id = p.id and v.side = 'a'),
       debate_votes_b = (select count(*) from public.post_debate_votes v
                          where v.post_id = p.id and v.side = 'b')
 where p.side_a_label is not null;

notify pgrst, 'reload schema';
