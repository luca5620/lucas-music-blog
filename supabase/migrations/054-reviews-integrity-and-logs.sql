-- ============================================================
-- 054 — Reviews integrity, a database-level slur filter, and the
--        "logs completed" stat  (2026-10-05, MacBook)
--
-- Run BY HAND in the Supabase SQL editor (Dashboard → SQL Editor →
-- paste → Run). Safe to re-run: everything is "if not exists" /
-- "create or replace" / "drop ... if exists" first.
--
-- WHY THIS EXISTS. A code review on 2026-10-05 found three holes:
--
--  1. "One review per person per record" was only checked by the
--     API (look first, then insert). Two taps on a slow connection,
--     or two devices, can both pass the look and both insert — the
--     slug generator just adds "-2". The record's average then
--     counts that person twice. → a UNIQUE index (part A).
--
--  2. The browser holds the anon key AND the user's login token, so
--     anyone technical can write to Supabase directly, skipping every
--     rule the API enforces: the slur filter (App Store 1.2 requires
--     one), catalog-derived title/artist/cover (someone could post a
--     "review" with any title and cover they like), the standout-track
--     rules. Profile text (name, bio, pronouns) was never filtered at
--     all — the settings page writes it straight to the table.
--     → triggers that repeat those rules INSIDE the database, so it
--       doesn't matter how a write arrives (parts B and C).
--
--  3. New stat: a "log" is one calendar month on THE LOG (the
--     profile calendar). A log is COMPLETED when every single day of
--     that month has at least one published review on it. Luca,
--     2026-10-05: it's "very prestigious", so it gets the trophy.
--     → a function that counts completed months (part D).
-- ============================================================


-- ── A. One review per person per record ──────────────────────
-- Before adding the lock, make sure nothing already breaks it. If a
-- duplicate exists (drafts included — the site can't see drafts, so
-- this is the only place it can be checked), STOP and say which, so
-- a human decides which copy to keep. Deleting someone's review
-- automatically is not a call a migration should make.
do $$
declare
  dupes text;
begin
  select string_agg(format('user %s / release %s (%s copies)', user_id, release_id, n), E'\n')
    into dupes
  from (
    select user_id, release_id, count(*) as n
    from public.reviews
    where release_id is not null
    group by user_id, release_id
    having count(*) > 1
  ) d;

  if dupes is not null then
    raise exception E'054 stopped: duplicate reviews exist. Delete the extra copy of each, then run this again:\n%', dupes;
  end if;
end $$;

-- Old pre-catalog reviews have no release_id; they're exempt (there's
-- nothing to be "the same record" as). The API turns the error this
-- raises (23505) into its friendly "you already reviewed this — edit
-- that one instead" answer.
create unique index if not exists uq_reviews_user_release
  on public.reviews (user_id, release_id)
  where release_id is not null;


-- ── B. The slur filter, inside the database ──────────────────
-- A copy of lib/content-filter.ts. KEEP THE TWO LISTS IN SYNC — if a
-- term is added there, add it here (and the other way round). Same
-- scope as the app: bright-line slurs and harassment, NOT swearing.
--
-- Normalising: lowercase, then map leetspeak back to letters
-- (0→o 1→i 3→e 4→a 5→s 7→t 8→b @→a $→s !→i), exactly like the app.
-- \y is Postgres's word boundary, so "classic" never trips on a
-- substring; "s?" allows the plural; multi-word terms allow any
-- run of spaces between words.
create or replace function public.text_is_blocked(t text)
returns boolean
language sql
immutable
as $$
  select coalesce(
    translate(lower(t), '0134578@$!', 'oieastbasi')
      ~ '\y(nigger|kike|spic|chink|gook|wetback|beaner|raghead|faggot|fagot|tranny|kill\s+yourself|kys|go\s+die)s?\y',
    false
  );
$$;

