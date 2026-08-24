-- ============================================================
-- Migration 020 — DB-side hardening (2026-08-24)
-- Run in the Supabase SQL Editor after 019.
--
-- Closes the M1/M4 launch-audit gaps: three rules that existed only
-- in the API layer, bypassable by any signed-in user crafting
-- requests straight at Supabase (the anon key + their JWT are public
-- by design). The API stays the front door; these make the database
-- itself refuse. Normal users notice nothing.
--
--   1. Closed debates accept no new messages — and no new/changed
--      votes (the vote gap wasn't in the audit; same species, fixed
--      while we're here).
--   2. Report flood: max 10 reports per user per hour, DB-enforced.
--   3. Catalog import spam: max 30 imported releases per non-staff
--      user per hour, enforced by a trigger on releases itself so
--      the big catalog_import_release function needs no rewrite.
-- ============================================================

-- ------------------------------------------------------------
-- 1. CLOSED DEBATES ARE READ-ONLY
--    Debates are publicly selectable, so the policies can check
--    status inline — no helper function needed.
-- ------------------------------------------------------------
drop policy if exists "Users post debate messages as themselves" on public.debate_messages;
create policy "Users post debate messages as themselves"
  on public.debate_messages for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debates d
       where d.id = debate_id and d.status = 'open'
    )
  );

drop policy if exists "Users vote as themselves" on public.debate_votes;
create policy "Users vote as themselves"
  on public.debate_votes for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debates d
       where d.id = debate_id and d.status = 'open'
    )
  );

drop policy if exists "Users can change their vote" on public.debate_votes;
create policy "Users can change their vote"
  on public.debate_votes for update
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.debates d
       where d.id = debate_id and d.status = 'open'
    )
  );

-- ------------------------------------------------------------
-- 2. REPORT CAP — 10 per reporter per hour (matches the API).
--    The counter is SECURITY DEFINER so the insert policy never
--    re-enters content_reports' own RLS while evaluating.
-- ------------------------------------------------------------
create or replace function public.reports_filed_last_hour(uid uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
    from public.content_reports
   where reporter_id = uid
     and created_at > now() - interval '1 hour';
$$;

revoke all on function public.reports_filed_last_hour(uuid) from public, anon;
grant execute on function public.reports_filed_last_hour(uuid) to authenticated;

drop policy if exists "Users can file reports as themselves" on public.content_reports;
create policy "Users can file reports as themselves"
  on public.content_reports for insert
  with check (
    auth.uid() = reporter_id
    and public.reports_filed_last_hour(auth.uid()) < 10
  );

-- ------------------------------------------------------------
-- 3. CATALOG IMPORT THROTTLE — 30 releases per non-staff user
--    per hour. A BEFORE INSERT trigger on releases guards EVERY
--    path (the catalog_import_release RPC included) without
--    rewriting that function. Staff and server-side inserts
--    (no auth context) pass untouched. The log table has RLS on
--    with no policies: only the definer-owned trigger touches it.
-- ------------------------------------------------------------
create table if not exists public.catalog_import_log (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists idx_catalog_import_log_user
  on public.catalog_import_log (user_id, created_at desc);

alter table public.catalog_import_log enable row level security;

create or replace function public.throttle_release_inserts()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- No auth context = server-side/maintenance work, not a user.
  if auth.uid() is null then
    return new;
  end if;

  if exists (
    select 1 from public.profiles
     where id = auth.uid() and role in ('owner', 'admin')
  ) then
    return new;
  end if;

  -- Keep the log from growing forever — this user's stale rows only,
  -- so the delete stays on the index.
  delete from public.catalog_import_log
   where user_id = auth.uid()
     and created_at < now() - interval '2 hours';

  if (
    select count(*) from public.catalog_import_log
     where user_id = auth.uid()
       and created_at > now() - interval '1 hour'
  ) >= 30 then
    raise exception 'Catalog import limit reached — try again in a bit.';
  end if;

  insert into public.catalog_import_log (user_id) values (auth.uid());
  return new;
end;
$$;

drop trigger if exists trg_throttle_release_inserts on public.releases;
create trigger trg_throttle_release_inserts
  before insert on public.releases
  for each row execute function public.throttle_release_inserts();
