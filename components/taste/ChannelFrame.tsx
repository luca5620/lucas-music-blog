"use client";

/**
 * ChannelFrame — the fullscreen PEAK TV broadcast (taste overhaul
 * round 3; replaces ChannelSurf's fullscreen mode wholesale).
 *
 * The lobby (TasteGuide) mounts this only while the viewer is LIVE —
 * there is no inline pager mode anymore. Architecture kept from
 * ChannelSurf:
 *  - PORTAL to document.body: rendered in the page column the site
 *    nav painted OVER the overlay (its dropdowns are deliberately
 *    layered above page content).
 *  - `.surf-fullscreen` contract: fixed z-55 under the z-60 tab bar,
 *    so in the app the bottom icons stay usable and you can always
 *    switch away. Enter/exit stays the fade+zoom (CRT power-on was
 *    offered and vetoed).
 *  - Native CSS scroll-snap does the paging physics.
 *
 * What's NEW here (the WP6 rebuild):
 *  - Safe-area chrome strip: big green CH OSD + /{N} + a tick
 *    progress column (one tick per channel — nothing hardcodes 12),
 *    and a 44px AV/EXIT button. The strip doubles as the
 *    drag-to-exit grab handle.
 *  - NOW WATCHING splash on enter + programmatic focus so arrow
 *    keys work immediately.
 *  - Settle detection via `scrollend` with a 120ms debounced-scroll
 *    fallback (Safari has no scrollend yet). Effects fire on SETTLED
 *    index change only, never per scroll frame: 150ms static burst,
 *    LIGHT haptic tick, chrome flash, session/cookie writes.
 *  - Media windowing at ±1 (cards get `near`/`active` — see
 *    ChannelChrome's card contract). All card shells render (text is
 *    cheap); covers, tints and iframes exist only within the window.
 *  - Color weather + per-card backdrops live in ChannelChrome; the
 *    frame renders the app's single shared ambient loop behind all
 *    cards, and owns NOTHING per-type (cards mount via a type
 *    switch).
 *  - Drag-to-exit with rubber resistance + closing vignette, from
 *    the chrome grab handle or a downward pull on any settled card
 *    whose inner reader sits at its top (120px threshold).
 *  - One history entry per layer ({pmr:'live'}, {pmr:'callers'},
 *    {pmr:'composer'}) so Android back / iOS edge-swipe / Esc peel
 *    one layer at a time instead of leaving the page.
 *  - sessionStorage session ({itemKeys, index}) written per settle
 *    for the lobby's watched-rows + RESUME, plus the pmr_taste_seen
 *    cookie write (the client half of the mix engine's seen-downrank
 *    rotation).
 *
 * Comments are THE SWITCHBOARD (WP9) — a read/write split: the
 * SwitchboardSheet (zero-input bottom sheet, safe INSIDE the frame
 * because no keyboard can ever open there) reads the line, and the
 * CallerComposer (ReportButton-pattern fixed TOP sheet at z-90,
 * keyboard-safe by construction) writes to it. This frame owns
 * which layers are open — one history entry each, peeled by the
 * single popstate listener below.
 */

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import type { TunedItem } from "@/lib/taste";
import { hapticImpact, isNativeApp } from "@/lib/native";
import BackdropVideo from "@/components/profile/BackdropVideo";
import SwitchboardSheet from "@/components/taste/SwitchboardSheet";
import type { ComposerCtx } from "@/components/taste/CallerComposer";
import CriticSegment from "@/components/taste/cards/CriticSegment";
import MusicTvCard from "@/components/taste/cards/MusicTvCard";
import OnAirCard from "@/components/taste/cards/OnAirCard";
import PremiereCard from "@/components/taste/cards/PremiereCard";
import SignOffCard from "@/components/taste/SignOffCard";

/** Exit animation length — the surf-anim-out CSS runs 180ms, the
    timeout runs a hair longer so the last frame always paints
    before unmount (was 170, which could clip it). */
const EXIT_ANIM_MS = 190;

/** How long a scroll must sit still before we call it settled —
    the fallback for browsers without `scrollend` (iOS Safari). */
const SETTLE_DEBOUNCE_MS = 120;

