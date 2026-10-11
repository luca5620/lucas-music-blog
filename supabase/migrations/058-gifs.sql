-- ============================================================
-- 058 — GIFs on reviews and comments (2026-10-11)
--
-- Run BY HAND in the Supabase SQL editor. Safe to re-run (every
-- column is "if not exists", every constraint is dropped first).
--
-- A GIF is never uploaded to us. Members pick one from KLIPY (the
-- GIF library Discord and WhatsApp moved to when Google shut down
-- the Tenor API on 2026-06-30), and we store only the link KLIPY
-- gave us plus its size, so the page can reserve the right shape
-- before the GIF loads. KLIPY's terms require exactly that: load
-- their media from their URLs, never copy or re-host it.
-- ============================================================


-- ── 1. The columns ──────────────────────────────────────────
-- Three plain columns on each table rather than one JSON blob, so
-- the database itself can check them (see section 2).
alter table public.reviews  add column if not exists gif_url    text;
alter table public.reviews  add column if not exists gif_width  smallint;
alter table public.reviews  add column if not exists gif_height smallint;

alter table public.comments add column if not exists gif_url    text;
alter table public.comments add column if not exists gif_width  smallint;
alter table public.comments add column if not exists gif_height smallint;


-- ── 2. Only KLIPY links, only sane sizes ────────────────────
-- The API routes already check this (lib/gif.ts → parseGif), but
-- RLS lets a signed-in member write their own rows straight through
-- PostgREST, so the real gate has to live here. The URL must be an
-- https link on KLIPY's media hosts (static.klipy.com,
-- static1.klipy.com, static2.klipy.com …) — anything else could
-- turn a review into a tracking pixel or a shock image from some
-- random server. Width/height are either both set and plausible or
-- the whole GIF is absent.
alter table public.reviews drop constraint if exists chk_reviews_gif;
alter table public.reviews add constraint chk_reviews_gif check (
  (gif_url is null and gif_width is null and gif_height is null)
  or (
    gif_url ~ '^https://static[0-9]*\.klipy\.com/[A-Za-z0-9/_.~%?&=-]+$'
    and char_length(gif_url) <= 500
    and gif_width  between 1 and 4000
    and gif_height between 1 and 4000
  )
);

alter table public.comments drop constraint if exists chk_comments_gif;
alter table public.comments add constraint chk_comments_gif check (
  (gif_url is null and gif_width is null and gif_height is null)
  or (
    gif_url ~ '^https://static[0-9]*\.klipy\.com/[A-Za-z0-9/_.~%?&=-]+$'
    and char_length(gif_url) <= 500
    and gif_width  between 1 and 4000
    and gif_height between 1 and 4000
  )
);


-- ── 3. A comment can be JUST a GIF ──────────────────────────
-- 005 required 1–2000 characters of text on every comment. A GIF
-- reply with no words is now fine — but a comment still has to carry
-- SOMETHING: words, a GIF, or both. (Reviews needed no change: words
-- were already optional there — a score alone is a valid review.)
alter table public.comments drop constraint if exists chk_comments_content_len;
alter table public.comments add constraint chk_comments_content_len check (
  char_length(content) <= 2000
  and (char_length(content) >= 1 or gif_url is not null)
) not valid;
