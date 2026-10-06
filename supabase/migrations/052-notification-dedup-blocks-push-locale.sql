-- ============================================================
-- Migration 052 — notifications that dedupe for real, blocks that
-- actually block, and a language for every push token (2026-10-05)
-- Run in the Supabase SQL Editor after 051. Safe to re-run.
--
-- THREE FIXES FROM ONE CODE REVIEW
--
-- 1. DEDUP NEVER WORKED. createNotification / notifyFollowers asked
--    "have I already told them?" with a SELECT run as the ACTOR — but
--    the only select policy on notifications (025) is "recipients read
--    their own". The actor can never see the row it wrote, so the
--    check always came back empty: every like → unlike → like loop and
--    every unpublish → republish rang the bell AND buzzed the phone
--    again (each row fires the 032 push trigger).
--
--    The fix moves the rule into the database, where RLS can't hide
--    anything from it:
--      * a partial UNIQUE index — one row per (recipient, actor, type,
--        href) for the "once per thing, ever" types;
--      * two SECURITY DEFINER functions, notify_user() and
--        notify_followers(), that insert with ON CONFLICT DO NOTHING.
--        A repeat is silently skipped instead of erroring.
--    The push trigger (032) is AFTER INSERT ... FOR EACH ROW, and
--    Postgres only fires row triggers for rows that were ACTUALLY
--    inserted — a row skipped by ON CONFLICT DO NOTHING never fires
--    it. So "no duplicate row" automatically means "no duplicate push";
--    the trigger needs no change.
--
-- 2. BLOCKING DIDN'T BLOCK. A blocked user could still follow, like,
--    comment on and reply to the person who blocked them, and every one
--    of those rang the blocker's bell + phone. Now:
--      * is_blocked_by(target) — "has THIS person blocked ME?" — lets
--        the API refuse those actions. It has to be SECURITY DEFINER:
--        under RLS (007) you can only read your OWN block list, so the
--        actor could never see the target's block row by itself. It
--        only ever answers about the CALLER (auth.uid()), so it can't
--        be used to read anyone else's block list.
--      * RESTRICTIVE insert policies on follows / likes / comments use
--        it, so the rule holds even for someone who skips the website
--        and talks to Supabase directly (RLS is the real boundary).
--      * notify_user() / notify_followers() never create a notification
--        between a blocked pair, in either direction.
--
-- 3. PUSH COPY WAS ENGLISH-ONLY. push_tokens gains a `locale` column
--    (one of the six site languages). /api/push/register fills it from
--    the language cookie on every app launch, and the language picker
--    updates it on a switch; push-fanout + push-recap pick their copy
--    by it.
--
-- ⚠️ AFTER RUNNING THIS, redeploy the edge function by hand — it does
-- NOT ship with Vercel:
--     supabase functions deploy push-fanout --no-verify-jwt
-- (The old function keeps working against this schema in the
-- meantime; it just keeps sending English.)
-- ============================================================


-- ------------------------------------------------------------
-- 1a. Clear out the duplicates the broken check let through.
--
-- For every (recipient, actor, type, href) group of a deduped type,
-- keep the OLDEST row ("first one wins, forever" — the rule the app
-- always meant) and delete the rest. Has to happen before the unique
-- index below, which would refuse to build over duplicates.
-- ------------------------------------------------------------
delete from public.notifications n
using public.notifications keep
where n.type in (
        'follow', 'review_like', 'post_like', 'list_like',
        'new_review', 'new_post', 'new_list', 'new_debate', 'new_aux'
      )
  and keep.type     = n.type
  and keep.user_id  = n.user_id
  and keep.actor_id = n.actor_id
  and keep.href     = n.href
  -- Row comparison: "keep is strictly older" (id breaks exact ties),
  -- so exactly one row per group — the oldest — survives.
  and (keep.created_at, keep.id) < (n.created_at, n.id);


-- ------------------------------------------------------------
-- 1b. The rule itself: one notification per (recipient, actor, type,
-- href) for these types.
--
-- WHICH TYPES, and why:
--   follow, review_like, post_like, list_like — toggles. Unfollow /
--     unlike + redo must not ring again.
--   new_review, new_post, new_list, new_debate, new_aux — the
--     follower fan-out. Unpublish → republish (or editing a draft that
--     publishes) must not re-ping every follower. Each new thing has
--     its own href, so a genuinely NEW review still notifies.
-- NOT deduped, on purpose:
--   comment, comment_reply — every comment is a new event, but they
--     share the review's href, so a unique index would swallow the
--     second comment on the same review.
--   aux_invite — a host can run several games in the same room
--     (same href) and re-inviting a friend to the next one is
--     legitimate. It's already gated by mutual follow + a 30/hour
--     rate limit, and the invitee can unfollow or block.
-- ------------------------------------------------------------
create unique index if not exists uq_notifications_once_per_thing
  on public.notifications (user_id, actor_id, type, href)
  where type in (
    'follow', 'review_like', 'post_like', 'list_like',
    'new_review', 'new_post', 'new_list', 'new_debate', 'new_aux'
  );


