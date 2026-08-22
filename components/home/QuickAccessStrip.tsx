"use client";

/**
 * QuickAccessStrip — the app home's browse hub (Luca 2026-08-22).
 *
 * Four equal text buttons — Reviews / Releases / Debates / Lists —
 * all visible at once (no side-scroll, no glyphs; Posts cut). Sits
 * right below the header (site name / CREATE / avatar), ABOVE the
 * HOME hero band. Scroll past it and it locks FLUSH to the very top
 * of the screen: the backdrop runs from y=0 (covering the status-bar
 * region — pinning at the inset left the page visible above the bar,
 * "tacky") with the liquid atmosphere drifting inside it, and the
 * chips resting at the safe-area line.
 *
 * Mechanism (third attempt — the history matters):
 *  1. position:sticky — DEAD site-wide: WebKit disables sticky under
 *     html{overflow-x:clip}, which the wobble fix requires.
 *  2. window scroll listener + position:fixed — never fired on
 *     device: html+body overflow moves the real scroller off the
 *     window, and element scrolls don't bubble.
 *  3. THIS (works, Luca-verified): IntersectionObserver on a 1px
 *     sentinel at the row's slot — observers fire regardless of
 *     which element scrolls. rootMargin shifts the trigger line to
 *     the probe-measured safe-area inset; a capture-phase scroll
 *     listener stays as a redundant fallback. The wrapper holds the
 *     slot's height while the bar is lifted out so nothing jumps.
 *
 * App-only (.app-only) — web keeps its top nav strip.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { hapticTap } from "@/lib/native";
import LiquidAtmosphere from "@/components/ui/LiquidAtmosphere";

const CHIPS = [
  { href: "/reviews", label: "Reviews" },
  { href: "/releases", label: "Releases" },
  { href: "/debates", label: "Debates" },
  { href: "/lists", label: "Lists" },
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
      if (bar.offsetHeight > 0 && !bar.classList.contains("fixed")) {
        setBarHeight(bar.offsetHeight);
      }

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
        className={
          pinned
            ? // Flush to y=0, chips resting at the safe-area line.
              // strip-pin-anim: the position swap itself can't
              // animate, so a quick drop-in masks the teleport.
              "fixed left-0 right-0 top-0 z-40 isolate px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)] strip-pin-anim"
            : // -mx-4/px-4 mirrors .crt-screen's 1rem phone padding so
              // the row reads full-bleed in the flow too.
              "relative isolate -mx-4 px-4 py-2"
        }
      >
        {/* Backdrop lives in BOTH states and fades rather than pops:
            opaque base + liquid drifting over it (negative-z child
            paints above the parent background, PageHero layering) +
            the border/shadow, all riding one opacity transition. */}
        <div
          aria-hidden="true"
          className={`absolute inset-0 -z-10 isolate overflow-hidden bg-black border-b border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)] transition-opacity duration-300 ${
            pinned ? "opacity-100" : "opacity-0"
          }`}
        >
          <LiquidAtmosphere />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {CHIPS.map((chip) => (
            <Link
              key={chip.href}
              href={chip.href}
              onClick={() => hapticTap()}
              className="text-center px-1 py-1.5 rounded-full text-[11px] font-bold tracking-wide uppercase text-text-secondary border border-border-medium bg-bg-elevated hover:text-accent-primary hover:border-accent-primary/40 transition-all font-[family-name:var(--font-heading)] whitespace-nowrap"
            >
              {chip.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
