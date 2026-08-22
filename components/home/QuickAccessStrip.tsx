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
 * Pinning is JS + position:fixed, NOT position:sticky — WebKit
 * breaks sticky whenever html has non-visible overflow, and the
 * horizontal-wobble fix REQUIRES html{overflow-x:clip} (body-only
 * clip is ignored for viewport panning). Verified broken on device
 * 2026-08-22; fixed elements work fine in the shell (the tab bar is
 * one). A placeholder keeps the row's slot in the page while the
 * bar is lifted out, so nothing jumps at the pin moment. Pinned
 * top = the status-bar inset (probe-measured env()) so the bar sits
 * below the iPhone notch, never under it. App-only (.app-only) —
 * web keeps its top nav strip.
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

export default function QuickAccessStrip() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [pinned, setPinned] = useState(false);
  const [barHeight, setBarHeight] = useState(0);
  const safeTopRef = useRef(0);

  useEffect(() => {
    const wrap = wrapRef.current;
    const bar = barRef.current;
    if (!wrap || !bar) return;

    // env() can't be read from JS directly — park a probe at the
    // safe-area top and measure where it lands.
    const measure = () => {
      const probe = document.createElement("div");
      probe.style.cssText =
        "position:fixed;top:env(safe-area-inset-top,0px);height:0;visibility:hidden;pointer-events:none";
      document.body.appendChild(probe);
      safeTopRef.current = probe.getBoundingClientRect().top;
      probe.remove();
      setBarHeight(bar.offsetHeight);
    };

    let raf = 0;
    const check = () => {
      raf = 0;
      // The wrapper never leaves the flow, so its position is a
      // stable readout of where the row's slot is.
      setPinned(wrap.getBoundingClientRect().top <= safeTopRef.current + 1);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const onResize = () => {
      measure();
      onScroll();
    };

    measure();
    check();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    // The in-flow slot: holds the row's height while the bar is
    // pinned so the page below doesn't jump up.
    <div
      ref={wrapRef}
      className="app-only"
      style={pinned && barHeight ? { height: barHeight } : undefined}
    >
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
