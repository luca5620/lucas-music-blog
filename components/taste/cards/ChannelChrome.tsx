"use client";

/**
 * ChannelChrome — the shared shell every broadcast card wears
 * (taste overhaul round 3, the broadcast design).
 *
 * ChannelFrame owns the pager (snap, chrome strip, gestures); the
 * four card renderers (CriticSegment / MusicTvCard / OnAirCard /
 * PremiereCard) own their per-type content; THIS component owns what
 * every card shares:
 *
 *  - the BACKDROP: on web phones a dimmed cover (the old per-card
 *    blur-2xl copies are gone — CSS blur per card was real GPU cost);
 *    on desktop the blurred cover stays, plus a static scanline
 *    texture; in the app nothing (the frame plays ONE hardware-decoded
 *    ambient loop behind all cards instead).
 *  - the COLOR WEATHER tint: one static radial glow in the card's own
 *    color — cover dominant color via the CoverLiquidSync extraction
 *    path (cached per URL at module level, so twelve cards never run
 *    thirteen canvases), with honest fallbacks and two hard overrides
 *    (debates are RED — on air; unreleased premieres are AMBER).
 *  - the FORMAT CHIP (CRITIC SEGMENT / MUSIC TV / ON AIR / PREMIERE).
 *  - the CONTENT COLUMN geometry: pt clears the chrome strip AND the
 *    Dynamic Island (safe-area-inset-top + 56px), pr-16 clears the
 *    action rail, pb clears the home indicator.
 *  - the ACTION RAIL slot at right-3 (each card passes its own
 *    buttons) plus the shared rail widgets (RailLike etc).
 *
 * The card contract: every card receives { item, active, near,
 * onOpenComments } — media may MOUNT only when `near` (index ±1) and
 * PLAY only when `active` (the settled card). This file also exports
 * the tiny shared helpers (safeImage, toSpotifyEmbed, TuningSlot) so
 * the four cards and the frame agree on one implementation.
 */

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/AuthProvider";
import type { TunedItem } from "@/lib/taste";
import { getRatingHex } from "@/lib/rating";
import { hapticImpact, hapticTap, isNativeApp } from "@/lib/native";
import { useLikeState } from "@/lib/likeStore";
import { extractTrio } from "@/components/ui/CoverLiquidSync";
import { smallCover, thumbCover } from "@/lib/images";
import { VerifiedBadge } from "@/components/ui/RoleBadge";

/* ─── The card contract ─── */

/** Narrow a TunedItem to one type ("review" → the review variant). */
export type TunedItemOf<T extends TunedItem["type"]> = Extract<
  TunedItem,
  { type: T }
>;

/** What ChannelFrame hands every card. Media mounts only when `near`
    (settled index ±1) and plays only when `active` (THE settled
    card) — that windowing is the whole audio-hygiene model: nothing
    beyond ±1 exists, so nothing beyond ±1 can make noise. */
export interface CardProps<T extends TunedItem["type"]> {
  item: TunedItemOf<T>;
  active: boolean;
  near: boolean;
  /** Reviews only — opens the comments sheet without leaving the
      channel. */
  onOpenComments?: () => void;
}

/* ─── Shared helpers (one implementation, many consumers) ─── */

/** Only https:// or local /path images (stored-XSS defense). */
export function safeImage(url: string | null): string | null {
  if (!url) return null;
  return url.startsWith("https://") || url.startsWith("/") ? url : null;
}

/** open.spotify.com/track|album/ID → the matching /embed/ player URL
    (theme=0 = dark, same as the release page's SpotifyEmbed). Null
    for any other shape — those cards keep the plain external link. */
export function toSpotifyEmbed(url: string): string | null {
  const m = url.match(
    /^https:\/\/open\.spotify\.com\/(track|album)\/([A-Za-z0-9]+)/
  );
  return m ? `https://open.spotify.com/embed/${m[1]}/${m[2]}?theme=0` : null;
}

/** The broadcast-format chip per content type — TV language, not
    database language. Same strings as the lobby's EPG rows. */
export const FORMAT_LABEL: Record<TunedItem["type"], string> = {
  review: "CRITIC SEGMENT",
  post: "MUSIC TV",
  debate: "ON AIR",
  release: "PREMIERE",
};

/** "3m ago" / "5h ago" / "2d ago" — the chyron's REC stamp. Same
    shape as the per-feed copies (PostsFeed, CommentsSection, …);
    ONE copy here so all four broadcast cards agree on the phrasing. */
