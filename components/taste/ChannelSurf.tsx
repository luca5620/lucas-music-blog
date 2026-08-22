"use client";

/**
 * ChannelSurf — the TUNED TO YOU pager (Luca 2026-08-19: "like how
 * TikTok is formatted").
 *
 * One piece of content fills the frame at a time; the next is a swipe
 * away on touch (CSS scroll-snap does the physics) or a ▼ click /
 * arrow-key press on desktop. Reviews show the reviewer + their words
 * right on the card (Luca 2026-08-20: no extra click to read a take).
 *
 * FULLSCREEN (rebuilt 2026-08-22, Luca's spec):
 *  - The overlay renders through a PORTAL to document.body. In the
 *    page column it sat inside `.crt-screen > *` stacking contexts,
 *    so the site nav (deliberately layered above page content for
 *    its dropdowns) floated OVER the overlay — header visible over
 *    long reviews, ✕ colliding with the avatar dropdown.
 *  - Right-edge action rail on review/post cards: heart (optimistic
 *    like, same endpoints as LikeButton/PostLikeButton), comments,
 *    open — replaces the old bottom "Open →" chip.
 *  - Post videos are TAP-TO-PLAY: thumbnail with a big ▶, tapping
 *    mounts the YouTube/TikTok embed; swiping the card mostly out of
 *    view unmounts it (IntersectionObserver) so audio never leaks
 *    into the next channel.
 *  - Enter/exit: fade + slight zoom (surf-anim-in/out in globals).
 *  - Swipe-down on a card that's scrolled to its top exits, like
 *    every native fullscreen surface. Esc and ✕ still work.
 *
 * Purely presentational: cards come pre-ranked from lib/taste.ts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { TunedItem } from "@/lib/taste";
import { getRatingHex, formatRating } from "@/lib/rating";
import { hapticTap } from "@/lib/native";

/** Only https:// or local /path images (stored-XSS defense). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

const EXIT_ANIM_MS = 170;

/* ─── Fullscreen action rail ─── */

const railBtnClass =
  "w-11 h-11 rounded-full border border-white/15 bg-black/50 flex items-center justify-center text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-colors";

/** Vertical heart — optimistic toggle against the same endpoints the
    feed like buttons use. */
