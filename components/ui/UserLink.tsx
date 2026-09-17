"use client";

/**
 * UserLink — THE way to link to a member. Renders a normal Next
 * <Link> to /profile/<username> and, on the web with a mouse, opens
 * an Instagram-style hover card after a short pause (Luca's idea,
 * 2026-09-12): avatar, name, role, tagline, the four profile numbers
 * (followers / following / reviews / likes, trophy colours and all),
 * under a mini of their own profile banner (their theme's liquid
 * colours when they have none). Never the theme's name — the card is
 * a small version of how their profile looks, not a label of what
 * they picked (Luca 2026-09-12).
 *
 * Touch never opens it (a tap should just navigate; the app has no
 * hover), and neither does the native shell. Data comes from
 * /api/profile/summary, cached per username for the page's life so
 * hovering the same name twice costs nothing.
 *
 * The card is a fixed-position portal on <body> (username links live
 * inside overflow-clipped panels everywhere) — fine here because it
 * only exists on mouse hover, never with a phone keyboard up.
 */

import Link from "next/link";
import { createPortal } from "react-dom";
import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import { useTranslations } from "next-intl";
import RoleBadge from "@/components/ui/RoleBadge";
import { HeartGlyph, TrophyGlyph } from "@/components/profile/BadgeGlyphs";
import { hiddenBadgeSet, trophyTier } from "@/lib/badges";
import { THEME_SPECS, resolveTheme, themeGradient } from "@/lib/profile-theme";
import { compactCount } from "@/lib/format-count";
import { hapticTap } from "@/lib/native";
import { markClickHandled } from "@/lib/click-intent";
import type { Profile, ProfileStats } from "@/lib/types/database";

interface Summary {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  role: Profile["role"];
  theme: string;
  tagline: string | null;
  hidden_badges: string[] | null;
  stats: ProfileStats;
}

/* One fetch per username per page life. A failed fetch is forgotten
   so a later hover can retry. */
const cache = new Map<string, Promise<Summary | null>>();
function loadSummary(username: string): Promise<Summary | null> {
  const key = username.toLowerCase();
  const hit = cache.get(key);
  if (hit) return hit;
  const p = fetch(`/api/profile/summary?u=${encodeURIComponent(key)}`)
    .then((r) => (r.ok ? (r.json() as Promise<Summary>) : null))
    .catch(() => null)
    .then((s) => {
      if (!s) cache.delete(key);
      return s;
    });
  cache.set(key, p);
  return p;
}

const OPEN_DELAY = 320;
const CLOSE_DELAY = 180;
const CARD_W = 324;
/* Touch has no hover, so the card opens on a PRESS AND HOLD instead
   (Luca 2026-09-16: "if someone is doing like some sort of
   passthrough touch on the app, the little mini profile should pop up
   since it only does it on the web"). 450ms is the usual long-press
   feel — long enough that a normal tap-to-navigate never trips it,
   short enough not to feel like waiting. SLOP is how far the finger
   may drift before we treat it as a scroll and give up. */
const LONG_PRESS = 450;
const SLOP = 10;

type LinkProps = Omit<ComponentProps<typeof Link>, "href">;

