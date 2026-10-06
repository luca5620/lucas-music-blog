-- ============================================================
-- 057 — Two small tidy-ups left over from the 2026-10-05 review
--
-- Run BY HAND in the Supabase SQL editor. Safe to re-run (every
-- policy is dropped first). Needs 052 and 053 already run (they were,
-- 2026-10-05).
-- ============================================================


-- ── 1. Notifications: close the old back door ────────────────
-- 025 let any signed-in person INSERT a notification row directly, as
-- long as they named themselves as the actor. Since 052 every
-- notification goes through notify_user() / notify_followers() —
-- security definer functions that dedupe, respect blocks, and take the
-- actor from the session. With the direct-insert policy still there,
-- a script could skip all of that (spam someone's bell and phone, or
-- notify a person who blocked them). Dropping it leaves the two
-- functions as the only way in. The app stopped using direct inserts
-- the same day (lib/db/notifications.ts no longer has a fallback).
--
-- Reading, marking read and deleting your OWN notifications are
-- separate policies and are untouched.
drop policy if exists "Actors create notifications as themselves" on public.notifications;


-- ── 2. Aux Wars reactions: the game must belong to the room ──
-- A reaction row names both a room (room_id) and a game (game_id).
-- The insert/update policies checked you can SEE the room and that the
-- game is in its listening phase — but never that the game is IN that
-- room. So a crafted request could name a room you can see and a game
-- from a room you can't (a hidden room, or one you're banned from),
-- and the 🔥/💩 would land on that game's tally. 053 closed exactly
-- this hole for VOTES; this does the same for reactions, and adds the
-- banned check the "change your reaction" policy was missing.
--
-- Note the table-qualified aux_reactions.room_id inside the
-- subqueries: aux_games has its own room_id column, so an unqualified
-- "room_id" there would mean g.room_id and the check would compare a
-- column with itself (always true).
drop policy if exists "Aux reactions: throw your own" on public.aux_reactions;
create policy "Aux reactions: throw your own"
  on public.aux_reactions for insert
  with check (
    user_id = auth.uid()
    and public.aux_can_view(room_id)
    and not public.aux_is_banned(room_id)
    and exists (
      select 1 from public.aux_games g
       where g.id = aux_reactions.game_id
         and g.room_id = aux_reactions.room_id
         and g.phase = 'listening'
    )
  );

drop policy if exists "Aux reactions: change your own" on public.aux_reactions;
create policy "Aux reactions: change your own"
  on public.aux_reactions for update
  using (user_id = auth.uid() and public.aux_can_view(room_id))
  with check (
    user_id = auth.uid()
    and public.aux_can_view(room_id)
    and not public.aux_is_banned(room_id)
    and exists (
      select 1 from public.aux_games g
       where g.id = aux_reactions.game_id
         and g.room_id = aux_reactions.room_id
         and g.phase = 'listening'
    )
  );


-- ── Verify (optional) ────────────────────────────────────────
-- Should list only the read/update/delete policies — no INSERT:
--   select policyname, cmd from pg_policies where tablename = 'notifications';
-- Both reaction policies should mention game_id AND room_id:
--   select policyname, cmd, with_check from pg_policies where tablename = 'aux_reactions';
