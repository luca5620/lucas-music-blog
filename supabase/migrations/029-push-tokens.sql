-- ============================================================
-- Migration 029 — push notification device tokens (2026-08-31)
-- Run in the Supabase SQL Editor after 028.
--
-- One row per device the user has allowed push on. The app shell
-- registers with APNs/FCM, gets a token, and POSTs it to
-- /api/push/register, which upserts here under the CALLER's
-- session — so RLS owns the writes like everything else.
--
-- READS are the part that can't run as the caller: the fan-out
-- (edge function `push-fanout`, triggered by a Database Webhook on
-- notifications INSERT) needs the RECIPIENT's tokens while the
-- actor is the one signed in. That function runs in Supabase's own
-- infrastructure with the service-role key — which keeps the
-- app-wide rule intact: no service-role key anywhere in the app.
-- Consequently there is NO general select policy here on purpose;
-- users can read only their own rows (Settings could list devices
-- someday), and nobody can read anyone else's tokens.
-- ============================================================

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  -- APNs tokens are 64 hex chars; FCM tokens run longer. 512 is roomy.
  token text not null check (char_length(token) between 16 and 512),
  platform text not null check (platform in ('ios', 'android')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A device re-registering (same token) just refreshes its row —
  -- and a token that moves to a different account (logout → new
  -- login on the same phone) must LEAVE the old account, so the
  -- token alone is the unique key.
  unique (token)
);

create index if not exists push_tokens_user_id_idx
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

drop policy if exists "Users manage their own push tokens" on public.push_tokens;
create policy "Users manage their own push tokens"
  on public.push_tokens for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
