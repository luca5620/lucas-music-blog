-- ============================================================
-- Migration 024 — drafts for posts and debates (2026-08-26)
-- Run in the Supabase SQL Editor after 023.
--
-- "Save as Draft" QoL (Luca): every create form gets the same
-- draft button reviews already have. Reviews had is_published
-- since day one and lists get drafts for free via is_public —
-- posts and debates are the two content types that were missing
-- the column, so this adds it.
--
-- default TRUE: every existing row (and any insert that doesn't
-- mention the column — which is how the app writes published
-- content) stays/lands published, so nothing disappears when
-- this runs.
--
-- The SELECT policies are the real privacy boundary: a draft is
-- visible to its author and NOBODY else — feeds, profiles, and
-- direct links all go through these same policies, so there is
-- no server-side filter to forget.
-- ============================================================

-- ---------- posts ----------
alter table public.posts
  add column if not exists is_published boolean not null default true;

-- Replaces 013's world-readable policy (same name, so whichever
-- machine runs this gets exactly one select policy either way).
drop policy if exists "Posts are viewable by everyone" on public.posts;
create policy "Posts are viewable by everyone"
  on public.posts for select
  using (is_published or auth.uid() = user_id);

-- ---------- debates ----------
alter table public.debates
  add column if not exists is_published boolean not null default true;

-- Replaces 006's world-readable policy. Messages/votes stay
-- world-readable — a draft debate has neither until it's
-- published, and only the creator can even reach its page.
drop policy if exists "Debates are viewable by everyone" on public.debates;
create policy "Debates are viewable by everyone"
  on public.debates for select
  using (is_published or auth.uid() = created_by);