export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

/** Where each card's "open" rail arrow goes. */
export function hrefOf(item: TunedItem): string {
  switch (item.type) {
    case "review":
      return `/reviews/${item.slug}`;
    case "post":
      return `/posts/${item.slug}`;
    case "debate":
      return `/debates/${item.slug}`;
    case "release":
      return `/releases/${item.slug}`;
  }
}

/* ─── Color weather ─── */

/* Module-level dominant-color cache, keyed by cover URL. Extraction
   runs ONCE per URL per page load no matter how many cards (or
   re-mounts) ask — the in-flight map dedupes concurrent asks too. */
const tintCache = new Map<string, string | null>();
const tintInflight = new Map<string, Promise<string | null>>();

/** Dominant cover color as an "r, g, b" triplet string, or null when
    extraction can't run (no CORS headers — some Genius covers — or a
    broken image). Rides CoverLiquidSync's extractTrio: same 32×32
    canvas, same saturation-weighted bucketing, first pick wins. */
function extractDominant(url: string): Promise<string | null> {
  const cached = tintCache.get(url);
  if (cached !== undefined) return Promise.resolve(cached);
  let p = tintInflight.get(url);
  if (!p) {
    p = new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous"; // ask the CDN for readable pixels
      img.onload = () => resolve(extractTrio(img)?.[0] ?? null);
      img.onerror = () => resolve(null); // fail-soft: fallback color
      img.src = url;
    }).then((v) => {
      tintCache.set(url, v);
      tintInflight.delete(url);
      return v;
    });
    tintInflight.set(url, p);
  }
  return p;
}

/** Hard-override / fallback tint per card, as a CSS color WITH alpha.
    Overrides come first (they're editorial, not decorative): debates
    glow red (they're ON AIR), unreleased premieres glow amber (the
    site-wide "not out yet" color). Extraction fills the rest; when it
    fails, reviews glow their rating's color and everything else glows
    the profile accent — never a colorless card. */
function useCardTint(item: TunedItem, near: boolean): string {
  // Extract from the 64px thumb variant: the sampler downscales to a
  // 32×32 canvas anyway, so the 640px original is pure wasted bytes —
  // and the thumb is often already in the HTTP cache from the lobby's
  // EPG rows. (Non-Spotify URLs pass through thumbCover untouched.)
  const cover = thumbCover(safeImage(item.cover_image));
  const [extracted, setExtracted] = useState<string | null>(() =>
    cover ? (tintCache.get(cover) ?? null) : null
  );

  // Extraction is part of the ±1 media window: shells beyond it don't
  // spend a canvas (or a network fetch) on a tint nobody can see.
  useEffect(() => {
    if (!near || !cover) return;
    let cancelled = false;
    extractDominant(cover).then((v) => {
      if (!cancelled) setExtracted(v);
    });
    return () => {
      cancelled = true;
    };
  }, [near, cover]);

  // Debates: RED, always — the on-air light wins over the cover.
  if (item.type === "debate") return "rgba(255, 45, 45, 0.30)";
  // Unreleased premieres: AMBER takeover (matches --osd-amber).
  if (item.type === "release" && item.is_unreleased)
    return "rgba(255, 176, 47, 0.28)";
  if (extracted) return `rgba(${extracted}, 0.30)`;
  // Fallbacks: the rating's own color for reviews, accent otherwise.
  if (item.type === "review") return `${getRatingHex(item.rating)}44`;
  return "rgba(var(--accent-rgb), 0.26)";
}

/* ─── Chyron + role chip (shared card chrome) ─── */

/**
 * The lower-third CHYRON — broadcast news' name bar, reused as every
 * card's author line. Cards compose the middle (name, PRESENTED BY,
 * badges…) as children; `right` is the trailing slot (the REC
 * timestamp, usually). Avatar falls back to the initial-letter disc
 * the feeds use everywhere else.
 */