export default function UserLink({
  username,
  children,
  onPointerEnter,
  onPointerLeave,
  ...rest
}: LinkProps & { username: string }) {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const anchor = useRef<HTMLAnchorElement>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Is the mouse on the name (or the card) right now? A slow first
  // answer from the endpoint (cold start on Vercel) must never pop the
  // card open after the mouse has already moved on.
  const hovering = useRef(false);
  /* Press-and-hold state (touch). pressStart doubles as "a press is
     in flight": null means there is nothing to open. */
  const pressTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pressStart = useRef<{ x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const openedByTouch = useRef(false);

  const clearTimers = () => {
    if (openTimer.current) clearTimeout(openTimer.current);
    if (closeTimer.current) clearTimeout(closeTimer.current);
    openTimer.current = undefined;
    closeTimer.current = undefined;
  };

  const close = useCallback(() => {
    clearTimers();
    openedByTouch.current = false;
    setPos(null);
  }, []);

  const place = () => {
    const el = anchor.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const margin = 12;
    // Below the name when there is room, above it otherwise; never
    // past the right edge of the viewport.
    const left = Math.max(margin, Math.min(r.left, window.innerWidth - CARD_W - margin));
    const below = r.bottom + 8;
    const top = below + 260 < window.innerHeight ? below : Math.max(margin, r.top - 8 - 260);
    setPos({ left, top });
  };

  const handleEnter = (e: React.PointerEvent<HTMLAnchorElement>) => {
    onPointerEnter?.(e);
    if (e.pointerType === "touch") return;
    if (document.documentElement.classList.contains("native-app")) return;
    if (!username) return;
    hovering.current = true;
    clearTimers();
    // Warm the answer right away; only the SHOWING waits the delay.
    const pending = loadSummary(username);
    openTimer.current = setTimeout(async () => {
      const s = await pending;
      if (!s || !anchor.current || !hovering.current) return;
      setSummary(s);
      place();
    }, OPEN_DELAY);
  };

  const handleLeave = (e: React.PointerEvent<HTMLAnchorElement>) => {
    onPointerLeave?.(e);
    if (e.pointerType === "touch") return;
    hovering.current = false;
    clearTimers();
    closeTimer.current = setTimeout(close, CLOSE_DELAY);
  };

  /* ---- Press and hold, the touch equivalent of hovering ----
     Deliberately NOT gated on the native shell: mobile web has the
     same no-hover problem, so the gesture works in both and there is
     one behaviour to remember. */
  const cancelPress = () => {
    if (pressTimer.current) clearTimeout(pressTimer.current);
    pressTimer.current = undefined;
    pressStart.current = null;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "touch" || !username) return;
    pressStart.current = { x: e.clientX, y: e.clientY };
    // Warm the request immediately; only the SHOWING waits, exactly
    // like the hover path.
    const pending = loadSummary(username);
    pressTimer.current = setTimeout(async () => {
      const s = await pending;
      if (!s || !anchor.current || !pressStart.current) return;
      // The finger is still down and still on the name: open, and
      // swallow the click that this press is about to produce so the
      // card appears INSTEAD of navigating.
      suppressClick.current = true;
      openedByTouch.current = true;
      void hapticTap();
      setSummary(s);
      place();
    }, LONG_PRESS);
  };

  /* A finger that travels is scrolling, not pressing. */
  const handlePointerMove = (e: React.PointerEvent<HTMLAnchorElement>) => {
    if (e.pointerType !== "touch" || !pressStart.current) return;
    const dx = e.clientX - pressStart.current.x;
    const dy = e.clientY - pressStart.current.y;
    if (Math.hypot(dx, dy) > SLOP) cancelPress();
  };

  const handleClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (suppressClick.current) {
      e.preventDefault();
      // preventDefault alone is not enough: NavigationPending watches
      // document clicks and ignores that flag on purpose, so without
      // this marker the long press swapped the page for the TUNING
      // panel — which then sat there, because the path never changed.
      markClickHandled(e.nativeEvent);
      suppressClick.current = false;
    }
  };

  // Scroll, Escape or navigating away all dismiss the card.
  useEffect(() => {
    if (!pos) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("scroll", close, { capture: true, passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, { capture: true });
      window.removeEventListener("keydown", onKey);
    };
  }, [pos, close]);

  /* A card opened by holding has no "pointer left the name" to close
     it, so the next touch anywhere else dismisses it. Registered only
     while such a card is open. */
  useEffect(() => {
    if (!pos || !openedByTouch.current) return;
    const onDown = (e: PointerEvent) => {
      const card = document.getElementById("userlink-card");
      if (card?.contains(e.target as Node)) return;
      if (anchor.current?.contains(e.target as Node)) return;
      close();
    };
    // Attached straight away, no deferral. There is no re-entrancy to
    // guard against: the card opens on a TIMER partway through the
    // press, so the pointerdown that started it fired and finished
    // long before this runs. (It was behind a requestAnimationFrame
    // at first, which in a backgrounded tab never fires — the card
    // then had no way to be dismissed at all.)
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, [pos, close]);

  useEffect(() => () => {
    clearTimers();
    cancelPress();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <Link
        ref={anchor}
        href={`/profile/${username}`}
        onPointerEnter={handleEnter}
        onPointerLeave={handleLeave}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onClick={handleClick}
        // iOS pops its own copy/share callout on a long press, which
        // would land on top of the card. This is the only way to stop
        // it, and it costs nothing: a username is not text anyone
        // needs to select.
        style={{ WebkitTouchCallout: "none", ...(rest.style ?? {}) }}
        {...rest}
      >
        {children}
      </Link>
      {pos && summary && typeof document !== "undefined"
        ? createPortal(
            <HoverCard
              summary={summary}
              pos={pos}
              onEnter={() => {
                hovering.current = true;
                clearTimers();
              }}
              onLeave={() => {
                hovering.current = false;
                clearTimers();
                closeTimer.current = setTimeout(close, CLOSE_DELAY);
              }}
            />,
            document.body
          )
        : null}
    </>
  );
}

function HoverCard({
  summary,
  pos,
  onEnter,
  onLeave,
}: {
  summary: Summary;
  pos: { left: number; top: number };
  onEnter: () => void;
  onLeave: () => void;
}) {
  const t = useTranslations("profile.stats");
  const theme = resolveTheme(summary.theme);
  const accent = THEME_SPECS[theme].accent;
  const hidden = hiddenBadgeSet(summary.hidden_badges);
  const reviews = trophyTier(summary.stats.review_count);
  const likes = trophyTier(summary.stats.total_likes_received);
  const name = summary.display_name || summary.username;
  const avatarOk =
    summary.avatar_url &&
    (summary.avatar_url.startsWith("https://") || summary.avatar_url.startsWith("/"));
  // Same guard the profile page applies before a URL enters CSS url().
  const banner =
    summary.banner_url &&
    (summary.banner_url.startsWith("https://") || summary.banner_url.startsWith("/")) &&
    !/["'()\\]/.test(summary.banner_url)
      ? summary.banner_url
      : null;

  const tiles = [
    { label: t("followers"), value: summary.stats.follower_count, color: accent, glyph: null, tier: null },
    { label: t("following"), value: summary.stats.following_count, color: accent, glyph: null, tier: null },
    {
      label: t("reviews"),
      value: summary.stats.review_count,
      color: hidden.has("reviews") ? accent : reviews.color,
      glyph: hidden.has("reviews") ? null : <TrophyGlyph className="w-3.5 h-3.5" />,
      tier: hidden.has("reviews") ? null : reviews,
    },
    {
      label: t("likes"),
      value: summary.stats.total_likes_received,
      color: hidden.has("likes") ? accent : likes.color,
      glyph: hidden.has("likes") ? null : <HeartGlyph className="w-3.5 h-3.5" />,
      tier: hidden.has("likes") ? null : likes,
    },
  ];

  return (
    <div
      // The outside-tap dismissal for press-and-hold looks this up by
      // id — only ever one card is on screen at a time.
      id="userlink-card"
      role="dialog"
      aria-label={name}
      className="user-card"
      style={{ left: pos.left, top: pos.top, width: CARD_W, borderColor: `${accent}55` }}
      onPointerEnter={onEnter}
      onPointerLeave={onLeave}
    >
      {/* Mini banner: their own banner image, else their theme's
          liquid colours — the same fallback the profile page paints */}
      <div
        className="user-card-band"
        style={{
          background: banner
            ? `url(${banner}) center / cover no-repeat`
            : themeGradient(theme),
        }}
      />
      <div className="user-card-body">
        <div className="flex items-center gap-3">
          <span
            className="user-card-avatar"
            style={{ borderColor: accent, boxShadow: `0 0 14px ${accent}55` }}
          >
            {avatarOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={summary.avatar_url!} alt="" />
            ) : (
              <span style={{ background: `${accent}30`, color: accent }}>
                {name[0]?.toUpperCase()}
              </span>
            )}
          </span>
          <span className="user-card-id min-w-0 flex-1">
            <span className="flex items-center gap-1.5 min-w-0">
              <span className="user-card-name truncate">{name}</span>
              <RoleBadge role={summary.role} size="xs" />
            </span>
            <span className="user-card-handle">@{summary.username}</span>
          </span>
        </div>
        {summary.tagline && (
          <p className="user-card-tagline" style={{ color: accent }}>
            “{summary.tagline}”
          </p>
        )}
        <div className="user-card-stats">
          {tiles.map((tile) => {
            const glow = tile.tier?.perfect
              ? " stat-glow-perfect"
              : tile.tier?.elite
                ? " stat-glow-elite"
                : "";
            return (
              <span key={tile.label} className="user-card-stat">
                <span className={`user-card-number${glow}`} style={{ color: tile.color }}>
                  {tile.glyph && <span className="stat-glyph">{tile.glyph}</span>}
                  {compactCount(tile.value)}
                </span>
                <span className="stat-label">{tile.label}</span>
              </span>
            );
          })}
        </div>
        <Link href={`/profile/${summary.username}`} className="user-card-cta" style={{ color: accent }}>
          {t("viewProfile")} →
        </Link>
      </div>
    </div>
  );
}
