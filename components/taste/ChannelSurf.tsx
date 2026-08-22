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
 * Purely presentational: cards come pre-ranked from lib/taste.ts.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { TunedItem } from "@/lib/taste";
import { getRatingHex, formatRating } from "@/lib/rating";

/** Only https:// or local /path images (stored-XSS defense). */
function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

/* ─── One full-frame card ─── */

function SurfCard({ item }: { item: TunedItem }) {
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

  return (
    <Link
      href={href}
      className="relative block w-full h-full snap-start snap-always overflow-hidden group"
    >
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

      {/* Foreground */}
      <div className="relative h-full flex flex-col items-center justify-center gap-3 p-5 text-center">
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

        <span
          className={`poster shrink-0 ${
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
        </span>

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

        {/* The words themselves, right on the card — clamped to fit
            the frame; the full page is one click away */}
        {(item.type === "review" || item.type === "post") && item.body && (
          <span className="block max-w-md text-sm text-text-secondary leading-relaxed whitespace-pre-line line-clamp-4 sm:line-clamp-6">
            {item.body}
          </span>
        )}
      </div>
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
      if (e.key === "Escape") setFullscreen(false);
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

  if (items.length === 0) return null;

  return (
    <div
      className={
        fullscreen
          ? "surf-fullscreen"
          : "panel-xbox relative overflow-hidden"
      }
    >
      {/* Snap frame */}
      <div
        ref={frameRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
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
          <SurfCard key={`${item.type}:${item.slug}`} item={item} />
        ))}
      </div>

      {/* Fullscreen toggle — enter for the immersive channel, ✕ out */}
      <button
        type="button"
        onClick={() => setFullscreen((f) => !f)}
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

      {/* Desktop surf buttons */}
      <div className="absolute bottom-3 right-3 hidden sm:flex flex-col gap-1.5">
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
}
