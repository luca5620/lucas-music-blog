-- 017 — sign in with username OR email (2026-08-22).
--
-- Supabase auth only accepts email + password. To let people type
-- their username instead, the login page resolves username -> email
-- first, then signs in normally. The resolution MUST NOT leak
-- emails (typing a username and getting the email back = harvesting
-- world-readable usernames into private emails), so this function
-- only returns the email when the submitted PASSWORD also matches:
-- calling it is never more revealing than attempting the login
-- itself.
--
-- Accepted tradeoff (same family as the M1/M4 launch risks): the
-- function is anon-callable via the REST API, so password guesses
-- against a username bypass GoTrue's login rate limits. bcrypt
-- (~100ms/attempt) plus the pg_sleep below keeps that expensive;
-- proper DB-side throttling joins the post-launch hardening pass.

create extension if not exists pgcrypto with schema extensions;

create or replace function public.email_for_login(identifier text, pass text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  found_email text;
begin
  -- Flat cost for every call, hit or miss (also slows brute force).
  perform pg_sleep(0.15);

  select u.email
    into found_email
    from public.profiles p
    join auth.users u on u.id = p.id
   where lower(p.username) = lower(trim(identifier))
     and u.encrypted_password is not null
     and u.encrypted_password <> ''
     and u.encrypted_password = extensions.crypt(pass, u.encrypted_password);

  return found_email;  -- null on any miss: unknown username OR wrong password
end;
$$;

revoke all on function public.email_for_login(text, text) from public;
grant execute on function public.email_for_login(text, text) to anon, authenticated;
