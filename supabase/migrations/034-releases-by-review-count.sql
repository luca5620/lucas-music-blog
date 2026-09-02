-- ============================================================
-- Migration 034 — "Popularity" means most-reviewed (2026-09-02)
-- Run in the Supabase SQL Editor after 033.
--
-- The /releases Popularity tab was ordering by releases.popularity —
-- Spotify's own 0-100 score, imported with the catalog row. That's
-- the wrong number for this site: it ranks by what the world streams,
-- not by what THIS community has actually written about. Luca's ask:
-- sort by how many reviews a release has, total.
--
-- Ordering by an aggregate has to happen in SQL, otherwise LIMIT /
-- OFFSET paginate the wrong set — you'd re-rank each page in isolation
-- and rows would repeat or vanish between pages. Hence a function
-- rather than a PostgREST order clause.
--
-- NOT security definer: it runs as the caller, so RLS on releases and
-- reviews applies exactly as it does everywhere else. The count only
-- sees published reviews, matching get_release_stats.
-- ============================================================

create or replace function public.list_releases_by_review_count(
  p_limit     int  default 24,
  p_offset    int  default 0,
  p_artist_id uuid default null
)
returns setof public.releases
language sql
stable
set search_path = public
as $$
  select r.*
    from public.releases r
    left join lateral (
      select count(*)::int as review_count
        from public.reviews rv
       where rv.release_id = r.id
         and rv.is_published = true
    ) rc on true
   where p_artist_id is null
      or r.primary_artist_id = p_artist_id
   -- Ties broken by newest first, then title, so paging is stable:
   -- every release with zero reviews still has ONE definite position.
   order by rc.review_count desc,
            r.release_date  desc nulls last,
            r.title         asc,
            r.id            asc
   limit  greatest(coalesce(p_limit, 24), 0)
  offset  greatest(coalesce(p_offset, 0), 0);
$$;

comment on function public.list_releases_by_review_count is
  'Releases ordered by published review count desc — the /releases Popularity tab.';

-- The lateral count is one index lookup per release; 002/006 already
-- created idx_reviews_release_id, this just makes the dependency
-- explicit and re-runnable.
create index if not exists idx_reviews_release_id
  on public.reviews (release_id);

grant execute on function public.list_releases_by_review_count(int, int, uuid)
  to anon, authenticated;

-- Verify (most-reviewed first, and the counts should be descending):
--   select r.title,
--          (select count(*) from public.reviews rv
--            where rv.release_id = r.id and rv.is_published) as reviews
--     from public.list_releases_by_review_count(10, 0) r;
