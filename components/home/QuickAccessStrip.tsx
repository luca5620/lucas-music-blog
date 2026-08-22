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
 * Sticky mechanics: position:sticky with top = the status-bar inset
 * (env(safe-area-inset-top) — the strip must pin BELOW the iPhone
 * notch, not under it). "Am I pinned?" is detected by comparing the
 * strip's viewport position against its own computed sticky top on
 * scroll; when pinned it grows a solid backdrop + border so content
 * sliding beneath never bleeds through. App-only (.app-only) — web
 * keeps its top nav strip.
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
  const barRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const el = barRef.current;
    if (!el) return;

    // The sticky `top` with env() resolved to real pixels.
    let stickyTop = parseFloat(getComputedStyle(el).top) || 0;

    let raf = 0;
    const check = () => {
      raf = 0;
      // Pinned = the bar is sitting exactly at its sticky offset.
      setStuck(el.getBoundingClientRect().top <= stickyTop + 1);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(check);
    };
    const onResize = () => {
      stickyTop = parseFloat(getComputedStyle(el).top) || 0;
      onScroll();
    };

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
    // ONE element carries both app-only AND sticky: a sticky element
    // can only pin within its PARENT's bounds, so the bar must sit
    // directly in the tall page column — wrapping it in a bar-sized
    // div would make sticky a no-op.
    <div
      ref={barRef}
      // -mx-4/px-4 at ALL times (matches .crt-screen's 1rem phone
      // padding) so the bar's width never jumps at the pin moment —
      // only the backdrop fades in.
      className={`app-only sticky top-[env(safe-area-inset-top,0px)] z-40 -mx-4 px-4 py-2 transition-colors duration-150 ${
        stuck
          ? "bg-black border-b border-white/10 shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
          : "bg-transparent border-b border-transparent"
      }`}
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
  );
}
