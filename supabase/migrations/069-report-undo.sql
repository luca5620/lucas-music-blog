-- ============================================================
-- Migration 069 — Undo in the report queue (2026-10-30)
-- Run in the Supabase SQL Editor AFTER 068. Safe to re-run.
--
-- Luca: "what if i accidentally deleted something that actually
-- wasnt an issue". Until now "Delete content" was a hard delete: the
-- row was gone, and so was everything hanging off it (a review's
-- comments and likes, a list's items…). Nothing to bring back.
--
-- WHAT IT ADDS
--   1. content_reports gets handled_at / handled_by (who closed it and
--      when — filled in by a trigger on every status change, so the
--      app doesn't have to remember) plus the delete snapshot columns.
--   2. staff_delete_reported_content(report) — what "Delete content"
--      calls now: copies the reported row AND every row that would be
--      cascade-deleted with it (found through the foreign keys, so new
--      tables are covered automatically) into the report, THEN
--      deletes, then marks the report resolved.
--   3. staff_restore_reported_content(report) — "Restore" in the
--      history: puts every copied row back with its original id (links
--      work again), resets each row to exactly how it was (so like /
--      vote counters that triggers bump on insert don't double), and
--      marks the report dismissed — it wasn't an issue.
--
-- Notes
--   • Notifications are written by the app (notify_user), not by
--     insert triggers, so a restore never re-notifies anyone.
--   • Things deleted BEFORE this migration can't be restored — there's
--     no copy of them.
--   • Avatar / banner removals delete the image FILES; those can't be
--     restored either (the member re-uploads).
--   • Links that were SET NULL when the row went (e.g. a profile's
--     featured review) stay cleared.
-- ============================================================


-- ------------------------------------------------------------
-- 1. Columns
-- ------------------------------------------------------------
alter table public.content_reports
  add column if not exists handled_at  timestamptz,
  add column if not exists handled_by  uuid references public.profiles(id) on delete set null,
  -- [{ "t": "public.reviews", "r": { …row… } }, …] parents first
  add column if not exists snapshot    jsonb,
  add column if not exists deleted_at  timestamptz,
  add column if not exists restored_at timestamptz;

-- Who/when on every status change. Reopening clears it again.
create or replace function public.content_reports_stamp_handled()
returns trigger
language plpgsql
as $fn$
begin
  if new.status is distinct from old.status then
    if new.status = 'open' then
      new.handled_at := null;
      new.handled_by := null;
    else
      new.handled_at := now();
      new.handled_by := auth.uid();
    end if;
  end if;
  return new;
end;
$fn$;

drop trigger if exists trg_content_reports_stamp_handled on public.content_reports;
create trigger trg_content_reports_stamp_handled
  before update on public.content_reports
  for each row execute function public.content_reports_stamp_handled();


-- ------------------------------------------------------------
-- 2. Staff check — owners/admins on an email-code session (021).
-- ------------------------------------------------------------
create or replace function public.is_staff_with_code()
returns boolean
language sql
stable
security definer
set search_path = public
as $fn$
  select public.session_used_email_code()
     and exists (
       select 1 from public.profiles
        where id = auth.uid() and role in ('owner', 'admin')
     );
$fn$;


-- ------------------------------------------------------------
-- 3. The snapshot: rows of p_table whose p_col is one of p_vals,
--    plus — recursively — every row a cascade delete would take with
--    them. Returned parents-first, as [{t, r}, …].
-- ------------------------------------------------------------
create or replace function public.moderation_snapshot(
  p_table regclass,
  p_col   text,
  p_vals  text[],
  p_depth int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_rows  jsonb;
  v_out   jsonb := '[]'::jsonb;
  v_fk    record;
  v_keys  text[];
begin
  if p_depth > 5 or p_vals is null or cardinality(p_vals) = 0 then
    return v_out;
  end if;

  execute format(
    'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from %s x where x.%I::text = any($1)',
    p_table, p_col
  ) into v_rows using p_vals;

  if jsonb_array_length(v_rows) = 0 then
    return v_out;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object('t', p_table::text, 'r', e)), '[]'::jsonb)
    into v_out
    from jsonb_array_elements(v_rows) e;

  -- Every single-column foreign key that points at this table with
  -- ON DELETE CASCADE: its rows go when ours go, so copy them too.
  for v_fk in
    select c.conrelid::regclass as child,
           ca.attname           as child_col,
           pa.attname           as parent_col
      from pg_constraint c
      join pg_attribute ca on ca.attrelid = c.conrelid  and ca.attnum = c.conkey[1]
      join pg_attribute pa on pa.attrelid = c.confrelid and pa.attnum = c.confkey[1]
     where c.contype = 'f'
       and c.confrelid = p_table
       and c.confdeltype = 'c'
       and cardinality(c.conkey) = 1
       -- Never copy notifications: putting one back would fire the
       -- push trigger (032). Nothing cascades into them from here
       -- today; this keeps it that way.
       and c.conrelid <> 'public.notifications'::regclass
  loop
    select array_agg(distinct e ->> v_fk.parent_col::text)
      into v_keys
      from jsonb_array_elements(v_rows) e
     where e ->> v_fk.parent_col::text is not null;

    v_out := v_out || public.moderation_snapshot(v_fk.child, v_fk.child_col::text, v_keys, p_depth + 1);
  end loop;

  return v_out;
end;
$fn$;

revoke all on function public.moderation_snapshot(regclass, text, text[], int)
  from public, anon, authenticated;


-- Which table each reportable type lives in (mirrors DELETABLE in
-- app/api/admin/reports/[reportId]/route.ts).
-- Text, not regclass, so a table that's ever dropped can't break
-- the function for every other type (to_regclass → null instead).
create or replace function public.report_target_table(p_type text)
returns regclass
language sql
stable
as $fn$
  select to_regclass(case p_type
    when 'review'         then 'public.reviews'
    when 'comment'        then 'public.comments'
    when 'debate_message' then 'public.debate_messages'
    when 'aux_message'    then 'public.aux_messages'
    when 'aux_room'       then 'public.aux_rooms'
    when 'room_message'   then 'public.room_messages'
    when 'list'           then 'public.lists'
    when 'post'           then 'public.posts'
    else null
  end);
$fn$;


-- ------------------------------------------------------------
-- 4. Delete WITH a copy. Returns true if something was deleted.
-- ------------------------------------------------------------
create or replace function public.staff_delete_reported_content(p_report uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_rep   public.content_reports%rowtype;
  v_table regclass;
  v_snap  jsonb;
begin
  if not public.is_staff_with_code() then
    raise exception 'Staff only';
  end if;

  select * into v_rep from public.content_reports where id = p_report for update;
  if not found then
    raise exception 'Report not found';
  end if;

  v_table := public.report_target_table(v_rep.target_type);
  if v_table is null then
    -- Not deletable from the queue (profiles, debates): just resolve.
    update public.content_reports set status = 'resolved' where id = p_report;
    return false;
  end if;

  v_snap := public.moderation_snapshot(v_table, 'id', array[v_rep.target_id::text]);

  if jsonb_array_length(v_snap) > 0 then
    execute format('delete from %s where id = $1', v_table) using v_rep.target_id;
  end if;

  update public.content_reports
     set status      = 'resolved',
         snapshot    = case when jsonb_array_length(v_snap) > 0 then v_snap else snapshot end,
         deleted_at  = case when jsonb_array_length(v_snap) > 0 then now() else deleted_at end,
         restored_at = null
   where id = p_report;

  return jsonb_array_length(v_snap) > 0;
end;
$fn$;

revoke all on function public.staff_delete_reported_content(uuid) from public;
grant execute on function public.staff_delete_reported_content(uuid) to authenticated;


-- ------------------------------------------------------------
-- 5. Restore. Returns how many rows came back.
-- ------------------------------------------------------------
create or replace function public.staff_restore_reported_content(p_report uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  v_rep   public.content_reports%rowtype;
  v_item  jsonb;
  v_cols  text;
  v_n     integer := 0;
  v_added integer;
begin
  if not public.is_staff_with_code() then
    raise exception 'Staff only';
  end if;

  select * into v_rep from public.content_reports where id = p_report for update;
  if not found then
    raise exception 'Report not found';
  end if;
  if v_rep.snapshot is null or v_rep.restored_at is not null then
    raise exception 'Nothing to restore for this report';
  end if;

  -- Pass 1: put every row back, parents first (that's the snapshot's
  -- order). Generated columns are left out — Postgres fills them.
  for v_item in select value from jsonb_array_elements(v_rep.snapshot) loop
    select string_agg(quote_ident(attname), ', ' order by attnum)
      into v_cols
      from pg_attribute
     where attrelid = (v_item ->> 't')::regclass
       and attnum > 0 and not attisdropped and attgenerated = '';

    execute format(
      'insert into %s (%s) select %s from jsonb_populate_record(null::%s, $1) on conflict do nothing',
      v_item ->> 't', v_cols, v_cols, v_item ->> 't'
    ) using v_item -> 'r';
    get diagnostics v_added = row_count;
    v_n := v_n + v_added;
  end loop;

  -- Pass 2: reset every row that has an id to exactly its copy, so
  -- counters that insert-triggers bumped (likes, votes, members…) land
  -- back on the numbers they had before the delete.
  for v_item in select value from jsonb_array_elements(v_rep.snapshot) loop
    if (v_item -> 'r') ? 'id' then
      select string_agg(quote_ident(attname), ', ' order by attnum)
        into v_cols
        from pg_attribute
       where attrelid = (v_item ->> 't')::regclass
         and attnum > 0 and not attisdropped and attgenerated = ''
         and attname <> 'id';
      if v_cols is not null then
        execute format(
          'update %s t set (%s) = (select %s from jsonb_populate_record(null::%s, $1)) where t.id::text = $2',
          v_item ->> 't', v_cols, v_cols, v_item ->> 't'
        ) using v_item -> 'r', v_item -> 'r' ->> 'id';
      end if;
    end if;
  end loop;

  update public.content_reports
     set status      = 'dismissed',
         restored_at = now()
   where id = p_report;

  return v_n;
end;
$fn$;

revoke all on function public.staff_restore_reported_content(uuid) from public;
grant execute on function public.staff_restore_reported_content(uuid) to authenticated;

notify pgrst, 'reload schema';


-- ------------------------------------------------------------
-- Verify:
--   select column_name from information_schema.columns
--    where table_name = 'content_reports' and column_name in
--      ('handled_at','handled_by','snapshot','deleted_at','restored_at');
--   -- 5 rows
-- ------------------------------------------------------------
