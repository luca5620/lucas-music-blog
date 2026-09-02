-- ============================================================
-- Migration 038 — staff can delete their OWN content without the
-- email code (2026-09-02). Run in the Supabase SQL Editor after 037.
--
-- THE BUG (Luca: "still cant delete my list … it just takes me to
-- the lists page and it is still there"): migration 021 put a
-- RESTRICTIVE delete policy on every user-content table —
--   using ( staff_action_allowed() )
-- and staff_action_allowed() is "not staff, OR this session was
-- email-coded". Restrictive policies must pass for EVERY delete,
-- including your own rows. Luca's role is `owner`, and his phone
-- session (Google sign-in) was never email-coded, so all of HIS
-- deletes — lists, reviews, posts, comments — deleted ZERO rows.
-- Postgres raises no error for that, Supabase reports none, the API
-- said "success", and the row stayed. 021's comment assumed staff
-- sessions "are email-coded anyway"; Google/mobile sessions aren't.
-- Regular users were never affected, which is why it looked random.
--
-- THE FIX keeps 021's intent exactly — the code is still demanded
-- whenever a staff session deletes SOMEONE ELSE's row (moderation)
-- — and simply exempts your own rows: deleting your own content is
-- not a staff action. Six policies, same names as 021, so re-running
-- this is safe.
-- ============================================================

drop policy if exists "Staff deletes need email code (reviews)" on public.reviews;
create policy "Staff deletes need email code (reviews)"
  on public.reviews as restrictive for delete
  using ( user_id = auth.uid() or public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (comments)" on public.comments;
create policy "Staff deletes need email code (comments)"
  on public.comments as restrictive for delete
  using ( user_id = auth.uid() or public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (debate_messages)" on public.debate_messages;
create policy "Staff deletes need email code (debate_messages)"
  on public.debate_messages as restrictive for delete
  using ( user_id = auth.uid() or public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (room_messages)" on public.room_messages;
create policy "Staff deletes need email code (room_messages)"
  on public.room_messages as restrictive for delete
  using ( user_id = auth.uid() or public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (lists)" on public.lists;
create policy "Staff deletes need email code (lists)"
  on public.lists as restrictive for delete
  using ( user_id = auth.uid() or public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (posts)" on public.posts;
create policy "Staff deletes need email code (posts)"
  on public.posts as restrictive for delete
  using ( user_id = auth.uid() or public.staff_action_allowed() );
