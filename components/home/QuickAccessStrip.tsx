"use client";

/**
 * QuickAccessStrip — the app home's browse hub (Luca 2026-08-22).
 *
 * A swipeable chip row that starts in the page flow below the header
 * (site name, CREATE, avatar), then LOCKS to the top of the screen
 * once you scroll past it — the browse buttons ride along while the
 * header scrolls away. These chips replaced the Reviews/Debates
 * bottom tabs; the row is the only browse navigation in the app.
 *
 * Mechanism (third attempt — the history matters):
 *  1. position:sticky — DEAD site-wide: WebKit disables sticky under
 *     html{overflow-x:clip}, which the wobble fix requires.
 *  2. window scroll listener + position:fixed — never fired on
 *     device. Every working scroll-tracker in this codebase listens
 *     with capture:true "because the scroller may be any ancestor";
 *     a plain window listener hears nothing if the document isn't
 *     the real scroller in the shell.
 *  3. THIS: an IntersectionObserver on a 1px sentinel at the row's
 *     slot — observers fire regardless of WHICH element scrolls,
 *     including mid-momentum, so they can't miss. rootMargin shifts
 *     the trigger line down by the status-bar inset (probe-measured
 *     env(); unreadable from JS directly). A capture-phase scroll
 *     listener stays as a redundant fallback. Pinned = the bar
 *     switches to position:fixed at the safe-area top (the tab
 *     bar's mechanism, provably fine in the shell) while the
 *     wrapper holds the slot's height so the page doesn't jump.
 *
 * App-only (.app-only) — web keeps its top nav strip.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { hapticTap } from "@/lib/native";

const CHIPS = [
  { href: "/reviews", glyph: "★", label: "Reviews" },
  { href: "/releases", glyph: "◉", label: "Releases" },
  { href: "/debates", glyph: "⚔", label: "Debates" },
  { href: "/lists", glyph: "≣", label: "Lists" },
  { href: "/posts", glyph: "▶", label: "Posts" },
];

/** env(safe-area-inset-top) in real pixels, via a fixed probe. */
function measureSafeTop(): number {
  const probe = document.createElement("div");
  probe.style.cssText =
    "position:fixed;top:env(safe-area-inset-top,0px);height:0;visibility:hidden;pointer-events:none";
  document.body.appendChild(probe);
  const top = probe.getBoundingClientRect().top;
  probe.remove();
  return top;
}

export default function QuickAccessStrip() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  const safeTopRef = useRef(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const sentinel = sentinelRef.current;
    const bar = barRef.current;
    if (!wrap || !sentinel || !bar) return;

    let observer: IntersectionObserver | null = null;

    const build = () => {
      safeTopRef.current = measureSafeTop();
      if (bar.offsetHeight > 0) setBarHeight(bar.offsetHeight);

      observer?.disconnect();
      observer = new IntersectionObserver(
        ([entry]) => {
          // Pinned = the sentinel left through the TOP of the (inset-
          // shrunk) viewport. Leaving through the bottom (page opens
          // pre-scrolled, sentinel below the fold) must not pin.
          const rootTop = entry.rootBounds?.top ?? safeTopRef.current;
          setPinned(
            !entry.isIntersecting && entry.boundingClientRect.top < rootTop,
          );
          if (bar.offsetHeight > 0) setBarHeight(bar.offsetHeight);
        },
        // Pull the top trigger line DOWN to the safe-area inset so the
        // pin happens exactly when the row reaches the notch line.
        { rootMargin: `-${Math.ceil(safeTopRef.current) + 1}px 0px 0px 0px` },
      );
      observer.observe(sentinel);
    };

    // Fallback lane: capture-phase scroll (observers make this mostly
    // redundant, but it costs one rect read and catches any IO gap).
    const onScroll = () => {
      setPinned(
        wrap.getBoundingClientRect().top <= safeTopRef.current + 1 &&
          wrap.getBoundingClientRect().height > 0,
      );
    };
    const onResize = () => build();

    build();
    window.addEventListener("scroll", onScroll, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    // The in-flow slot: holds the row's height while the bar is
    // pinned so the page below doesn't jump up.
    <div
      ref={wrapRef}
      className="app-only relative"
      style={pinned && barHeight ? { height: barHeight } : undefined}
    >
      {/* 1px trigger line at the slot's top edge */}
      <div
        ref={sentinelRef}
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-px pointer-events-none"
      />
      <div
        ref={barRef}
        style={pinned ? { top: "env(safe-area-inset-top, 0px)" } : undefined}
        className={
          pinned
            ? "fixed left-0 right-0 z-40 px-4 py-2 bg-black border-b border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
            : // -mx-4/px-4 mirrors .crt-screen's 1rem phone padding so
              // the row reads full-bleed in the flow too.
              "-mx-4 px-4 py-2"
        }
      >
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {CHIPS.map((chip) => (
            <Link
              key={chip.href}
              href={chip.href}
              onClick={() => hapticTap()}
              className="shrink-0 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wide uppercase text-text-secondary border border-border-medium bg-bg-elevated hover:text-accent-primary hover:border-accent-primary/40 transition-all font-[family-name:var(--font-heading)]"
            >
              <span className="text-accent-primary">{chip.glyph}</span>
              {chip.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
