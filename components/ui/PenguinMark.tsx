"use client";

/**
 * PenguinMark — the mascot, free-standing (Luca 2026-09-15: "i dont
 * want a circle like a profile picture... no boxing in the penguin,
 * have it be free, and with animations").
 *
 * So: no round mask, no border, no plate. The image is the photo
 * mascot cut out of its grey backdrop with real alpha on every down
 * tip (scripts/penguin-mark.py), sized by height because the height is
 * what a header row fixes. At 44px it costs 3KB — the old round logo
 * shipped the full 860KB photo on every page.
 *
 * The greeting animation is plain CSS on one image (globals.css, THE
 * MASCOT). Web plays it on hover of the link the mark sits in, which
 * needs no JavaScript at all; this component exists for the app, where
 * there is no hover — a tap replays it and fires the same haptic every
 * other app control does.
 */

import { useRef } from "react";
import { hapticTap, isNativeApp } from "@/lib/native";

export default function PenguinMark({
  className = "h-9 sm:h-11",
  width = 40,
  height = 44,
}: {
  className?: string;
  width?: number;
  height?: number;
}) {
  const mark = useRef<HTMLImageElement>(null);

  const replay = () => {
    // Web already played it on hover; replaying on click would fight
    // the navigation that is starting anyway.
    if (!isNativeApp()) return;
    void hapticTap();
    const node = mark.current;
    if (!node) return;
    node.classList.remove("penguin-tapped");
    void node.offsetWidth; // reflow, or the class re-add is a no-op
    node.classList.add("penguin-tapped");
  };

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={mark}
      src="/penguin/mark-44.webp"
      srcSet="/penguin/mark-44.webp 1x, /penguin/mark-88.webp 2x, /penguin/mark-132.webp 3x"
      alt=""
      aria-hidden="true"
      width={width}
      height={height}
      onClick={replay}
      onAnimationEnd={() => mark.current?.classList.remove("penguin-tapped")}
      className={`penguin-mark shrink-0 ${className}`}
    />
  );
}
