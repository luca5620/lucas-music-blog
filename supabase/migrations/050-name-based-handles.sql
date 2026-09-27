-- ============================================================
-- Migration 050 — handles from real names (Luca 2026-09-26).
-- Run in the Supabase SQL Editor after 049.
--
-- Luca: people who sign in with Google/Apple and skip the
-- username step end up with handles that aren't theirs — "it's
-- not their fault, the system got messed up".
--
-- What actually happened: handle_new_user (031) invents a handle
-- from the EMAIL local-part when none was picked. For Apple's
-- private relay that's random junk (jfp225w4kb), for Gmail it's
-- often shanemtyrrell123. Their real name only lived in
-- display_name ("Martijn Schilders"), which has spaces — so the
-- profile looked like a name with no matching handle.
--
-- Fix, two parts:
--   1. New signups: the invented handle comes from the NAME the
--      provider sends, spaces -> underscores (martijn_schilders).
--      Email local-part is now only the fallback, then user_xxxx.
--   2. Backfill: everyone still carrying an invented handle
--      (username_auto) gets one built from their display name.
--      The name-change trigger (031) treats this as their free
--      claim, so their one real change stays available in
--      Settings; it also clears username_auto, so /welcome stops
--      asking. Review/post slugs are frozen at creation, so old
--      review links keep working; only /profile/<handle> moves.
-- ============================================================

-- ------------------------------------------------------------
-- 0. Name -> handle. Lowercase, common accents folded, spaces /
--    dots / hyphens -> "_", everything else dropped, runs of "_"
--    collapsed, 20 chars max, no leading/trailing "_".
-- ------------------------------------------------------------
create or replace function public.handle_from_name(_name text)
returns text
language sql
immutable
set search_path = ''
as $$
  select trim(both '_' from left(
    trim(both '_' from regexp_replace(
      regexp_replace(
        regexp_replace(
          translate(lower(coalesce(_name, '')),
            'áàâäãåçéèêëíìîïñóòôöõøúùûüýÿğışœæ',
            'aaaaaaceeeeiiiinoooooouuuuyygisoa'),
          '[\s.\-]+', '_', 'g'),
        '[^a-z0-9_]', '', 'g'),
      '_+', '_', 'g')),
    20));
$$;

-- ------------------------------------------------------------
-- 1. Signup trigger — same as 031, name before email.
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
  -- Prefer the username picked at signup.
  _username := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  if _username !~ '^[a-z0-9_]{3,20}$' then
    _picked := false;
    -- Then the name Google/Apple sent us...
    _username := public.handle_from_name(coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      ''));
    -- ...then the email local-part.
    if char_length(_username) < 3 then
      _username := lower(split_part(coalesce(new.email, ''), '@', 1));
      _username := left(regexp_replace(_username, '[^a-z0-9_]', '', 'g'), 20);
    end if;
  end if;

  if char_length(_username) < 3
     or _username in ('admin','peak','mod','moderator','staff','support',
                      'api','root','system','official','help') then
    _username := 'user_' || substr(replace(new.id::text, '-', ''), 1, 8);
    _picked := false;
  end if;

  -- Case-insensitive collision loop (unique index is on lower(username)).
  while exists (
    select 1 from public.profiles where lower(username) = _username
  ) loop
    _username := left(_username, 15) || '_' || substr(md5(random()::text), 1, 4);
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
-- 2. Backfill everyone still on an invented handle.
-- ------------------------------------------------------------
do $$
declare
  r record;
  h text;
begin
  for r in
    select id, username, display_name
    from public.profiles
    where username_auto
    order by created_at
  loop
    h := public.handle_from_name(r.display_name);
    -- No usable name (or it's reserved): leave them as they are.
    continue when char_length(h) < 3
      or h in ('admin','peak','mod','moderator','staff','support',
               'api','root','system','official','help');
    continue when h = lower(r.username);

    while exists (
      select 1 from public.profiles where lower(username) = h and id <> r.id
    ) loop
      h := left(public.handle_from_name(r.display_name), 15) || '_' || substr(md5(random()::text), 1, 4);
    end loop;

    update public.profiles set username = h where id = r.id;
    raise notice '% -> %', r.username, h;
  end loop;
end;
$$;

-- Check: nobody left on an invented handle that has a usable name.
select username, display_name, username_auto
from public.profiles
where username_auto
order by created_at;