export function Chyron({
  avatarUrl,
  letter,
  right,
  children,
}: {
  avatarUrl: string | null;
  /** First letter of the username — the no-avatar fallback disc. */
  letter: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  const avatar = safeImage(avatarUrl);
  return (
    <span className="cf-chyron max-w-md">
      {avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbCover(avatar)}
          alt=""
          loading="lazy"
          decoding="async"
          className="w-8 h-8 rounded-full object-cover border border-white/10 shrink-0"
        />
      ) : (
        <span className="w-8 h-8 rounded-full bg-accent-primary/20 border border-accent-primary/30 inline-flex items-center justify-center text-xs font-bold text-accent-primary uppercase shrink-0">
          {letter}
        </span>
      )}
      <span className="flex flex-col items-start text-left min-w-0">
        {children}
      </span>
      {right && <span className="shrink-0 pl-1.5">{right}</span>}
    </span>
  );
}

/**
 * "PEAK CRITIC" — the on-air credential for verified voices. Only
 * reviewer/admin/owner earn it (matching the roles VerifiedBadge
 * glows for); plain users and unknown role strings render nothing —
 * an absent credential, never a fake one.
 */
export function RoleChip({ role }: { role: string | null }) {
  if (role !== "reviewer" && role !== "admin" && role !== "owner") return null;
  return (
    <span className="inline-flex items-center gap-1.5">
      <VerifiedBadge role={role} />
      <span className="label-xbox !text-[0.55rem] !px-1.5 !py-0.5">
        PEAK CRITIC
      </span>
    </span>
  );
}

/* ─── Rail widgets ─── */

export const railBtnClass =
  "w-11 h-11 rounded-full border border-white/15 bg-black/50 flex items-center justify-center text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-colors";

/** Vertical heart — optimistic toggle against the same endpoints the
    feed like buttons use. State lives in the shared like store
    (lib/likeStore.ts), so this heart and any LikeButton/PostLikeButton
    showing the same content stay in lockstep within a page visit. */