/** Drag-to-exit: release past this many TRANSLATED px exits. */
const EXIT_DRAG_PX = 120;

/**
 * sessionStorage key shared with the lobby — the saved shape is
 * { itemKeys: string[], index: number }. itemKeys is the FULL key
 * sequence of the mix that was playing, so a stale session (day
 * rotation, retune, different mix) is detected by comparison and
 * cleared instead of resuming into the wrong channel. Fail-soft
 * everywhere: storage errors just mean no resume.
 */
const SESSION_KEY = "pmr_taste_session";

/**
 * The rotation cookie the server downranks on (lib/taste.ts change 9).
 * ⚠️ PATH-SCOPED to /your-taste so it only rides along on this
 * route's requests — renaming the route silently kills rotation (the
 * cookie stops arriving, no error anywhere). If /your-taste ever
 * moves, move this path AND the read in app/your-taste/page.tsx.
 */
const SEEN_COOKIE = "pmr_taste_seen";
/** Keep only the newest N seen keys — enough to rotate a 12-18 item
    mix without the cookie growing forever. */
const SEEN_MAX = 40;
/** 3 days — long enough to rotate reruns out, short enough that a
    binge from Monday doesn't haunt Friday's programming. */
const SEEN_MAX_AGE_S = 259200;

/**
 * Stable identity for a tuned item — MIRRORS tunedKeyOf in
 * lib/taste.ts (that module imports the server Supabase client, so a
 * client component can't import the function itself). The same
 * strings live in the pmr_taste_seen cookie the server downranks on
 * AND in the sessionStorage session the lobby resumes from. Change
 * one copy and rotation/resume silently dies — keep them in sync.
 * Exported so TasteGuide uses THIS copy instead of a third one.
 */
export function tunedItemKey(item: TunedItem): string {
  switch (item.type) {
    case "review":
      return `review:${item.id}`;
    case "post":
      return `post:${item.id}`;
    case "debate":
      return `debate:${item.slug}`;
    case "release":
      return `release:${item.slug}`;
  }
}

/** "01"-style channel number — TVs zero-pad, so we do too. */
function chNum(index: number): string {
  return String(index + 1).padStart(2, "0");
}

/** Append one key to the seen cookie (dedup, keep the newest 40).
    Called once per card per session, on the settle that lands on it. */
