-- ============================================================
-- 059 — Staff can remove a reported profile picture / banner
--        (2026-10-24, prep for 1.3)
--
-- Run BY HAND in the Supabase SQL editor. Safe to re-run (the
-- policy is dropped first, the function is "create or replace").
--
-- WHY: Apple's 2026-10-16 guidelines update tightened 1.2 (user
-- content) — it now names nonconsensual intimate imagery, and a
-- developer who doesn't remove violating content after notice can be
-- treated as breaking the Developer Code of Conduct. Profiles could
-- already be REPORTED, but the report queue had no way to take a bad
-- avatar or banner down: the only update policy on profiles is "your
-- own row", and the storage policies only let you delete files in
-- your own folder. This adds exactly the two powers that were missing,
-- for owners and admins only.
-- ============================================================


-- ── 1. Staff may delete avatar/banner FILES ─────────────────
-- Files can't be deleted with SQL (Supabase's storage.protect_delete()
-- trigger blocks it — see 014-account-deletion.sql), so the admin API
-- route removes them through the Storage API with the staff member's
-- own session, and this policy is what allows that. Sits beside
-- "Users delete files in their own folder" (006), which is untouched.
drop policy if exists "Staff delete avatar and banner files" on storage.objects;
create policy "Staff delete avatar and banner files"
  on storage.objects for delete
  using (
    bucket_id in ('avatars', 'banners')
    and exists (
      select 1 from public.profiles p
       where p.id = auth.uid() and p.role in ('owner', 'admin')
    )
  );


-- ── 2. Staff may blank the avatar_url / banner_url columns ──
-- A function instead of a staff UPDATE policy on profiles: a policy
-- would let staff rewrite ANY column of anyone's profile (role
-- included). This touches the two image columns and nothing else.
-- `security definer` runs it with the owner's rights so it can get
-- past the "own row only" update policy — which is exactly why it
-- checks the caller's role itself before doing anything.
create or replace function public.staff_clear_profile_image(
  _target uuid,
  _which text  -- 'avatar' or 'banner'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles
     where id = auth.uid() and role in ('owner', 'admin')
  ) then
    raise exception 'Staff only';
  end if;

  if _which = 'avatar' then
    update public.profiles set avatar_url = null where id = _target;
  elsif _which = 'banner' then
    update public.profiles set banner_url = null where id = _target;
  else
    raise exception 'Unknown image: %', _which;
  end if;
end;
$$;

-- Signed-in users may CALL it; the role check inside decides.
revoke all on function public.staff_clear_profile_image(uuid, text) from public;
grant execute on function public.staff_clear_profile_image(uuid, text) to authenticated;

notify pgrst, 'reload schema';