-- ------------------------------------------------------------
-- 2a. Block helpers.
-- ------------------------------------------------------------

-- "Has p_target blocked ME (the signed-in caller)?"
-- STABLE: same answer for the whole statement, so Postgres can call it
-- once per row in a policy without re-planning. Returns false for a
-- signed-out caller or a null target (nothing to refuse).
create or replace function public.is_blocked_by(p_target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.user_blocks b
     where b.blocker_id = p_target
       and b.blocked_id = auth.uid()
  );
$fn$;

revoke all on function public.is_blocked_by(uuid) from public, anon;
grant execute on function public.is_blocked_by(uuid) to authenticated;

-- "Is there a block between these two, either way round?"
-- INTERNAL ONLY — it takes two arbitrary ids, so letting a signed-in
-- user call it would let them probe other people's block lists. Only
-- the security-definer functions below (which run as the owner) use it.
create or replace function public.blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select exists (
    select 1
      from public.user_blocks b
     where (b.blocker_id = p_a and b.blocked_id = p_b)
        or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$fn$;

revoke all on function public.blocked_between(uuid, uuid) from public, anon, authenticated;


-- ------------------------------------------------------------
-- 2b. Restrictive insert policies — the DB-level backstop for the API
-- checks. A RESTRICTIVE policy is ANDed with the existing permissive
-- ones ("you may like as yourself" AND "…not if they blocked you"),
-- so nothing that worked before changes for anyone who isn't blocked.
--
-- Deletes are deliberately untouched: a blocked user can still unlike
-- or unfollow, which only ever moves things in the direction the
-- blocker wants.
--
-- The owner lookups (`select r.user_id from reviews r …`) run under
-- the caller's own RLS; if the thing isn't visible to them, the lookup
-- is null, is_blocked_by(null) is false, and the normal policies
-- decide as before.
-- ------------------------------------------------------------

-- Follows: you can't follow someone who blocked you.
drop policy if exists "Blocked users cannot follow their blocker" on public.follows;
create policy "Blocked users cannot follow their blocker"
  on public.follows
  as restrictive
  for insert
  to authenticated
  with check (not public.is_blocked_by(following_id));

-- Review likes.
drop policy if exists "Blocked users cannot like their blocker's reviews" on public.review_likes;
create policy "Blocked users cannot like their blocker's reviews"
  on public.review_likes
  as restrictive
  for insert
  to authenticated
  with check (
    not public.is_blocked_by(
      (select r.user_id from public.reviews r where r.id = review_id)
    )
  );

-- Post likes.
drop policy if exists "Blocked users cannot like their blocker's posts" on public.post_likes;
create policy "Blocked users cannot like their blocker's posts"
  on public.post_likes
  as restrictive
  for insert
  to authenticated
  with check (
    not public.is_blocked_by(
      (select p.user_id from public.posts p where p.id = post_id)
    )
  );

-- List likes.
drop policy if exists "Blocked users cannot like their blocker's lists" on public.list_likes;
create policy "Blocked users cannot like their blocker's lists"
  on public.list_likes
  as restrictive
  for insert
  to authenticated
  with check (
    not public.is_blocked_by(
      (select l.user_id from public.lists l where l.id = list_id)
    )
  );

-- Comments: not on a blocker's review, and no replying to a blocker's
-- comment (even when it sits on someone else's review).
drop policy if exists "Blocked users cannot comment on or reply to their blocker" on public.comments;
create policy "Blocked users cannot comment on or reply to their blocker"
  on public.comments
  as restrictive
  for insert
  to authenticated
  with check (
    not public.is_blocked_by(
      (select r.user_id from public.reviews r where r.id = review_id)
    )
    and (
      parent_id is null
      or not public.is_blocked_by(
        (select c.user_id from public.comments c where c.id = parent_id)
      )
    )
  );


-- ------------------------------------------------------------
-- 1c + 2c. The conflict-safe, block-aware ways to create notifications.
--
-- Both are SECURITY DEFINER so they can (a) see the unique index's
-- conflicts and (b) check blocks in both directions — neither of which
-- the caller's own RLS allows. They keep exactly the guarantees the
-- 025 insert policy gave: the actor is ALWAYS the signed-in caller
-- (never a parameter), and nobody can notify themselves.
--
-- The 025 "Actors create notifications as themselves" policy is left
-- in place, so the code that was live before this deploy keeps
-- working. Once the new code is out, nothing in the app inserts
-- directly any more; a later migration may drop that policy so these
-- functions become the only door.
-- ------------------------------------------------------------

-- One notification to one person ("X liked your review").
-- Returns true when a row was actually inserted (→ a push went out),
-- false when it was skipped (self, blocked pair, or already told).
create or replace function public.notify_user(
  p_recipient uuid,
  p_type      text,
  p_href      text,
  p_title     text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_inserted integer;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  -- The reactive types only. The follow-feed types go through
  -- notify_followers, which decides the recipients itself — this
  -- function must not become a way to send "X posted a review" to
  -- arbitrary strangers.
  if p_type not in (
    'follow', 'review_like', 'comment', 'comment_reply',
    'post_like', 'list_like', 'aux_invite'
  ) then
    raise exception 'BAD_TYPE';
  end if;
  if p_recipient is null or p_recipient = v_actor then
    return false;
  end if;
  -- No notifications between a blocked pair, either direction.
  if public.blocked_between(v_actor, p_recipient) then
    return false;
  end if;

  insert into public.notifications (user_id, actor_id, type, href, title)
  values (p_recipient, v_actor, p_type, left(p_href, 300), left(p_title, 200))
  -- No conflict target needed: this skips a clash with ANY unique
  -- index, which here means uq_notifications_once_per_thing.
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted > 0;
end;
$fn$;

revoke all on function public.notify_user(uuid, text, text, text) from public, anon;
grant execute on function public.notify_user(uuid, text, text, text) to authenticated;

-- "Someone you follow made a thing" — one row per follower, in ONE
-- statement however many followers there are. Returns how many rows
-- were inserted (= how many pushes the trigger fires).
create or replace function public.notify_followers(
  p_type  text,
  p_href  text,
  p_title text default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_actor    uuid := auth.uid();
  v_inserted integer;
begin
  if v_actor is null then
    raise exception 'AUTH_REQUIRED';
  end if;
  if p_type not in ('new_review', 'new_post', 'new_list', 'new_debate', 'new_aux') then
    raise exception 'BAD_TYPE';
  end if;

  insert into public.notifications (user_id, actor_id, type, href, title)
  select f.follower_id, v_actor, p_type, left(p_href, 300), left(p_title, 200)
    from public.follows f
   where f.following_id = v_actor
     and f.follower_id <> v_actor
     -- A blocked follower doesn't hear about the blocker's new things,
     -- and a follower who blocked the actor doesn't either.
     and not public.blocked_between(v_actor, f.follower_id)
  -- Re-publish: everyone already told is skipped by the unique index.
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$fn$;

revoke all on function public.notify_followers(text, text, text) from public, anon;
grant execute on function public.notify_followers(text, text, text) to authenticated;


-- ------------------------------------------------------------
-- 3. A language per push token.
--
-- Defaults to English so every existing row (and anything the old
-- register route writes before the new code deploys) is valid. The
-- six codes match i18n/config.ts LOCALES — keep them in step if a
-- language is ever added.
-- ------------------------------------------------------------
alter table public.push_tokens
  add column if not exists locale text not null default 'en';

alter table public.push_tokens
  drop constraint if exists push_tokens_locale_check;
alter table public.push_tokens
  add constraint push_tokens_locale_check
  check (locale in ('en', 'es', 'fr', 'pt', 'nl', 'de'));


-- ------------------------------------------------------------
-- Verify:
--   -- no duplicates left (should return 0 rows):
--   select user_id, actor_id, type, href, count(*)
--     from public.notifications
--    where type in ('follow','review_like','post_like','list_like',
--                   'new_review','new_post','new_list','new_debate','new_aux')
--    group by 1,2,3,4 having count(*) > 1;
--   -- the index + functions exist:
--   select indexname from pg_indexes where indexname = 'uq_notifications_once_per_thing';
--   select proname from pg_proc where proname in
--     ('notify_user','notify_followers','is_blocked_by','blocked_between');
--   -- the column exists:
--   select locale, count(*) from public.push_tokens group by 1;
-- ------------------------------------------------------------
