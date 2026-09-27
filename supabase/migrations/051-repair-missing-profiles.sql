-- ============================================================
-- Migration 051 — repair logins that have no profile (2026-09-27).
-- Run in the Supabase SQL Editor after 050.
--
-- Luca found "ana lottielee" in Authentication → Users, but she
-- has no row in public.profiles, so the site can't show her and
-- anything that needs her profile fails when she signs in.
--
-- handle_new_user runs AFTER INSERT on auth.users, and an error
-- there cancels the whole signup — so a login without a profile
-- shouldn't be possible through the normal door. Step 1 prints
-- what we need to work out how it happened; step 2 fixes it.
--
-- Safe to re-run: it only touches logins with no profile.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Who's missing a profile, and how did they sign up?
--    (Look at this result BEFORE step 2 wipes the evidence.)
-- ------------------------------------------------------------
select
  u.email,
  u.created_at,
  u.email_confirmed_at,
  u.last_sign_in_at,
  u.raw_app_meta_data ->> 'provider' as provider,
  u.raw_user_meta_data ->> 'full_name' as full_name,
  u.raw_user_meta_data ->> 'name'      as name,
  u.raw_user_meta_data ->> 'username'  as picked_username
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id)
order by u.created_at;

-- ------------------------------------------------------------
-- 2. Give each of them a profile, built the same way 050's
--    signup trigger would. username_auto = true, so /welcome
--    asks them to confirm or pick a handle next time they log in.
-- ------------------------------------------------------------
do $$
declare
  u record;
  _name text;
  h text;
begin
  for u in
    select * from auth.users au
    where not exists (select 1 from public.profiles p where p.id = au.id)
    order by au.created_at
  loop
    _name := coalesce(
      u.raw_user_meta_data ->> 'full_name',
      u.raw_user_meta_data ->> 'name',
      '');

    h := lower(coalesce(u.raw_user_meta_data ->> 'username', ''));
    if h !~ '^[a-z0-9_]{3,20}$' then
      h := public.handle_from_name(_name);
    end if;
    if char_length(h) < 3 then
      h := left(regexp_replace(lower(split_part(coalesce(u.email, ''), '@', 1)), '[^a-z0-9_]', '', 'g'), 20);
    end if;
    if char_length(h) < 3
       or h in ('admin','peak','mod','moderator','staff','support',
                'api','root','system','official','help') then
      h := 'user_' || substr(replace(u.id::text, '-', ''), 1, 8);
    end if;

    while exists (select 1 from public.profiles where lower(username) = h) loop
      h := left(h, 15) || '_' || substr(md5(random()::text), 1, 4);
    end loop;

    insert into public.profiles (id, username, display_name, avatar_url, username_auto)
    values (
      u.id,
      h,
      coalesce(nullif(_name, ''), h),
      coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture'),
      true
    );
    raise notice '% -> %', u.email, h;
  end loop;
end;
$$;

-- Check: should come back empty.
select u.email
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);
