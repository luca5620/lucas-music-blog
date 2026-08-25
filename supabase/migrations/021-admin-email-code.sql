-- ============================================================
-- Migration 021 — Admin email-code enforcement (2026-08-25)
-- Run in the Supabase SQL Editor AFTER 020, and ONLY AFTER the
-- matching site deploy is live (the login page has to know how to
-- send the code first, or you lock yourself out of admin tools
-- until you sign in through the new flow).
--
-- The rule (Luca 2026-08-25): a password alone must never be
-- enough to use admin powers. Staff logins now go password →
-- emailed 6-digit code, and every session's access token records
-- HOW it was created in its `amr` claim ("password", "otp",
-- "magiclink", "recovery"). The Next.js middleware and the
-- /api/admin routes already check that claim — but the anon key
-- is public, so a stolen admin password could talk to Supabase
-- DIRECTLY and skip our server entirely. This migration closes
-- that: Postgres itself refuses admin-privileged writes from
-- sessions that never proved the inbox.
--
-- HOW: RESTRICTIVE policies. Normal (permissive) policies are
-- OR'd together; a RESTRICTIVE policy is AND'ed on top. Ours says
-- "either you're not staff (then the permissive policies decide,
-- exactly as before), or your session went through an email
-- code." Nothing changes for regular users; admins without the
-- code are cut off. Being additive, it never loosens anything.
--
-- ALSO REQUIRED (dashboard, by hand): Auth → Email Templates →
-- "Magic Link" must include {{ .Token }} (e.g. "Your sign-in
-- code: {{ .Token }}") so the email carries the 6-digit code and
-- not just a link. The link keeps working too ("magiclink"
-- counts), but the code is the flow the login page asks for.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Did this session prove the inbox?
--    otp       = entered the emailed 6-digit code
--    magiclink = clicked the emailed sign-in link
--    recovery  = came through password reset (also inbox-proven)
--    jsonb @> checks "does amr contain an entry with this method";
--    a missing/odd claim makes the whole thing null → false.
-- ------------------------------------------------------------
create or replace function public.session_used_email_code()
returns boolean
language sql
stable
as $$
  select coalesce(
       (auth.jwt() -> 'amr') @> '[{"method":"otp"}]'
    or (auth.jwt() -> 'amr') @> '[{"method":"magiclink"}]'
    or (auth.jwt() -> 'amr') @> '[{"method":"recovery"}]',
    false
  )
$$;

-- ------------------------------------------------------------
-- 2. The AND'ed condition for restrictive policies:
--    non-staff pass through untouched; staff need the code.
-- ------------------------------------------------------------
create or replace function public.staff_action_allowed()
returns boolean
language sql
stable
set search_path = public
as $$
  select
    coalesce(
      (select role from public.profiles where id = auth.uid()),
      'user'
    ) not in ('owner', 'admin')
    or public.session_used_email_code()
$$;

-- ------------------------------------------------------------
-- 3. Catalog tables — only staff can write these at all (002),
--    so every write now also needs the email code.
-- ------------------------------------------------------------
drop policy if exists "Staff writes need email code (artists insert)" on public.artists;
create policy "Staff writes need email code (artists insert)"
  on public.artists as restrictive for insert
  with check ( public.staff_action_allowed() );

drop policy if exists "Staff writes need email code (artists update)" on public.artists;
create policy "Staff writes need email code (artists update)"
  on public.artists as restrictive for update
  using ( public.staff_action_allowed() );

drop policy if exists "Staff writes need email code (artists delete)" on public.artists;
create policy "Staff writes need email code (artists delete)"
  on public.artists as restrictive for delete
  using ( public.staff_action_allowed() );

drop policy if exists "Staff writes need email code (releases insert)" on public.releases;
create policy "Staff writes need email code (releases insert)"
  on public.releases as restrictive for insert
  with check ( public.staff_action_allowed() );

drop policy if exists "Staff writes need email code (releases update)" on public.releases;
create policy "Staff writes need email code (releases update)"
  on public.releases as restrictive for update
  using ( public.staff_action_allowed() );

drop policy if exists "Staff writes need email code (releases delete)" on public.releases;
create policy "Staff writes need email code (releases delete)"
  on public.releases as restrictive for delete
  using ( public.staff_action_allowed() );

drop policy if exists "Staff writes need email code (release_artists insert)" on public.release_artists;
create policy "Staff writes need email code (release_artists insert)"
  on public.release_artists as restrictive for insert
  with check ( public.staff_action_allowed() );

drop policy if exists "Staff writes need email code (release_artists update)" on public.release_artists;
create policy "Staff writes need email code (release_artists update)"
  on public.release_artists as restrictive for update
  using ( public.staff_action_allowed() );

drop policy if exists "Staff writes need email code (release_artists delete)" on public.release_artists;
create policy "Staff writes need email code (release_artists delete)"
  on public.release_artists as restrictive for delete
  using ( public.staff_action_allowed() );

-- ------------------------------------------------------------
-- 4. The report queue — resolving/dismissing is staff-only (007).
-- ------------------------------------------------------------
drop policy if exists "Staff writes need email code (reports update)" on public.content_reports;
create policy "Staff writes need email code (reports update)"
  on public.content_reports as restrictive for update
  using ( public.staff_action_allowed() );

-- ------------------------------------------------------------
-- 5. Moderation deletes (007 + 013 + 003). The restrictive
--    condition still lets authors delete their OWN rows (they're
--    not staff, so they pass) — it only demands the code when a
--    staff session does the deleting. Note that includes staff
--    deleting their own content: their sessions are email-coded
--    anyway once the new login flow is live.
-- ------------------------------------------------------------
drop policy if exists "Staff deletes need email code (reviews)" on public.reviews;
create policy "Staff deletes need email code (reviews)"
  on public.reviews as restrictive for delete
  using ( public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (comments)" on public.comments;
create policy "Staff deletes need email code (comments)"
  on public.comments as restrictive for delete
  using ( public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (debate_messages)" on public.debate_messages;
create policy "Staff deletes need email code (debate_messages)"
  on public.debate_messages as restrictive for delete
  using ( public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (room_messages)" on public.room_messages;
create policy "Staff deletes need email code (room_messages)"
  on public.room_messages as restrictive for delete
  using ( public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (lists)" on public.lists;
create policy "Staff deletes need email code (lists)"
  on public.lists as restrictive for delete
  using ( public.staff_action_allowed() );

drop policy if exists "Staff deletes need email code (posts)" on public.posts;
create policy "Staff deletes need email code (posts)"
  on public.posts as restrictive for delete
  using ( public.staff_action_allowed() );

-- ------------------------------------------------------------
-- 6. grant_badge (019) is security definer — RLS doesn't apply
--    inside it, so it checks the rule itself. Same function as
--    019 plus the email-code check after the owner gate.
-- ------------------------------------------------------------
create or replace function public.grant_badge(target_username text, new_role text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_role text;
  target_id   uuid;
  target_role text;
begin
  select role into caller_role from public.profiles where id = auth.uid();
  if caller_role is distinct from 'owner' then
    raise exception 'Only the founder can grant badges';
  end if;

  -- 021: the founder's session must be email-coded too.
  if not public.session_used_email_code() then
    raise exception 'Sign in with your email code to use admin tools';
  end if;

  if new_role not in ('user', 'reviewer', 'admin', 'tester') then
    raise exception 'Badge "%" cannot be granted — the gold Founder badge stays exclusive', new_role;
  end if;

  select id, role into target_id, target_role
    from public.profiles
   where lower(username) = lower(trim(target_username));

  if target_id is null then
    raise exception 'No user named "%"', target_username;
  end if;

  if target_role = 'owner' then
    raise exception 'The founder''s badge cannot be changed';
  end if;

  update public.profiles set role = new_role where id = target_id;
  return new_role;
end;
$$;
