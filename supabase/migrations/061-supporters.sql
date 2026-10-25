-- ============================================================
-- Migration 061 — Supporters + the silver checkmark (2026-10-25)
-- Run in the Supabase SQL Editor. Safe to re-run.
--
-- WHAT IT DOES
-- Anyone can support Peak Music on the WEBSITE (/support, Stripe
-- Checkout, any amount). Supporting once = a silver checkmark next
-- to your @handle forever (Luca's call 2026-10-25: any amount,
-- never expires) plus a spot on the supporters wall on /support.
-- Nothing functional is unlocked — rating, reviewing, Aux Wars and
-- rooms stay free for everyone.
--
-- HOW THE MONEY BECOMES A CHECKMARK
--   /support → POST /api/support/checkout → Stripe Checkout (hosted)
--   Stripe → POST /api/stripe/webhook  (signature-checked)
--     → public.record_supporter(secret, user, session, amount, …)
--   The app only has the anon key (no service role anywhere), so the
--   webhook can't write tables itself. record_supporter is SECURITY
--   DEFINER and anyone may call it — but it does nothing unless the
--   first argument matches a secret kept in private.app_secrets,
--   a schema the API can't see. The same secret lives in Vercel as
--   SUPPORTER_RPC_SECRET. That's the whole gate, so keep it long.
--
-- THE BADGE
-- A new role value, 'supporter' (silver/white check). It only ever
-- UPGRADES a plain 'user': the Founder, admins, reviewers and early
-- testers keep their own checkmark, and their support is still
-- recorded (public.supporters) so the wall + "Supporter since" show.
--
-- ⚠️ BEFORE / AFTER RUNNING — Luca's hands:
--   1. Make up a long random secret (e.g. run in a terminal:
--        node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
--      ) and paste it below in place of __SUPPORTER_RPC_SECRET__.
--      Don't commit the real value — the repo is public.
--   2. Put the SAME value in Vercel → Settings → Environment
--      Variables as SUPPORTER_RPC_SECRET (plus the two Stripe vars —
--      see .env.example), then redeploy.
--   3. Test (fake session id, your own uuid) — this really grants the
--      badge, so only do it on yourself or a test account:
--        select public.record_supporter('<secret>', '<uuid>',
--          'cs_test_manual_1', 300, 'usd');
-- ============================================================


-- ------------------------------------------------------------
-- 1. 'supporter' becomes a valid role (silver check).
--    Same constraint name 008 used.
-- ------------------------------------------------------------
alter table public.profiles
  drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user', 'reviewer', 'admin', 'owner', 'tester', 'supporter'));


-- ------------------------------------------------------------
-- 2. The public part: who supports, and since when. No amounts.
--    Readable by everyone (it's the supporters wall); nobody can
--    write it except record_supporter.
-- ------------------------------------------------------------
create table if not exists public.supporters (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  -- First time they supported — drives "Supporter since 2026".
  since   timestamptz not null default now()
);

alter table public.supporters enable row level security;

drop policy if exists "Supporters are public" on public.supporters;
create policy "Supporters are public"
  on public.supporters for select
  using (true);


-- ------------------------------------------------------------
-- 3. The private part: every payment. RLS on with NO policies, so
--    no app user can read or write it (amounts stay private).
--    stripe_session_id is unique, so Stripe re-sending the same
--    webhook (it retries on any hiccup) can never double-count.
-- ------------------------------------------------------------
create table if not exists public.supporter_payments (
  stripe_session_id text primary key,
  user_id           uuid not null references public.profiles(id) on delete cascade,
  amount_cents      integer not null check (amount_cents > 0),
  currency          text not null,
  created_at        timestamptz not null default now()
);

create index if not exists idx_supporter_payments_user
  on public.supporter_payments (user_id, created_at desc);

alter table public.supporter_payments enable row level security;


-- ------------------------------------------------------------
-- 4. The secret store. `private` isn't in the API's exposed schemas,
--    so nothing outside SQL can even see this table exists.
-- ------------------------------------------------------------
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_secrets (
  name  text primary key,
  value text not null
);

insert into private.app_secrets (name, value)
values ('supporter_rpc', '__SUPPORTER_RPC_SECRET__')
on conflict (name) do update set value = excluded.value;


-- ------------------------------------------------------------
-- 5. The one door in: record a paid Stripe session.
--    Returns true when the secret matched (even for a duplicate
--    webhook — that's still a success from Stripe's point of view).
-- ------------------------------------------------------------
create or replace function public.record_supporter(
  p_secret       text,
  p_user_id      uuid,
  p_session_id   text,
  p_amount_cents integer,
  p_currency     text
)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $fn$
declare
  v_expected text;
begin
  select value into v_expected from private.app_secrets where name = 'supporter_rpc';
  -- No secret set, the placeholder still in place, or a wrong guess:
  -- refuse, without saying which.
  if v_expected is null
     or v_expected = '__SUPPORTER_RPC_SECRET__'
     or p_secret is distinct from v_expected then
    return false;
  end if;

  if p_user_id is null or p_session_id is null or p_amount_cents is null
     or p_amount_cents <= 0 then
    return false;
  end if;

  -- A deleted account between paying and the webhook: nothing to badge.
  if not exists (select 1 from public.profiles where id = p_user_id) then
    return true;
  end if;

  insert into public.supporter_payments (stripe_session_id, user_id, amount_cents, currency)
  values (p_session_id, p_user_id, p_amount_cents, lower(coalesce(p_currency, 'usd')))
  on conflict (stripe_session_id) do nothing;

  -- First support sets "since"; later ones leave it alone.
  insert into public.supporters (user_id)
  values (p_user_id)
  on conflict (user_id) do nothing;

  -- The silver check — only for plain members (see header).
  update public.profiles
     set role = 'supporter'
   where id = p_user_id
     and role = 'user';

  return true;
end;
$fn$;

revoke all on function public.record_supporter(text, uuid, text, integer, text) from public;
-- The webhook runs with the anon key (no signed-in user), so anon
-- must be able to call it; the secret is the gate.
grant execute on function public.record_supporter(text, uuid, text, integer, text)
  to anon, authenticated;


-- ------------------------------------------------------------
-- Verify:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conname = 'profiles_role_check';          -- includes 'supporter'
--   select * from public.supporters order by since desc;
--   select user_id, amount_cents, currency, created_at
--     from public.supporter_payments order by created_at desc;
-- ------------------------------------------------------------