function RailLike({
  kind,
  id,
  initialCount,
  initialLiked,
}: {
  kind: "review" | "post";
  id: string;
  initialCount: number;
  initialLiked: boolean;
}) {
  const { user } = useAuth();
  const router = useRouter();
  const [liked, setLiked] = useState(initialLiked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (pending) return;
    hapticTap();
    const prevLiked = liked;
    const prevCount = count;
    setLiked(!prevLiked);
    setCount(prevCount + (prevLiked ? -1 : 1));
    setPending(true);
    try {
      const res = await fetch(
        `/api/${kind === "review" ? "reviews" : "posts"}/${id}/like`,
        { method: "POST" },
      );
      if (!res.ok) throw new Error("like failed");
      const data = (await res.json()) as { liked: boolean; count: number };
      setLiked(data.liked);
      setCount(data.count);
    } catch {
      setLiked(prevLiked);
      setCount(prevCount);
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-label={liked ? "Unlike" : "Like"}
        className={`${railBtnClass} ${liked ? "!text-accent-rose !border-accent-rose/60" : ""}`}
      >
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5"
          fill={liked ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 20.5 4.7 13a4.8 4.8 0 0 1 0-6.8 4.7 4.7 0 0 1 6.7 0l.6.6.6-.6a4.7 4.7 0 0 1 6.7 0 4.8 4.8 0 0 1 0 6.8L12 20.5z" />
        </svg>
      </button>
      <span className="pixel-text text-xs text-text-secondary tabular-nums">
        {count}
      </span>
    </span>
  );
}

/* ─── One full-frame card ─── */

/**
 * Two reading modes (Luca 2026-08-22):
 *   - In the page pager, the whole card is ONE link and the words are
 *     clamped — it's a teaser row among other home-page sections.
 *   - In FULLSCREEN the card is the destination: the full review/post
 *     text renders right on the card (scrollable when long, no clamp),
 *     the action rail carries like/comments/open, and post videos
 *     play in place.
 */
function SurfCard({
  item,
  fullscreen,
}: {
  item: TunedItem;
  fullscreen: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  // Posts without a tied release fall back to the video's thumbnail
  // (YouTube serves one per id; TikTok doesn't, so those show the icon).
  const cover =
    safeImage(item.cover_image) ??
    (item.type === "post" && item.video_kind === "youtube" && item.video_id
      ? `https://i.ytimg.com/vi/${item.video_id}/hqdefault.jpg`
      : null);
  const href =
    item.type === "review"
      ? `/reviews/${item.slug}`
      : item.type === "post"
        ? `/posts/${item.slug}`
        : item.type === "debate"
          ? `/debates/${item.slug}`
          : `/releases/${item.slug}`;

  const typeLabel =
    item.type === "review"
      ? "REVIEW"
      : item.type === "post"
        ? "POST"
        : item.type === "debate"
          ? "DEBATE"
          : "RELEASE";

  const hasVideo =
    item.type === "post" && !!item.video_kind && !!item.video_id;

  // A playing embed must stop when its card leaves the frame — audio
  // bleeding over the next channel is the one unforgivable bug here.
  useEffect(() => {
    if (!playing) return;
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.intersectionRatio < 0.5) setPlaying(false);
      },
      { threshold: 0.5 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [playing]);

  // Leaving fullscreen kills playback too.
  useEffect(() => {
    if (!fullscreen) setPlaying(false);
  }, [fullscreen]);

  const frameClass =
    "relative block w-full h-full snap-start snap-always overflow-hidden group";

  const inner = (
    <>
      {/* Blurred cover as the backdrop, dimmed for legibility. */}
      {cover && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-30"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

      {/* Foreground — fullscreen reserves the right edge for the rail */}
      <div
        className={`relative h-full flex flex-col items-center justify-center gap-3 p-5 text-center ${
          fullscreen ? "pr-16" : ""
        }`}
      >
        <span className="pixel-text text-[10px] uppercase px-1.5 py-px rounded border border-border-medium text-text-muted">
          {typeLabel}
        </span>

        {/* Posts lead with the person too — their transmission */}
        {item.type === "post" && (
          <span className="flex items-center gap-2.5">
            {safeImage(item.avatar_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeImage(item.avatar_url)!}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-white/10"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase">
                {(item.username || "U")[0]}
              </span>
            )}
            <span className="text-sm text-text-secondary">
              <span className="font-bold text-text-primary">
                {item.display_name || item.username}
              </span>{" "}
              posted
              {item.video_kind && (
                <span className="text-text-muted">
                  {" "}
                  · ▶ {item.video_kind === "youtube" ? "YouTube" : "TikTok"}
                </span>
              )}
            </span>
          </span>
        )}

        {/* Reviews lead with the person: avatar + name above the work */}
        {item.type === "review" && (
          <span className="flex items-center gap-2.5">
            {safeImage(item.avatar_url) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={safeImage(item.avatar_url)!}
                alt=""
                className="w-8 h-8 rounded-full object-cover border border-white/10"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase">
                {(item.username || "U")[0]}
              </span>
            )}
            <span className="text-sm text-text-secondary">
              <span className="font-bold text-text-primary">
                {item.display_name || item.username}
              </span>{" "}
              rated it{" "}
              <span
                className="font-bold tabular-nums"
                style={{ color: getRatingHex(item.rating) }}
              >
                {formatRating(item.rating)}
              </span>
            </span>
          </span>
        )}

        {/* The picture slot: playing embed > tappable video poster >
            plain poster. Embeds exist only in fullscreen. */}
        {fullscreen && hasVideo && playing && item.type === "post" ? (
          item.video_kind === "youtube" ? (
            <span className="block w-full max-w-md aspect-video rounded-lg overflow-hidden border border-border-subtle bg-black shrink-0">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${item.video_id}?autoplay=1&playsinline=1`}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="w-full h-full"
              />
            </span>
          ) : (
            <span className="block w-full max-w-[280px] flex-shrink min-h-0 rounded-lg overflow-hidden border border-border-subtle bg-black">
              <iframe
                src={`https://www.tiktok.com/embed/v2/${item.video_id}`}
                title={item.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                referrerPolicy="strict-origin-when-cross-origin"
                allowFullScreen
                className="w-full h-[420px] max-h-full"
              />
            </span>
          )
        ) : (
          <span
            className={`poster shrink-0 relative ${
              (item.type === "review" || item.type === "post") && item.body
                ? "w-28 sm:w-32" /* smaller cover — their words get the room */
                : "w-40 sm:w-48"
            }`}
          >
            {cover ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={cover} alt={`${item.title} cover`} />
            ) : (
              <span className="w-full h-full flex items-center justify-center text-5xl">
                {item.type === "debate" ? "🎙️" : item.type === "post" ? "📺" : "💿"}
              </span>
            )}
            {item.type === "review" && (
              <span
                className="poster-rating"
                style={{ color: getRatingHex(item.rating) }}
              >
                {formatRating(item.rating)}
              </span>
            )}
            {item.type === "release" && item.is_unreleased && (
              <span className="poster-unreleased">UNRELEASED</span>
            )}
            {/* Tap-to-play (fullscreen only): big ▶ over the poster */}
            {fullscreen && hasVideo && (
              <button
                type="button"
                onClick={() => {
                  hapticTap();
                  setPlaying(true);
                }}
                aria-label="Play video"
                className="absolute inset-0 flex items-center justify-center bg-black/35 hover:bg-black/20 transition-colors"
              >
                <span className="w-14 h-14 rounded-full bg-black/70 border border-white/30 flex items-center justify-center text-2xl text-white pl-1">
                  ▶
                </span>
              </button>
            )}
          </span>
        )}

        <span className="block max-w-md space-y-1">
          <span className="block text-lg sm:text-xl font-bold text-text-primary font-[family-name:var(--font-heading)] leading-snug group-hover:text-accent-primary transition-colors">
            {item.title}
          </span>
          <span className="block text-sm text-text-secondary">
            {item.type === "review" && item.artist}
            {item.type === "debate" && (
              <>
                {item.side_a_label} vs {item.side_b_label} · {item.activity} in
                the arena
              </>
            )}
            {item.type === "release" && item.artist}
          </span>
          {item.reason && (
            <span className="block text-xs text-accent-primary/80 pt-0.5">
              ◈ {item.reason}
            </span>
          )}
        </span>

        {/* The words themselves, right on the card. Pager mode clamps
            them (teaser); fullscreen shows EVERYTHING. Long reads get
            the reading treatment — left-aligned, scrolling inside
            their own box (when that inner scroll runs out, the swipe
            chains to the pager and flips the channel, TikTok-style).
            SHORT reviews stay centered like the rest of the card. */}
        {(item.type === "review" || item.type === "post") && item.body && (
          <span
            className={`block max-w-md text-sm text-text-secondary leading-relaxed whitespace-pre-line ${
              fullscreen
                ? item.body.length > 280
                  ? "w-full flex-shrink min-h-0 overflow-y-auto text-left px-1 [scrollbar-width:thin]"
                  : "text-center"
                : "line-clamp-4 sm:line-clamp-6"
            }`}
          >
            {item.body}
          </span>
        )}
      </div>

      {/* Action rail — fullscreen only. Heart + comments on cards
          that support them; every card gets "open the page". */}
      {fullscreen && (
        <div className="absolute right-2.5 bottom-16 z-10 flex flex-col items-center gap-4">
          {(item.type === "review" || item.type === "post") && (
            <>
              <RailLike
                kind={item.type}
                id={item.id}
                initialCount={item.like_count}
                initialLiked={item.viewer_has_liked}
              />
              <Link
                href={`${href}#comments`}
                onClick={() => hapticTap()}
                aria-label="Comments"
                className={railBtnClass}
              >
                <svg
                  viewBox="0 0 24 24"
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z" />
                </svg>
              </Link>
            </>
          )}
          <Link
            href={href}
            onClick={() => hapticTap()}
            aria-label={`Open ${typeLabel.toLowerCase()}`}
            className={railBtnClass}
          >
            <svg
              viewBox="0 0 24 24"
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M7 17 17 7M9 7h8v8" />
            </svg>
          </Link>
        </div>
      )}
    </>
  );

  // Fullscreen = a reading surface (links are explicit); pager = one
  // big click-through.
  return fullscreen ? (
    <div ref={rootRef} className={frameClass}>
      {inner}
    </div>
  ) : (
    <Link href={href} className={frameClass}>
      {inner}
    </Link>
  );
}

/* ─── The pager frame ─── */

export default function ChannelSurf({ items }: { items: TunedItem[] }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  // Fullscreen "channel" mode — the pager takes the whole screen for
  // the reels/TikTok-style immersion (Luca 2026-08-22). In the app
  // the bottom tab bar stays visible (the fixed frame stops above it
  // — .surf-fullscreen in globals.css), so you're never stuck here.
  const [fullscreen, setFullscreen] = useState(false);
  const [closing, setClosing] = useState(false);
  // Swipe-down-to-exit bookkeeping
  const touchStartY = useRef(0);
  const touchAtTop = useRef(false);

  // Exit plays the fade-out first, then unmounts the portal.
  const close = useCallback(() => {
    setClosing((already) => {
      if (already) return already;
      window.setTimeout(() => {
        setFullscreen(false);
        setClosing(false);
      }, EXIT_ANIM_MS);
      return true;
    });
  }, []);

  const surf = useCallback((dir: 1 | -1) => {
    const el = frameRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * el.clientHeight, behavior: "smooth" });
  }, []);

  // Entering/leaving fullscreen changes the card height — re-align the
  // scroll offset to the card the viewer was on, and freeze the page
  // behind the overlay so only the pager scrolls. Esc backs out.
  useEffect(() => {
    const el = frameRef.current;
    if (el) el.scrollTo({ top: index * el.clientHeight });
    if (!fullscreen) return;
    const prevBody = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevBody;
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullscreen]);

  // Track which card fills the frame (scroll-snap keeps offsets aligned
  // to whole card heights, so simple division is exact enough).
  const handleScroll = useCallback(() => {
    const el = frameRef.current;
    if (!el || el.clientHeight === 0) return;
    setIndex(
      Math.max(0, Math.min(items.length - 1, Math.round(el.scrollTop / el.clientHeight)))
    );
  }, [items.length]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        surf(1);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        surf(-1);
      }
    },
    [surf]
  );

  // Swipe-down exits, but ONLY when the pager is already at its very
  // top (first card, no inner scroll) — otherwise the gesture is just
  // scrolling back up through the channels.
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    touchAtTop.current = (frameRef.current?.scrollTop ?? 1) <= 0;
  }, []);
  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!fullscreen || closing || !touchAtTop.current) return;
      if ((frameRef.current?.scrollTop ?? 1) > 0) return;
      if (e.touches[0].clientY - touchStartY.current > 90) close();
    },
    [fullscreen, closing, close]
  );

  if (items.length === 0) return null;

  const content = (
    <div
      className={
        fullscreen
          ? `surf-fullscreen ${closing ? "surf-anim-out" : "surf-anim-in"}`
          : "panel-xbox relative overflow-hidden"
      }
    >
      {/* Snap frame */}
      <div
        ref={frameRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Tuned to you — scroll for the next pick"
        className={`overflow-y-auto snap-y snap-mandatory focus:outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          fullscreen
            ? "h-full"
            : "h-[70vh] min-h-[420px] max-h-[640px]"
        }`}
      >
        {items.map((item) => (
          <SurfCard
            key={`${item.type}:${item.slug}`}
            item={item}
            fullscreen={fullscreen}
          />
        ))}
      </div>

      {/* Fullscreen toggle — enter for the immersive channel, ✕ out */}
      <button
        type="button"
        onClick={() => (fullscreen ? close() : setFullscreen(true))}
        aria-label={fullscreen ? "Exit fullscreen" : "Fullscreen"}
        className={`absolute right-3 z-10 w-9 h-9 rounded-full border border-border-medium bg-black/50 text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-all flex items-center justify-center ${
          // Fullscreen: clear the notch/status bar in the app shell.
          fullscreen ? "top-[max(0.75rem,env(safe-area-inset-top))]" : "top-3"
        }`}
      >
        {fullscreen ? (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5" />
          </svg>
        )}
      </button>

      {/* Desktop surf buttons — left side in fullscreen so they never
          fight the action rail on the right edge */}
      <div
        className={`absolute bottom-3 hidden sm:flex flex-col gap-1.5 ${
          fullscreen ? "left-3" : "right-3"
        }`}
      >
        <button
          type="button"
          onClick={() => surf(-1)}
          disabled={index === 0}
          aria-label="Previous pick"
          className="w-9 h-9 rounded-full border border-border-medium bg-black/40 text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => surf(1)}
          disabled={index >= items.length - 1}
          aria-label="Next pick"
          className="w-9 h-9 rounded-full border border-border-medium bg-black/40 text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ▼
        </button>
      </div>

      {!fullscreen && <div className="scan-bar" />}
    </div>
  );

  // Fullscreen escapes the page's stacking contexts through a portal —
  // rendered in the page column, the site nav painted OVER the overlay
  // (header visible, ✕ fighting the avatar dropdown).
  return fullscreen ? createPortal(content, document.body) : content;
}
