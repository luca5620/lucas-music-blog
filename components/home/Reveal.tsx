"use client";

/**
 * Reveal — scroll-unveil for the logged-out home (Luca 2026-09-02:
 * "that professional look, with scrolling unveiling new information").
 *
 * Wraps a section; it starts a touch lower and transparent, and eases
 * into place the first time it scrolls into view (IntersectionObserver,
 * one shot — nothing re-animates on the way back up, nothing runs
 * while idle, so this is thermal-mode safe). `delay` staggers siblings.
 *
 * The flip is a classList toggle on the element, not React state: no
 * re-render for a purely visual one-time change, and the effect never
 * calls setState. The moving styles are plain transform in
 * globals.css (.reveal), not Tailwind's translate utility (v4 note).
 */

import { useEffect, useRef, type ReactNode } from "react";

export default function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  /** Milliseconds — stagger cards in a row with 0 / 90 / 180. */
  delay?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // No observer support (very old WebView) → just show it.
    if (typeof IntersectionObserver === "undefined") {
      el.classList.add("is-in");
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          el.classList.add("is-in");
          io.disconnect();
        }
      },
      // Fire a little before the section's top edge reaches the
      // bottom of the viewport, so it's moving as it arrives.
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`reveal ${className}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
