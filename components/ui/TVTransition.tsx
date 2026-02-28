"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

/**
 * TVTransition — CRT power-off page transition.
 * When the route changes:
 * 1. Two black bars close from top and bottom
 * 2. A brief white flash line appears (like a real CRT turning off)
 * 3. Bars open again revealing the new page
 */
export default function TVTransition() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "closing" | "flash" | "opening">("idle");
  const prevPathname = useRef(pathname);
  const isFirstRender = useRef(true);

  useEffect(() => {
    /* Skip the animation on the very first page load */
    if (isFirstRender.current) {
      isFirstRender.current = false;
      prevPathname.current = pathname;
      return;
    }

    /* Only animate when the route actually changes */
    if (pathname === prevPathname.current) return;
    prevPathname.current = pathname;

    /* Phase 1: Black bars close (300ms) */
    setPhase("closing");

    const flashTimer = setTimeout(() => {
      /* Phase 2: White flash line (150ms) */
      setPhase("flash");
    }, 300);

    const openTimer = setTimeout(() => {
      /* Phase 3: Bars open again */
      setPhase("opening");
    }, 500);

    const doneTimer = setTimeout(() => {
      /* Reset to idle */
      setPhase("idle");
    }, 800);

    return () => {
      clearTimeout(flashTimer);
      clearTimeout(openTimer);
      clearTimeout(doneTimer);
    };
  }, [pathname]);

  /* Build class names based on current phase */
  const wrapperClass = [
    phase === "closing" || phase === "flash" ? "tv-off-active" : "",
    phase === "flash" ? "tv-off-flash" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClass}>
      <div className="tv-off-top" />
      <div className="tv-off-bottom" />
      <div className="tv-off-line" />
    </div>
  );
}
