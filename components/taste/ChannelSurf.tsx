"use client";

/**
 * ChannelSurf — the TUNED TO YOU pager (Luca 2026-08-19: "like how
 * TikTok is formatted").
 *
 * One piece of content fills the frame at a time; the next is a swipe
 * away on touch (CSS scroll-snap does the physics) or a ▼ click /
 * arrow-key press on desktop. A channel readout ("03 / 12") tracks the
 * position — fitting the CRT theme, flipping channels on a TV.
 *
 * Purely presentational: cards come pre-ranked from lib/taste.ts.
 */

import { useCallback, useRef, useState } from "react";
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
  const cover = safeImage(item.cover_image);
  const href =
    item.type === "review"
      ? `/reviews/${item.slug}`
      : item.type === "debate"
        ? `/debates/${item.slug}`
        : `/releases/${item.slug}`;

  const typeLabel =
    item.type === "review"
      ? "REVIEW"
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

        <span className="poster w-40 sm:w-48 shrink-0">
          {cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cover} alt={`${item.title} cover`} />
          ) : (
            <span className="w-full h-full flex items-center justify-center text-5xl">
              {item.type === "debate" ? "🎙️" : "💿"}
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
            {item.type === "review" && (
              <>
                @{item.username} · {item.artist}
              </>
            )}
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
      </div>
    </Link>
  );
}

/* ─── The pager frame ─── */

export default function ChannelSurf({ items }: { items: TunedItem[] }) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  const surf = useCallback((dir: 1 | -1) => {
    const el = frameRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * el.clientHeight, behavior: "smooth" });
  }, []);

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
    <div className="panel-xbox relative overflow-hidden">
      {/* Snap frame */}
      <div
        ref={frameRef}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="region"
        aria-roledescription="carousel"
        aria-label="Tuned to you — scroll for the next pick"
        className="h-[70vh] min-h-[420px] max-h-[640px] overflow-y-auto snap-y snap-mandatory focus:outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <SurfCard key={`${item.type}:${item.slug}`} item={item} />
        ))}
      </div>

      {/* Channel readout */}
      <div className="absolute top-3 right-3 osd-text text-xs tabular-nums pointer-events-none">
        CH {String(index + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
      </div>

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

      <div className="scan-bar" />
    </div>
  );
}
