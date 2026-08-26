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
import { hapticTap, isNativeApp } from "@/lib/native";
import CommentsSection from "@/components/reviews/CommentsSection";
import BackdropVideo from "@/components/profile/BackdropVideo";

/** Only https:// or local /path images (stored-XSS defense). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

/** open.spotify.com/track|album/ID → the matching /embed/ player URL
    (theme=0 = dark, same as the release page's SpotifyEmbed). Null
    for any other shape — those cards keep the plain external link. */
function toSpotifyEmbed(url: string): string | null {
  const m = url.match(
    /^https:\/\/open\.spotify\.com\/(track|album)\/([A-Za-z0-9]+)/
  );
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?theme=0` : null;
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
  ambient,
  onOpenComments,
}: {
  item: TunedItem;
  fullscreen: boolean;
  /** App shell: the pager plays one hardware-decoded ambient video
      behind ALL cards, so each card skips its own CSS-blurred cover
      backdrop (blur-2xl per card was real GPU cost on phones). */
  ambient?: boolean;
  /** Opens the in-place comments sheet (reviews only). */
  onOpenComments?: () => void;
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

  // Spotify embed on review/release cards: no tap-to-load (Luca
  // 2026-08-26 — the embed has its own play button, a pill first is
  // a double press). Instead the player mounts while the card fills
  // the frame and unmounts as it leaves — unmounting is what stops
  // the audio when you swipe to the next channel.
  const wantsEmbed =
    fullscreen &&
    (item.type === "review" || item.type === "release") &&
    !!item.spotify_url &&
    !!toSpotifyEmbed(item.spotify_url);
  const [embedLive, setEmbedLive] = useState(false);
  useEffect(() => {
    if (!wantsEmbed) {
      setEmbedLive(false);
      return;
    }
    const el = rootRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => setEmbedLive(entry.intersectionRatio >= 0.5),
      { threshold: [0.5] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [wantsEmbed]);

  const frameClass =
    "relative block w-full h-full snap-start snap-always overflow-hidden group";

  const inner = (
    <>
      {/* Blurred cover as the backdrop, dimmed for legibility. In the
          app the shared ambient video plays instead (see ambient). */}
      {cover && !ambient && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={cover}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-30"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

      {/* Foreground — fullscreen pads BOTH sides equally (the rail
          hangs over the right padding) so content stays visually
          centered; pr-only shoved everything left (Luca 2026-08-22). */}
      <div
        className={`relative h-full flex flex-col items-center justify-center gap-3 text-center ${
          fullscreen ? "px-14 py-5" : "p-5"
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

        {/* Release synopsis — manual → Genius → Wikipedia (enriched in
            lib/taste.ts for the picked cards). The blurb IS the pitch
            to check the release out (Luca 2026-08-22). */}
        {item.type === "release" && item.description && (
          <>
            <span
              className={`block max-w-md text-sm text-text-secondary leading-relaxed whitespace-pre-line ${
                fullscreen
                  ? item.description.length > 280
                    ? "w-full flex-shrink min-h-0 overflow-y-auto text-left px-1 [scrollbar-width:thin]"
                    : "text-center"
                  : "line-clamp-3 sm:line-clamp-4"
              }`}
            >
              {item.description}
            </span>
            {fullscreen && item.description_source && item.description_source !== "manual" && (
              item.description_url ? (
                <a
                  href={item.description_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pixel-text text-[10px] uppercase tracking-widest text-text-muted hover:text-accent-primary transition-colors shrink-0"
                >
                  via {item.description_source === "genius" ? "Genius" : "Wikipedia"} ↗
                </a>
              ) : (
                <span className="pixel-text text-[10px] uppercase tracking-widest text-text-muted shrink-0">
                  via {item.description_source === "genius" ? "Genius" : "Wikipedia"}
                </span>
              )
            )}
          </>
        )}

        {/* Straight to the music — Spotify's compact player, mounted
            automatically while the card is on screen (see the
            embedLive observer above; the same sanctioned embed the
            release page uses). The fixed-height slot stays put so
            mount/unmount never shifts the card's layout. URLs that
            don't map to an embed keep the old external link.
            Fullscreen only; the pager card is one big link to the
            item's page. */}
        {fullscreen &&
          (item.type === "review" || item.type === "release") &&
          item.spotify_url &&
          (wantsEmbed ? (
            <div className="w-full max-w-md h-[152px] shrink-0">
              {embedLive && (
                <iframe
                  src={toSpotifyEmbed(item.spotify_url)!}
                  width="100%"
                  height={152}
                  frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media"
                  title={`Spotify preview of ${item.title}`}
                  className="w-full rounded-lg"
                />
              )}
            </div>
          ) : (
            <a
              href={item.spotify_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => hapticTap()}
              className="shrink-0 inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-[#1DB954]/50 bg-[#1DB954]/10 text-[#1DB954] hover:bg-[#1DB954]/20 transition-colors text-xs font-bold uppercase tracking-wider font-[family-name:var(--font-heading)]"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                <path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm4.6 14.5a.62.62 0 0 1-.86.2c-2.36-1.44-5.33-1.77-8.82-.97a.62.62 0 1 1-.28-1.21c3.82-.88 7.1-.5 9.75 1.12.3.18.39.57.21.86zm1.23-2.73a.78.78 0 0 1-1.07.26c-2.7-1.66-6.82-2.14-10.01-1.17a.78.78 0 1 1-.45-1.49c3.65-1.11 8.18-.57 11.28 1.33.36.22.48.7.25 1.07zm.1-2.85C14.7 9 9.35 8.82 6.26 9.76a.93.93 0 1 1-.54-1.79c3.55-1.08 9.45-.87 13.18 1.34a.93.93 0 0 1-.95 1.6z" />
              </svg>
              Listen on Spotify
            </a>
          ))}
      </div>

      {/* Action rail — fullscreen only. Heart + comments on cards
          that support them; every card gets "open the page". */}
      {fullscreen && (
        <div className="absolute right-2.5 bottom-16 z-10 flex flex-col items-center gap-4">
          {(item.type === "review" || item.type === "post") && (
            <RailLike
              kind={item.type}
              id={item.id}
              initialCount={item.like_count}
              initialLiked={item.viewer_has_liked}
            />
          )}
          {/* Comments open IN PLACE (bottom sheet, read + write)
              without leaving the channel — a redirect here just
              duplicated the open button (Luca 2026-08-22). Reviews
              only; posts have no comment system. */}
          {item.type === "review" && onOpenComments && (
            <button
              type="button"
              onClick={() => {
                hapticTap();
                onOpenComments();
              }}
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
            </button>
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
  // The review whose comments sheet is open (fullscreen only).
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  // App shell only: swap the per-card CSS-blurred cover backdrops for
  // ONE hardware-decoded ambient loop behind the whole pager
  // (public/backdrops/taste.mp4 — the molten liquid, rendered as
  // video). Same trick TikTok leans on: the rich layer is a video
  // the decoder chip plays for near-zero GPU/CPU. Bridge check must
  // wait for mount, same pattern as TabBar.
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    setAmbient(isNativeApp());
  }, []);
  const commentsForRef = useRef<string | null>(null);
  commentsForRef.current = commentsFor;
  // Swipe-down-to-exit bookkeeping
  const touchStartY = useRef(0);
  const touchAtTop = useRef(false);

  // Exit plays the fade-out first, then unmounts the portal.
  const close = useCallback(() => {
    setCommentsFor(null);
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
      if (e.key !== "Escape") return;
      // Esc peels one layer at a time: sheet first, then fullscreen.
      if (commentsForRef.current) setCommentsFor(null);
      else close();
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
      {/* App-only ambient: the molten liquid as a looping video the
          hardware decoder plays behind every card. */}
      {ambient && (
        <div className="absolute inset-0" aria-hidden="true">
          <BackdropVideo theme="taste" />
        </div>
      )}

      {/* Snap frame — `relative` so it stacks above the ambient video */}
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
        className={`relative overflow-y-auto snap-y snap-mandatory focus:outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
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
            ambient={ambient}
            onOpenComments={
              item.type === "review"
                ? () => setCommentsFor(item.id)
                : undefined
            }
          />
        ))}
      </div>

      {/* Comments sheet — read AND write without leaving the channel
          (Luca 2026-08-22). Bottom sheet over the pager; backdrop or
          ✕ (or Esc) drops you back exactly where you were. */}
      {fullscreen && commentsFor && (
        <>
          <div
            className="absolute inset-0 z-20 bg-black/60"
            onClick={() => setCommentsFor(null)}
          />
          <div className="absolute inset-x-0 bottom-0 top-[18%] z-30 bg-[#0c0c0f] border-t border-border-medium rounded-t-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 shrink-0">
              <span className="label-xbox">Comments</span>
              <button
                type="button"
                onClick={() => setCommentsFor(null)}
                aria-label="Close comments"
                className="w-8 h-8 rounded-full border border-border-medium text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-colors flex items-center justify-center"
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
              <CommentsSection reviewId={commentsFor} />
            </div>
          </div>
        </>
      )}

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