export function RailLike({
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
  // Seed from server props (first writer wins), subscribe, and write
  // optimistically through the store instead of private useState.
  const { liked, count, write } = useLikeState(
    kind,
    id,
    initialLiked,
    initialCount
  );
  // In-flight guard stays per button — it throttles this button's own
  // fetch, not the shared state.
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (pending) return;
    // MEDIUM: liking is a deliberate act in the haptic vocabulary.
    hapticImpact("MEDIUM");
    const prevLiked = liked;
    const prevCount = count;
    write({ liked: !prevLiked, count: prevCount + (prevLiked ? -1 : 1) });
    setPending(true);
    try {
      const res = await fetch(
        `/api/${kind === "review" ? "reviews" : "posts"}/${id}/like`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("like failed");
      const data = (await res.json()) as { liked: boolean; count: number };
      write({ liked: data.liked, count: data.count }); // server truth
    } catch {
      write({ liked: prevLiked, count: prevCount }); // rollback
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

/** The comments bubble (reviews only). */
export function RailComments({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        hapticTap();
        onClick();
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
  );
}

/** The "open the page" arrow — every card's escape hatch to the real
    destination. `caption` puts a pixel label under the button (the
    MusicTv card's "FULL POST" — the arrow alone undersells that the
    whole post lives elsewhere). */
export function RailOpen({
  href,
  label,
  caption,
}: {
  href: string;
  label: string;
  caption?: string;
}) {
  const btn = (
    <Link
      href={href}
      onClick={() => hapticTap()}
      aria-label={`Open ${label}`}
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
  );
  if (!caption) return btn;
  return (
    <span className="flex flex-col items-center gap-1">
      {btn}
      <span className="pixel-text text-[9px] uppercase tracking-widest text-text-secondary">
        {caption}
      </span>
    </span>
  );
}

/**
 * 📡 TRACK — the Premiere card's follow-this-release button, wired to
 * the SAME toggle endpoint the release page uses (no new API routes).
 * Optimistic like RailLike: flip immediately, reconcile with the
 * server's answer, roll back on failure. Initial state is honestly
 * "not tracking" — the mix engine EXCLUDES releases the viewer
 * already follows (interactedReleaseIds), so a release on a card is
 * by construction one the viewer doesn't track yet.
 */
export function RailTrack({ releaseId }: { releaseId: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tracking, setTracking] = useState(false);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    if (!user) {
      router.push("/login");
      return;
    }
    if (pending) return;
    // MEDIUM: following a release is a deliberate act (WP4 vocabulary).
    hapticImpact("MEDIUM");
    const prev = tracking;
    setTracking(!prev); // optimistic flip
    setPending(true);
    try {
      const res = await fetch(`/api/releases/${releaseId}/follow`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("follow failed");
      const data = (await res.json()) as { following: boolean };
      setTracking(data.following); // server truth
    } catch {
      setTracking(prev); // rollback — the button never lies
    } finally {
      setPending(false);
    }
  };

  return (
    <span className="flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={tracking}
        aria-label={tracking ? "Stop tracking release" : "Track release"}
        className={`${railBtnClass} text-base ${
          tracking ? "!text-accent-primary !border-accent-primary/70" : ""
        }`}
      >
        📡
      </button>
      <span
        className={`pixel-text text-[9px] uppercase tracking-widest ${
          tracking ? "text-accent-primary" : "text-text-secondary"
        }`}
      >
        {tracking ? "TRACKED" : "TRACK"}
      </span>
    </span>
  );
}

/** The TUNING… skeleton that fills an embed slot until its iframe
    paints (see .tuning-slot in globals.css). Absolute inside the
    slot, so mounting the iframe underneath never shifts layout. */
export function TuningSlot() {
  return (
    <span className="tuning-slot" aria-hidden="true">
      <span className="tv-noise" />
      <span className="tuning-label">TUNING…</span>
    </span>
  );
}

/* ─── The chrome itself ─── */

export default function ChannelChrome({
  item,
  near,
  rail,
  chipExtra,
  children,
}: {
  item: TunedItem;
  near: boolean;
  /** The card's rail buttons, rendered in the shared right-3 slot. */
  rail?: React.ReactNode;
  /** Extra chip(s) beside the format chip — MusicTv's "▶ YOUTUBE". */
  chipExtra?: React.ReactNode;
  children: React.ReactNode;
}) {
  const tint = useCardTint(item, near);
  const cover = safeImage(item.cover_image);

  // App shell: the frame plays ONE hardware-decoded ambient loop
  // behind ALL cards, so each card skips its own cover backdrop and
  // keeps only the tint. Bridge check must wait for mount (same
  // pattern as TabBar) — SSR has no window.Capacitor.
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    setAmbient(isNativeApp());
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* BACKDROP — cover art, windowed at ±1 like all media.
          Phones: dimmed, UNBLURRED (the old blur-2xl per card was
          real GPU cost for something behind a scrim — deleted).
          Desktop (sm+): the blurred wash stays, it reads great and
          desktops have the budget. App: nothing, ambient loop. */}
      {cover && !ambient && near && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          // 300px variant: this paints dimmed (and blurred on desktop)
          // behind a scrim — the 640px original is invisible extra MB.
          src={smallCover(cover)}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover opacity-20 sm:opacity-30 sm:blur-2xl sm:scale-110"
        />
      )}

      {/* COLOR WEATHER — one static radial tint in the card's color.
          Sits over the backdrop (and over the app's ambient loop),
          under the scrim. Pure gradient + opacity: thermal-free. */}
      {near && (
        <div
          className="absolute inset-0 pointer-events-none"
          aria-hidden="true"
          style={{
            background: `radial-gradient(90% 65% at 50% 30%, ${tint}, transparent 72%)`,
          }}
        />
      )}

      {/* Desktop-only static scanline texture (see .cf-scanlines —
          display:none under the app's thermal rules). */}
      <div className="cf-scanlines hidden sm:block" aria-hidden="true" />

      {/* Legibility scrim — text always wins over the pretty layers */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-black/60" />

      {/* CONTENT COLUMN — safe-area aware: top clears the chrome
          strip + Dynamic Island, right clears the action rail (which
          hangs over this padding), bottom clears the home indicator.
          (In the app .surf-fullscreen already stops above the tab
          bar, so bottom only needs the web-PWA inset.) */}
      <div className="relative h-full flex flex-col items-center justify-center gap-3 text-center pl-5 pr-16 pt-[calc(env(safe-area-inset-top)_+_56px)] pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        {/* Format chip — the broadcast's genre sticker (+ any
            card-supplied companion chip, e.g. "▶ YOUTUBE") */}
        <span className="flex items-center justify-center gap-2 flex-wrap">
          <span className="label-xbox">{FORMAT_LABEL[item.type]}</span>
          {chipExtra}
        </span>
        {children}
      </div>

      {/* ACTION RAIL — right-3 (the old right-2.5 left the buttons
          2px from the glass edge), bottom clears home indicator. */}
      {rail && (
        <div className="absolute right-3 bottom-[calc(env(safe-area-inset-bottom)_+_4rem)] z-10 flex flex-col items-center gap-4">
          {rail}
        </div>
      )}
    </div>
  );
}
