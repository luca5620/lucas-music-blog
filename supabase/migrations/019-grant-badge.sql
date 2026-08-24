-- ============================================================
-- Migration 019 — grant_badge dev tool (2026-08-24)
-- Run in the Supabase SQL Editor after 018.
--
-- Luca's badge tool (/admin/badges): set any user's verification
-- badge (the profiles.role column) by username. OWNER-only caller
-- gate, and the gold Founder badge can never be granted or taken —
-- it stays exclusive to Luca.
--
-- security definer because RLS deliberately locks the role column
-- (add-role-column.sql): no session can change roles through a
-- plain UPDATE, admins included. This function is the one
-- sanctioned path, and it re-checks everything itself.
-- ============================================================

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

revoke all on function public.grant_badge(text, text) from public, anon;
grant execute on function public.grant_badge(text, text) to authenticated;