-- One trigger function for every table: the columns to check are
-- passed as trigger arguments, and each is read through to_jsonb(NEW)
-- so a column that doesn't exist on that table is simply null (and
-- clean) instead of an error. Raising stops the write; the API
-- already rejects the same text first with a friendlier message, so
-- in normal use nobody ever sees this one.
create or replace function public.reject_blocked_text()
returns trigger
language plpgsql
as $$
declare
  col text;
begin
  foreach col in array tg_argv loop
    if public.text_is_blocked(to_jsonb(new) ->> col) then
      raise exception 'That text contains language we don''t allow (Terms of Use).'
        using errcode = 'check_violation';
    end if;
  end loop;
  return new;
end;
$$;

-- Attach it. Each "drop … if exists" first makes this re-runnable.
drop trigger if exists trg_reviews_text_filter on public.reviews;
create trigger trg_reviews_text_filter
  before insert or update on public.reviews
  for each row execute function public.reject_blocked_text('snippet', 'summary');

drop trigger if exists trg_comments_text_filter on public.comments;
create trigger trg_comments_text_filter
  before insert or update on public.comments
  for each row execute function public.reject_blocked_text('content');

drop trigger if exists trg_posts_text_filter on public.posts;
create trigger trg_posts_text_filter
  before insert or update on public.posts
  for each row execute function public.reject_blocked_text('title', 'body');

drop trigger if exists trg_lists_text_filter on public.lists;
create trigger trg_lists_text_filter
  before insert or update on public.lists
  for each row execute function public.reject_blocked_text('title', 'description');

drop trigger if exists trg_room_messages_text_filter on public.room_messages;
create trigger trg_room_messages_text_filter
  before insert or update on public.room_messages
  for each row execute function public.reject_blocked_text('content');

drop trigger if exists trg_aux_messages_text_filter on public.aux_messages;
create trigger trg_aux_messages_text_filter
  before insert or update on public.aux_messages
  for each row execute function public.reject_blocked_text('content');

drop trigger if exists trg_aux_rooms_text_filter on public.aux_rooms;
create trigger trg_aux_rooms_text_filter
  before insert or update on public.aux_rooms
  for each row execute function public.reject_blocked_text('name');

drop trigger if exists trg_aux_matches_text_filter on public.aux_matches;
create trigger trg_aux_matches_text_filter
  before insert or update on public.aux_matches
  for each row execute function public.reject_blocked_text('topic');

drop trigger if exists trg_aux_games_text_filter on public.aux_games;
create trigger trg_aux_games_text_filter
  before insert or update on public.aux_games
  for each row execute function public.reject_blocked_text('topic');

drop trigger if exists trg_debate_messages_text_filter on public.debate_messages;
create trigger trg_debate_messages_text_filter
  before insert or update on public.debate_messages
  for each row execute function public.reject_blocked_text('content');

-- Profiles: UPDATE only, on purpose. New profiles are created by the
-- signup trigger (handle_new_user), and a filter firing there would
-- fail the whole sign-up with a cryptic auth error. Every
-- user-chosen value arrives as an UPDATE afterwards (/welcome,
-- settings), so this still covers everything a person types.
drop trigger if exists trg_profiles_text_filter on public.profiles;
create trigger trg_profiles_text_filter
  before update on public.profiles
  for each row execute function public.reject_blocked_text(
    'username', 'display_name', 'bio', 'pronouns', 'tagline', 'location'
  );


-- ── C. Reviews describe the record they're about, always ─────
-- The API derives title / artist / cover / type / dates / genre from
-- the catalog row and never trusts the client for them. A direct
-- write could send anything, so the database now does the same
-- derivation on every insert and update — the client's values for
-- those columns are overwritten with the catalog's. For the API this
-- is a no-op (it already sent the same values).
--
-- Also enforced here:
--   * new reviews must point at a real catalog release;
--   * a review can't be moved to another person or another record;
--   * standout tracks must be titles from that release's tracklist,
--     at most 30, and any link must be a Spotify link (the app
--     renders it as <a href>, so anything else is an XSS risk).
create or replace function public.reviews_enforce_catalog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rel   record;
  pick  jsonb;
  url   text;