function writeSeenCookie(key: string) {
  try {
    const raw = document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${SEEN_COOKIE}=`));
    const existing = raw
      ? decodeURIComponent(raw.slice(SEEN_COOKIE.length + 1))
          .split(",")
          .filter(Boolean)
      : [];
    // Re-appending moves the key to the back — "most recently seen"
    // survives the length cap the longest, which is what we want.
    const next = [...existing.filter((k) => k !== key), key].slice(-SEEN_MAX);
    document.cookie = `${SEEN_COOKIE}=${encodeURIComponent(next.join(","))}; path=/your-taste; max-age=${SEEN_MAX_AGE_S}; SameSite=Lax`;
  } catch {
    /* cookies blocked — rotation just doesn't happen for this viewer */
  }
}

/** Walk from a touch target up to (not including) `stopAt`, looking
    for any scrolled-down inner scroller. The drag-to-exit gesture
    must NOT arm mid-read: swiping down while a long review is
    scrolled should scroll the review, not start closing the frame
    (the old "reading misfire"). */
function innerScrolled(target: EventTarget | null, stopAt: HTMLElement) {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== stopAt) {
    if (el.scrollTop > 0) return true;
    el = el.parentElement;
  }
  return false;
}

export default function ChannelFrame({
  items,
  initialIndex = 0,
  channelName,
  onExit,
}: {
  items: TunedItem[];
  /** Which channel to open ON (random access from an EPG row /
      resume). Clamped, so a stale index can't scroll into space. */
  initialIndex?: number;
  /** For the NOW WATCHING splash + sign-off card. */
  channelName: string;
  /** Called AFTER the exit animation with the channel the viewer was
      on — the lobby unmounts the frame and updates watched/RESUME. */
  onExit?: (lastIndex: number) => void;
}) {
  // Card count includes the SIGN-OFF card at index N (END OF
  // BROADCAST — WP8): clamps run against cardCount, item lookups
  // against items.length.
  const cardCount = items.length + 1;
  const clamp = useCallback(
    (i: number) => Math.max(0, Math.min(cardCount - 1, i)),
    [cardCount]
  );

  /* ─── refs & state ─── */

  const frameRef = useRef<HTMLDivElement>(null); // the snap scroller
  const dragWrapRef = useRef<HTMLDivElement>(null); // translated on drag
  const vignetteRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null); // chrome grab handle

  // The SETTLED channel — media windowing, chrome, persistence all
  // key off this; it changes only when a snap finishes, never per
  // scroll frame.
  const [index, setIndex] = useState(() => clamp(initialIndex));
  const settledRef = useRef(clamp(initialIndex));
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  // Static burst: remounting the keyed div restarts its CSS
  // animation — no JS timing anywhere. 0 = no burst yet (entering
  // the frame isn't a channel CHANGE).
  const [burstKey, setBurstKey] = useState(0);

  // Chrome OSD: full opacity right after a settle, dims to 40% after
  // 1.2s of rest.
  const [chromeLit, setChromeLit] = useState(true);

  // NOW WATCHING splash — 1.5s on enter.
  const [splash, setSplash] = useState(true);

  // The review whose Switchboard (read sheet) is open. The ref
  // mirror lets stable callbacks (exitAll) count open layers
  // without re-subscribing anything.
  const [commentsFor, setCommentsFor] = useState<string | null>(null);
  const commentsForRef = useRef<string | null>(null);
  commentsForRef.current = commentsFor;

  // The CallerComposer's context when the WRITE layer is up —
  // null parentId = fresh comment, non-null = replying (with the
  // quoted parent riding along for the "REPLYING TO" header).
  const [composer, setComposer] = useState<ComposerCtx | null>(null);
  const composerRef = useRef<ComposerCtx | null>(null);
  composerRef.current = composer;

  // App shell: ONE hardware-decoded ambient loop behind all cards
  // (public/backdrops/taste.mp4) instead of per-card CSS backdrops.
  const [ambient, setAmbient] = useState(false);
  useEffect(() => {
    setAmbient(isNativeApp());
  }, []);

  // Cards whose seen-cookie write already happened this session —
  // settling on a card twice must not double-write.
  const recordedRef = useRef<Set<string>>(new Set());

  /* ─── persistence ─── */

  /** Write the lobby's resume state. The sign-off card isn't a
      channel, so landing on it stores the last REAL channel. */
  const persistSession = useCallback(
    (i: number) => {
      try {
        sessionStorage.setItem(
          SESSION_KEY,
          JSON.stringify({
            itemKeys: items.map(tunedItemKey),
            index: Math.min(i, items.length - 1),
          })
        );
      } catch {
        /* storage blocked — resume just won't survive this visit */
      }
    },
    [items]
  );

  /** Record a settled landing on card i: seen cookie + session. */
  const recordLanding = useCallback(
    (i: number) => {
      persistSession(i);
      if (i < items.length) {
        const key = tunedItemKey(items[i]);
        if (!recordedRef.current.has(key)) {
          recordedRef.current.add(key);
          writeSeenCookie(key);
        }
      }
    },
    [items, persistSession]
  );

  /* ─── exit ─── */

  // close() only animates + reports — it never touches history
  // itself (every exit path routes through history.back() first, so
  // by the time close() runs our entries are already popped).
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    hapticImpact("MEDIUM"); // leaving fullscreen is a deliberate act
    setComposer(null);
    setCommentsFor(null);
    setClosing(true);
    window.setTimeout(() => {
      onExit?.(Math.min(settledRef.current, items.length - 1));
    }, EXIT_ANIM_MS);
  }, [onExit, items.length]);

  /** Peel ONE layer via history (Esc, ✕ on the sheet, drag-exit):
      popstate does the actual state change, so back-button and
      in-app closes share one code path. */
  const peel = useCallback(() => {
    if (closingRef.current) return;
    history.back();
  }, []);

  /** AV/EXIT leaves the frame entirely, however many layers are up:
      one history entry each for the frame, the read sheet, and the
      composer — pop them all in one go. */
  const exitAll = useCallback(() => {
    if (closingRef.current) return;
    const layers =
      1 + (commentsForRef.current ? 1 : 0) + (composerRef.current ? 1 : 0);
    history.go(-layers);
  }, []);

  /* ─── history: one entry per layer ─── */

  useEffect(() => {
    // Entering fullscreen pushes exactly one state; the read sheet
    // pushes a second, the composer a third. The popstate handler
    // peels by looking at where the pop LANDED — it only ever
    // reacts to our own marked entries, so pops that happen after
    // unmount-worthy navigation are ignored by the (by then
    // unmounted) listener.
    history.pushState({ pmr: "live" }, "");
    const onPop = () => {
      if (closingRef.current) return;
      const s = history.state as { pmr?: string } | null;
      if (s?.pmr === "callers") {
        // Landed on the read sheet's entry → the composer was the
        // top layer; close just it (the sheet stays up).
        setComposer(null);
      } else if (s?.pmr === "live") {
        // Landed back on the frame's own entry → whatever sheets
        // were above it come down.
        setComposer(null);
        setCommentsFor(null);
      } else if (s?.pmr !== "composer") {
        // Popped past our entries entirely → leave fullscreen.
        // ('composer' can't be LANDED on by going back — it's only
        // ever the top of our stack — so anything else is foreign.)
        setComposer(null);
        setCommentsFor(null);
        close();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Open the Switchboard read sheet (its own history layer). */
  const openComments = useCallback((reviewId: string) => {
    setCommentsFor(reviewId);
    history.pushState({ pmr: "callers" }, "");
  }, []);

  /** Open the CallerComposer (the WRITE layer, stacked on the read
      sheet) — from the WRITE pill or a Reply tap. */
  const openComposer = useCallback((ctx: ComposerCtx) => {
    setComposer(ctx);
    history.pushState({ pmr: "composer" }, "");
  }, []);

  /* ─── mount: freeze the page, focus, splash, initial landing ─── */

  // Pre-paint: park the scroller ON the entry channel before the
  // browser ever paints — a smooth-scroll here would flash CH 01
  // first (the old resume jank). useLayoutEffect + instant jump.
  useLayoutEffect(() => {
    const el = frameRef.current;
    if (el) el.scrollTop = clamp(initialIndex) * el.clientHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // The page behind the portal must not scroll while we're live.
    const prevBody = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Arrow keys must work IMMEDIATELY — no click-to-focus first.
    frameRef.current?.focus();
    // The entry channel counts as watched even if the viewer never
    // swipes (session + seen cookie).
    recordLanding(settledRef.current);
    const splashT = window.setTimeout(() => setSplash(false), 1500);
    return () => {
      document.body.style.overflow = prevBody;
      window.clearTimeout(splashT);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Chrome flash: lit on every settle (index change), dim after 1.2s.
  useEffect(() => {
    setChromeLit(true);
    const t = window.setTimeout(() => setChromeLit(false), 1200);
    return () => window.clearTimeout(t);
  }, [index]);

  /* ─── settle detection: scrollend + debounce fallback ─── */

  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    let debounce = 0;

    const settle = () => {
      if (el.clientHeight === 0) return;
      const i = clamp(Math.round(el.scrollTop / el.clientHeight));
      if (i === settledRef.current) return;
      settledRef.current = i;
      setIndex(i);
      // Channel CHANGED — the full arrival package, exactly once:
      setBurstKey((k) => k + 1); // 150ms static snow (CSS-driven)
      if (i === items.length) {
        // Rubber-banding into the sign-off card: DOUBLE light tick —
        // the "you've reached the end of the tape" signature.
        hapticImpact("LIGHT");
        window.setTimeout(() => hapticImpact("LIGHT"), 120);
      } else {
        hapticImpact("LIGHT"); // the ambient tick of a snap settling
      }
      recordLanding(i);
    };

    // scrollend is the real signal where it exists (Chrome/Android);
    // the debounce covers iOS Safari. Both funnel into settle(),
    // which no-ops unless the index actually changed — a fast flick
    // through three cards bursts once, on arrival, not per card.
    const onScroll = () => {
      window.clearTimeout(debounce);
      debounce = window.setTimeout(settle, SETTLE_DEBOUNCE_MS);
    };
    const onScrollEnd = () => {
      window.clearTimeout(debounce);
      settle();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", onScrollEnd);
    return () => {
      window.clearTimeout(debounce);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", onScrollEnd);
    };
  }, [clamp, items.length, recordLanding]);

  /* ─── RETUNE: new mix arrived while we're live ─── */

  // The sign-off card's RETUNE refreshes the server payload; when the
  // items prop actually changes identity, snap home to CH 01 and
  // start the session over (the old keys are meaningless now).
  const mixSignature = items.map(tunedItemKey).join("|");
  const prevSignatureRef = useRef(mixSignature);
  useEffect(() => {
    if (prevSignatureRef.current === mixSignature) return;
    prevSignatureRef.current = mixSignature;
    recordedRef.current = new Set();
    settledRef.current = 0;
    setIndex(0);
    const el = frameRef.current;
    if (el) el.scrollTop = 0; // instant — a fresh broadcast, no tour
    recordLanding(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mixSignature]);

  /* ─── keyboard ─── */

  const surf = useCallback((dir: 1 | -1) => {
    const el = frameRef.current;
    if (!el) return;
    el.scrollBy({ top: dir * el.clientHeight, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      peel(); // one layer at a time: sheet first, then fullscreen
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peel]);

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

  /* ─── drag-to-exit ─── */

  // Two entry points, one mechanism: (a) the chrome strip is a grab
  // handle (touch-action:none, lives OUTSIDE the snap scroller — no
  // gesture conflict possible), (b) a downward pull on a settled
  // card whose inner reader sits at its top. The WRAPPER around the
  // scroller translates (never the scroller itself — that would
  // fight scroll-snap's own transform bookkeeping) with ~0.5x rubber
  // resistance while the vignette closes in; release past 120px
  // exits, under it springs back. Raw style writes, not setState:
  // this runs per touch frame.
  useEffect(() => {
    const strip = stripRef.current;
    const frame = frameRef.current;
    const wrap = dragWrapRef.current;
    const vig = vignetteRef.current;
    if (!strip || !frame || !wrap || !vig) return;

    let startY = 0;
    let armed = false;
    let dragging = false;
    let crossed = false; // MEDIUM haptic fires once per drag
    let translate = 0;

    const begin = (fromStrip: boolean) => (e: TouchEvent) => {
      if (closingRef.current) return;
      startY = e.touches[0].clientY;
      dragging = false;
      crossed = false;
      translate = 0;
      if (fromStrip) {
        armed = true;
      } else {
        // From a card: only when the scroller is SETTLED on a card's
        // own top (mid-scroll pulls are just scrolling) and nothing
        // under the finger is an inner reader that's scrolled down.
        const settled =
          Math.abs(frame.scrollTop - settledRef.current * frame.clientHeight) <
          2;
        armed = settled && !innerScrolled(e.target, frame);
      }
    };

    const move = (e: TouchEvent) => {
      if (!armed || closingRef.current) return;
      const dy = e.touches[0].clientY - startY;
      if (!dragging) {
        // A real downward pull starts the drag; an upward move means
        // the viewer is channel-surfing — disarm and let snap have it.
        if (dy < -6) {
          armed = false;
          return;
        }
        if (dy <= 8) return; // within slop — undecided yet
        dragging = true;
      }
      // Ours now: stop the snap scroller from ALSO reacting.
      e.preventDefault();
      translate = Math.max(0, dy) * 0.5; // rubber resistance
      wrap.style.transition = "none";
      wrap.style.transform = `translateY(${translate}px)`;
      vig.style.transition = "none";
      vig.style.opacity = String(Math.min(1, translate / 160));
      if (translate >= EXIT_DRAG_PX && !crossed) {
        crossed = true;
        hapticImpact("MEDIUM"); // threshold crossing
      }
    };

    const end = () => {
      const wasDragging = dragging;
      const t = translate;
      armed = false;
      dragging = false;
      if (!wasDragging) return;
      if (t >= EXIT_DRAG_PX) {
        peel(); // → popstate → close() (which fires the exit MEDIUM)
      } else {
        // Spring back — the signal survives.
        wrap.style.transition = "transform 0.2s ease-out";
        wrap.style.transform = "translateY(0)";
        vig.style.transition = "opacity 0.2s ease-out";
        vig.style.opacity = "0";
      }
    };

    const beginStrip = begin(true);
    const beginCard = begin(false);
    strip.addEventListener("touchstart", beginStrip, { passive: true });
    frame.addEventListener("touchstart", beginCard, { passive: true });
    // Non-passive: move() must be able to preventDefault the scroll.
    strip.addEventListener("touchmove", move, { passive: false });
    frame.addEventListener("touchmove", move, { passive: false });
    strip.addEventListener("touchend", end);
    frame.addEventListener("touchend", end);
    strip.addEventListener("touchcancel", end);
    frame.addEventListener("touchcancel", end);
    return () => {
      strip.removeEventListener("touchstart", beginStrip);
      frame.removeEventListener("touchstart", beginCard);
      strip.removeEventListener("touchmove", move);
      frame.removeEventListener("touchmove", move);
      strip.removeEventListener("touchend", end);
      frame.removeEventListener("touchend", end);
      strip.removeEventListener("touchcancel", end);
      frame.removeEventListener("touchcancel", end);
    };
  }, [peel]);

  if (items.length === 0) return null;

  /* ─── render ─── */

  // On the sign-off card the CH OSD has no channel to name.
  const onSignOff = index >= items.length;

  // The review whose Switchboard is open — its payload comment_count
  // seeds the "CALLERS ON THE LINE · n" header (same number the rail
  // button shows) until the live count loads.
  const openReview = commentsFor
    ? items.find((it) => it.type === "review" && it.id === commentsFor)
    : undefined;
  const openReviewCount =
    openReview?.type === "review" ? openReview.comment_count : 0;

  const content = (
    <div
      className={`surf-fullscreen ${closing ? "surf-anim-out" : "surf-anim-in"}`}
    >
      {/* App-only ambient: the molten liquid as a looping video the
          hardware decoder plays behind every card. */}
      {ambient && (
        <div className="absolute inset-0" aria-hidden="true">
          <BackdropVideo theme="taste" />
        </div>
      )}

      {/* Drag wrapper — the thing the exit gesture translates. */}
      <div ref={dragWrapRef} className="relative h-full">
        {/* Snap frame */}
        <div
          ref={frameRef}
          onKeyDown={handleKeyDown}
          tabIndex={0}
          role="region"
          aria-roledescription="carousel"
          aria-label="Tuned to you — scroll for the next channel"
          className="relative h-full overflow-y-auto snap-y snap-mandatory overscroll-contain touch-pan-y focus:outline-none [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {items.map((item, i) => {
            // The media window: shells always render (text is
            // cheap); covers/tints/iframes only within ±1 of the
            // settled channel, playback only ON it.
            const near = Math.abs(i - index) <= 1;
            const active = i === index;
            return (
              <div
                key={tunedItemKey(item)}
                className="relative w-full h-full snap-start snap-always overflow-hidden"
              >
                {item.type === "review" ? (
                  <CriticSegment
                    item={item}
                    active={active}
                    near={near}
                    onOpenComments={() => openComments(item.id)}
                  />
                ) : item.type === "post" ? (
                  <MusicTvCard item={item} active={active} near={near} />
                ) : item.type === "debate" ? (
                  <OnAirCard item={item} active={active} near={near} />
                ) : (
                  <PremiereCard item={item} active={active} near={near} />
                )}
              </div>
            );
          })}

          {/* Card N+1 — END OF BROADCAST: SMPTE bars + RETUNE / TV
              GUIDE / BACK TO STATION. Pure CSS, no windowing needed. */}
          <div className="relative w-full h-full snap-start snap-always overflow-hidden">
            <SignOffCard channelName={channelName} onExit={peel} />
          </div>
        </div>
      </div>

      {/* STATIC BURST — remounts (key) on every settled change, the
          CSS animation does the rest. Two layers = the boil's two
          frames under .motion-on (see globals.css). */}
      {burstKey > 0 && (
        <div key={burstKey} className="static-burst" aria-hidden="true">
          <div className="tv-noise" />
          <div className="tv-noise" />
        </div>
      )}

      {/* Drag-to-exit vignette — opacity driven by the drag handler */}
      <div ref={vignetteRef} className="cf-vignette" aria-hidden="true" />

      {/* ═══ CHROME STRIP — safe-area aware; ALSO the grab handle
          (touch-none = the browser never scrolls from here, our drag
          handler owns every touch). ═══ */}
      <div
        ref={stripRef}
        className="absolute top-0 inset-x-0 z-30 touch-none pt-[env(safe-area-inset-top)] px-3"
      >
        <div className="flex items-start justify-between pt-2">
          {/* CH OSD + /{N} + tick column — flashes on settle, dims
              to 40% after 1.2s (chromeLit). */}
          <div
            className={`flex flex-col gap-2 transition-opacity duration-500 ${
              chromeLit ? "opacity-100" : "opacity-40"
            }`}
          >
            <div className="flex items-baseline gap-1.5">
              <span className="cf-ch-osd text-2xl">
                {onSignOff ? "CH --" : `CH ${chNum(index)}`}
              </span>
              <span className="pixel-text text-xs text-text-muted">
                /{chNum(items.length - 1)}
              </span>
            </div>
            {/* Progress column — one tick per CHANNEL (dynamic count,
                nothing hardcodes 12); the current one glows accent. */}
            <div
              className="flex flex-col gap-1 pl-0.5"
              role="progressbar"
              aria-valuemin={1}
              aria-valuemax={items.length}
              aria-valuenow={Math.min(index + 1, items.length)}
              aria-label="Channel position"
            >
              {items.map((it, i) => (
                <span
                  key={tunedItemKey(it)}
                  className={`h-[3px] rounded-full transition-colors ${
                    i === index ? "w-4 bg-accent-glow" : "w-2.5 bg-white/25"
                  }`}
                  style={
                    i === index
                      ? {
                          // Static glow, never animated — thermal-safe.
                          boxShadow:
                            "0 0 6px rgba(var(--accent-rgb), 0.8)",
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          </div>

          {/* AV / EXIT — the 44px close control. Ring press feedback
              comes from the global touch-feel rules (never shadows). */}
          <button
            type="button"
            onClick={exitAll}
            aria-label="Exit fullscreen"
            className="h-11 min-w-11 px-2.5 rounded-lg border border-border-medium bg-black/60 text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-colors flex items-center justify-center"
          >
            <span className="pixel-text text-[10px] uppercase tracking-widest">
              AV / EXIT
            </span>
          </button>
        </div>
      </div>

      {/* NOW WATCHING splash — 1.5s ident on enter */}
      {splash && !closing && (
        <div
          className="absolute inset-0 z-40 pointer-events-none flex items-center justify-center bg-black/45"
          aria-hidden="true"
        >
          <p className="osd-text text-sm sm:text-base px-6 text-center">
            NOW WATCHING: THE {channelName} CHANNEL
          </p>
        </div>
      )}

      {/* Desktop surf buttons — left side so they never fight the
          action rail on the right edge. */}
      <div className="absolute bottom-3 left-3 hidden sm:flex flex-col gap-1.5 z-30">
        <button
          type="button"
          onClick={() => surf(-1)}
          disabled={index === 0}
          aria-label="Previous channel"
          className="w-9 h-9 rounded-full border border-border-medium bg-black/40 text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ▲
        </button>
        <button
          type="button"
          onClick={() => surf(1)}
          disabled={index >= cardCount - 1}
          aria-label="Next channel"
          className="w-9 h-9 rounded-full border border-border-medium bg-black/40 text-text-secondary hover:text-accent-primary hover:border-accent-primary/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
        >
          ▼
        </button>
      </div>

      {/* THE SWITCHBOARD (WP9) — the read sheet (zero inputs, safe
          inside the frame) + the composer it patches callers through
          to. Backdrop / ✕ / Esc / hardware back all peel ONE layer
          via history: composer → read sheet → fullscreen. */}
      {commentsFor && (
        <SwitchboardSheet
          key={commentsFor}
          reviewId={commentsFor}
          initialCount={openReviewCount}
          composer={composer}
          onOpenComposer={openComposer}
          onPeel={peel}
        />
      )}
    </div>
  );

  // Portal — escapes the page's stacking contexts (see file comment).
  return createPortal(content, document.body);
}
