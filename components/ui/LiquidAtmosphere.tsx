"use client";

/**
 * LiquidAtmosphere — the flowing pigment-under-glass material behind
 * hero content (see LiquidField + lib/liquidMaterial.ts; this used to
 * be three blurred circles drifting — Astra's handoff 2026-09-11
 * replaced them with one connected field).
 *
 * Sits at -z behind content, so the PARENT must carry
 * `relative isolate` (same pattern as ThemeBackdrop) — without
 * `isolate` the -z-10 layer can slip behind the parent's background
 * and vanish.
 *
 * Variants:
 *  - "panel": the richest expression, boxed inside a hero panel
 *  - "page":  a full-page top wash, veiled so it dissolves toward
 *             the edges instead of ending in a line
 *
 * PERFORMANCE (2026-09-15): the field is created only once this panel
 * comes NEAR the viewport. The home page alone declares four of these,
 * and each one is a live WebGL context with its own shader program and
 * palette poll — all of them paid for during the first load, most of
 * them for pigment two screens below the fold. Now the first screen
 * costs one context and the rest arrive as you scroll. They are never
 * torn down again: a context that flickers back and forth while
 * scrolling is worse than one that stays.
 */

import { useEffect, useRef, useState } from "react";
import LiquidField from "@/components/ui/LiquidField";

export default function LiquidAtmosphere({
  variant = "panel",
}: {
  variant?: "panel" | "page";
}) {
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  useEffect(() => {
    const node = box.current;
    if (!node) return;
    // No IntersectionObserver (very old WebView): just render it, on
    // the next frame so first paint still goes up without it.
    if (typeof IntersectionObserver === "undefined") {
      const frame = requestAnimationFrame(() => setLive(true));
      return () => cancelAnimationFrame(frame);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setLive(true);
          io.disconnect();
        }
      },
      // A screen of warning, so the material is already flowing by the
      // time the panel is actually looked at.
      { rootMargin: "400px 0px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={box}
      className={`absolute inset-0 -z-10 overflow-hidden pointer-events-none ${
        variant === "page" ? "liquid-veil" : ""
      }`}
      // margin 0, inline so nothing can outrank it (Luca 2026-09-25: a
      // flat strip along the bottom of the review panel). Hosts use
      // space-y-*, which in Tailwind v4 gives every child but the last
      // a margin-bottom — and on an absolute inset-0 box that margin
      // pulls the bottom edge UP, so the liquid stopped 24px short.
      style={{ margin: 0 }}
      aria-hidden="true"
    >
      {live && <LiquidField context={variant} />}
    </div>
  );
}