begin
  if tg_op = 'UPDATE' then
    if new.user_id is distinct from old.user_id then
      raise exception 'A review cannot change owner.' using errcode = 'check_violation';
    end if;
    if new.release_id is distinct from old.release_id then
      raise exception 'A review cannot move to another record.' using errcode = 'check_violation';
    end if;
  end if;

  -- Legacy rows (pre-catalog, release_id null) keep their own fields;
  -- only an UPDATE can reach them, and they have nothing to derive from.
  if new.release_id is null then
    if tg_op = 'INSERT' then
      raise exception 'A review must be about a catalog release.' using errcode = 'check_violation';
    end if;
    return new;
  end if;

  select r.title, r.cover_image, r.release_type, r.release_date, r.tracks,
         a.name as artist_name, a.genres
    into rel
  from public.releases r
  left join public.artists a on a.id = r.primary_artist_id
  where r.id = new.release_id;

  if not found then
    raise exception 'That release does not exist.' using errcode = 'foreign_key_violation';
  end if;

  new.title        := rel.title;
  new.artist       := coalesce(rel.artist_name, 'Unknown Artist');
  new.cover_image  := rel.cover_image;
  new.release_type := rel.release_type;
  new.release_date := rel.release_date;
  new.genre        := rel.genres[1];

  -- Standout tracks: same rules as parseTrackPicks in the API.
  if new.standout_tracks is not null and new.standout_tracks <> '[]'::jsonb then
    if jsonb_typeof(new.standout_tracks) <> 'array'
       or jsonb_array_length(new.standout_tracks) > 30 then
      raise exception 'Invalid standout tracks.' using errcode = 'check_violation';
    end if;
    for pick in select * from jsonb_array_elements(new.standout_tracks) loop
      if jsonb_typeof(pick) <> 'object'
         or not exists (
           select 1 from jsonb_array_elements(coalesce(rel.tracks, '[]'::jsonb)) t
           where t ->> 'title' = pick ->> 'title'
         ) then
        raise exception 'Personal favorites must come from the release''s track list.'
          using errcode = 'check_violation';
      end if;
      url := coalesce(pick ->> 'spotifyUrl', '');
      if url <> '' and url not like 'https://open.spotify.com/%' then
        raise exception 'Track links must be Spotify links.' using errcode = 'check_violation';
      end if;
    end loop;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_reviews_enforce_catalog on public.reviews;
create trigger trg_reviews_enforce_catalog
  before insert or update on public.reviews
  for each row execute function public.reviews_enforce_catalog();


-- ── D. Logs completed ────────────────────────────────────────
-- How many calendar months this person has COMPLETELY filled on THE
-- LOG: every day of the month has at least one published review
-- dated that day. THE LOG places a review on its review_date (falling
-- back to the day it was created), so this counts the same way.
--
-- review_date is the reviewer's own local date from 2026-10-05 on
-- (the API now takes it from the device, see app/api/reviews/
-- route.ts). Older reviews were dated in UTC, which can land an
-- evening US review on the next day — a known, accepted wrinkle for
-- history; it can only ever move a review by one day.
--
-- The current month counts the moment its last day is filled (it
-- can't be complete before that, by definition).
create or replace function public.logs_completed(p_user uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from (
    select date_trunc('month', d)::date as month,
           count(distinct d) as days_filled
    from (
      select coalesce(review_date, created_at::date) as d
      from public.reviews
      where user_id = p_user
        and is_published
    ) days
    group by 1
  ) m
  where m.days_filled = extract(day from (m.month + interval '1 month' - interval '1 day'))::int;
$$;

grant execute on function public.logs_completed(uuid) to anon, authenticated;

-- Speeds up both THE LOG and logs_completed (they read one person's
-- published reviews by date).
create index if not exists idx_reviews_user_published_date
  on public.reviews (user_id, review_date)
  where is_published;
