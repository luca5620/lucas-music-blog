-- ============================================================
-- Migration 031 — Google / Apple sign-in (Luca 2026-08-31).
-- Run in the Supabase SQL Editor after 030.
--
-- Social sign-in hands us an account with NO username: Google
-- sends a name and an email, Apple usually sends nothing but a
-- private relay address. handle_new_user already invents a
-- handle from the email local-part so nothing breaks — but an
-- invented handle isn't a CHOSEN one, and on this site the
-- username IS your identity (it's in every review URL).
--
-- So this migration adds one flag, profiles.username_auto:
-- "this handle was generated, not picked". /auth/callback sends
-- anyone carrying it to /welcome to claim a real one, and the
-- name-change trigger lets that FIRST claim through free — you
-- shouldn't spend your one change per fortnight (028) on the
-- name we made up for you.
--
-- Existing accounts default to false, so nobody who picked their
-- own name is ever sent to /welcome.
-- ============================================================

alter table public.profiles
  add column if not exists username_auto boolean not null default false;

-- ------------------------------------------------------------
-- 1. Signup trigger — same as 006 plus two things:
--    * raise username_auto when we had to invent the handle
--    * read Google's `picture` / `name` claims, not just the
--      Supabase-normalized ones (they differ by provider)
-- ------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  _username text;
  _picked   boolean := true;
begin
  -- Prefer the username picked at signup; fall back to email local-part.
  _username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if _username !~ '^[a-z0-9_]{3,20}$' then
    _username := lower(split_part(coalesce(new.email, ''), '@', 1));
    _picked := false;
  end if;

  -- Normalize to the allowed charset and length (underscores only now).
  _username := regexp_replace(_username, '[^a-z0-9_]', '', 'g');
  _username := left(_username, 20);
  if char_length(_username) < 3 then
    _username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
    _picked := false;
  end if;

  -- Case-insensitive collision loop (unique index is on lower(username)).
  while exists (
    select 1 from public.profiles where lower(username) = _username
  ) loop
    _username := left(_username, 14) || '_' || substr(md5(random()::text), 1, 4);
    -- A suffixed handle isn't the one they asked for either.
    _picked := false;
  end loop;

  insert into public.profiles (id, username, display_name, avatar_url, username_auto)
  values (
    new.id,
    _username,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      _username
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture',
      null
    ),
    not _picked
  );

  return new;
end;
$$;

-- ------------------------------------------------------------
-- 2. Name-change limits (028) — the generated handle gets one
--    free rename, and username_auto is trigger-owned so a
--    hand-written request can't re-arm it for a free change.
-- ------------------------------------------------------------
create or replace function public.enforce_name_change_limits()
returns trigger
language plpgsql
as $$
begin
  -- ---------- username: once per 14 days ----------
  if new.username is distinct from old.username then
    -- Same impersonation blocklist as signup (belt and braces —
    -- signup checks it client-side, this makes it real).
    if lower(new.username) in (
      'admin','peak','mod','moderator','staff','support',
      'api','root','system','official','help'
    ) then
      raise exception 'USERNAME_RESERVED';
    end if;

    if coalesce(old.username_auto, false) then
      -- Claiming a real handle over the one we generated. Free, and
      -- the cooldown clock stays where it was (usually unset), so
      -- their first REAL change is still available.
      new.username_changed_at := old.username_changed_at;
    else
      if old.username_changed_at is not null
         and now() - old.username_changed_at < interval '14 days' then
        -- The date lands in the error message so the client can show
        -- "you can change it again on <date>".
        raise exception 'USERNAME_COOLDOWN until %',
          to_char(old.username_changed_at + interval '14 days', 'YYYY-MM-DD');
      end if;

      new.username_changed_at := now();
    end if;

    -- Whatever it was before, the handle is now chosen.
    new.username_auto := false;
  else
    -- Not changing the name = not allowed to touch its clock.
    new.username_changed_at := old.username_changed_at;
    -- Keeping the generated handle on purpose (submitting /welcome
    -- unchanged) is allowed: true -> false. Never the reverse.
    if coalesce(new.username_auto, false) and not coalesce(old.username_auto, false) then
      new.username_auto := old.username_auto;
    end if;
  end if;

  -- ---------- display name: twice per UTC day ----------
  if new.display_name is distinct from old.display_name then
    if old.display_name_changed_at is not null
       and (old.display_name_changed_at at time zone 'UTC')::date
           = (now() at time zone 'UTC')::date
       and old.display_name_change_count >= 2 then
      raise exception 'DISPLAY_NAME_DAILY_LIMIT';
    end if;

    new.display_name_change_count :=
      case
        when old.display_name_changed_at is not null
             and (old.display_name_changed_at at time zone 'UTC')::date
                 = (now() at time zone 'UTC')::date
          then old.display_name_change_count + 1
        else 1
      end;
    new.display_name_changed_at := now();
  else
    new.display_name_changed_at := old.display_name_changed_at;
    new.display_name_change_count := old.display_name_change_count;
  end if;

  return new;
end;
$$;

drop trigger if exists name_change_limits on public.profiles;
create trigger name_change_limits
  before update on public.profiles
  for each row
  execute function public.enforce_name_change_limits();
