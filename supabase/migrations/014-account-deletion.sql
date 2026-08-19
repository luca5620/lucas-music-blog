-- ============================================================
-- 014 — In-app account deletion
--
-- Apple App Store guideline 5.1.1(v): any app that lets people
-- CREATE an account must let them DELETE it from inside the app.
-- "Email us and we'll remove it" is explicitly not enough — this
-- was the one submission blocker left in the audit (2026-08-19).
--
-- One SECURITY DEFINER function the signed-in user calls on
-- themselves. Deleting the auth.users row cascades through
-- public.profiles (fk ... on delete cascade) into every content
-- table — reviews, lists, debates, messages, reactions, follows,
-- posts, reports, blocks — because they all cascade from
-- profiles(id). Storage files (avatar/banner uploads) don't
-- cascade, so they're removed explicitly first.
--
-- Run in the Supabase SQL Editor like every other migration.
-- ============================================================

create or replace function public.delete_own_account()
returns void
language plpgsql
security definer set search_path = ''
as $$
declare
  _uid uuid := auth.uid();
begin
  if _uid is null then
    raise exception 'Not signed in';
  end if;

  -- Uploaded avatar/banner files — owner is stamped by Supabase
  -- Storage at upload time. Rows only; the actual blobs are pruned
  -- by Supabase's own orphan cleanup.
  delete from storage.objects
  where bucket_id in ('avatars', 'banners')
    and owner = _uid;

  -- The cascade: auth.users -> profiles -> all content.
  delete from auth.users where id = _uid;
end;
$$;

-- Only signed-in users may call it — and only ever on themselves
-- (the function ignores any outside input and uses auth.uid()).
revoke execute on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
