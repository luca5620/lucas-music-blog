-- ============================================================
-- Migration 032 — fire push-fanout on every notification (2026-09-02)
-- Run in the Supabase SQL Editor after 031.
--
-- The last link in the push chain. 029 gave us the device tokens and
-- the `push-fanout` edge function does the APNs talking; this is what
-- actually calls it. Everything that already creates a notification
-- (createNotification — follows, likes, comments, replies) starts
-- sending pushes the moment this runs. No app code changes.
--
-- WHY A TRIGGER AND NOT THE DASHBOARD'S "Database Webhooks" UI: they
-- are the same mechanism — that UI writes a trigger exactly like this
-- one — but a migration is reviewable, lives in the repo with
-- everything else, and gets applied the same way as every other change
-- here. It also avoids depending on the `supabase_functions` wrapper
-- schema, which only exists once someone has created a webhook by hand.
--
-- WHY net.http_post AND NOT plain http: pg_net queues the request in a
-- background worker, so the notification INSERT returns immediately.
-- A slow or dead APNs must never make liking a review feel slow, and
-- must never roll the notification back.
--
-- ⚠️ BEFORE RUNNING: replace __PUSH_WEBHOOK_SECRET__ below with the
-- real value. It is deliberately NOT in this file — this repo is
-- PUBLIC, and the secret is the only thing stopping a stranger from
-- POSTing to the function URL and sending fake notifications to real
-- users. It must match the PUSH_WEBHOOK_SECRET set on the edge
-- function (Supabase → Edge Functions → push-fanout → Secrets).
-- ============================================================

-- Queues outbound HTTP from Postgres. Already present on most Supabase
-- projects; harmless if it is.
create extension if not exists pg_net;

create or replace function public.notify_push_fanout()
returns trigger
language plpgsql
security definer
set search_path = public, net
as $$
begin
  -- Fire-and-forget: pg_net hands this to its worker and returns an id
  -- immediately. We ignore the id — delivery is best-effort by design,
  -- and the in-app bell is the source of truth either way.
  perform net.http_post(
    url := 'https://qhbtfhyzbiwqwaxtetgd.supabase.co/functions/v1/push-fanout',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-push-secret', '__PUSH_WEBHOOK_SECRET__'
    ),
    -- Same shape a Supabase Database Webhook sends, so push-fanout
    -- needs no special case: { type, record }.
    body := jsonb_build_object('type', 'INSERT', 'record', to_jsonb(new))
  );
  return new;
end;
$$;

-- Idempotent: re-running this migration replaces the trigger cleanly.
drop trigger if exists notifications_push_fanout on public.notifications;

create trigger notifications_push_fanout
  after insert on public.notifications
  for each row
  execute function public.notify_push_fanout();

-- Verify (should list one trigger):
--   select tgname from pg_trigger
--   where tgrelid = 'public.notifications'::regclass and not tgisinternal;
