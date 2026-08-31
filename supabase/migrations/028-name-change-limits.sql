-- ============================================================
-- Migration 028 — username & display-name change limits
-- (Luca 2026-08-31). Run in the Supabase SQL Editor after 027.
--
-- Usernames stop being permanent: like Instagram, you can change
-- yours ONCE EVERY 14 DAYS. Display names can change TWICE PER
-- (UTC) DAY. The rules live HERE, in a trigger, because profile
-- saves go straight from the browser client to the profiles row
-- under RLS — any limit the settings page checked client-side
-- could be bypassed with one hand-written request. The trigger is
-- the boundary; the UI just mirrors it with friendly copy.
--
-- Three tracking columns, all trigger-owned: the trigger OVERWRITES
-- whatever the client sends for them (otherwise "set
-- username_changed_at = null" would reset your own cooldown).
-- ============================================================

alter table public.profiles
  add column if not exists username_changed_at timestamptz,
  add column if not exists display_name_changed_at timestamptz,
  add column if not exists display_name_change_count int not null default 0;

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

    if old.username_changed_at is not null
       and now() - old.username_changed_at < interval '14 days' then
      -- The date lands in the error message so the client can show
      -- "you can change it again on <date>".
      raise exception 'USERNAME_COOLDOWN until %',
        to_char(old.username_changed_at + interval '14 days', 'YYYY-MM-DD');
    end if;

    new.username_changed_at := now();
  else
    -- Not changing the name = not allowed to touch its clock.
    new.username_changed_at := old.username_changed_at;
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
