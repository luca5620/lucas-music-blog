-- Add role column to profiles
-- Roles: 'user' (default), 'reviewer' (verified music reviewer), 'admin', 'owner'
alter table public.profiles
  add column if not exists role text not null default 'user'
  check (role in ('user', 'reviewer', 'admin', 'owner'));

-- Set Luca as the owner
update public.profiles
  set role = 'owner'
  where id = '8587299c-dbb8-49a9-b984-e25c089a65fc';

-- Prevent users from changing their own role via RLS
-- Drop and recreate the update policy to exclude the role column
drop policy if exists "Users can update their own profile" on public.profiles;

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id and role = (select role from public.profiles where id = auth.uid()));
