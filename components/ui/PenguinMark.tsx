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
 *
 * CHRISTMAS 2026: the image now sits in a small wrapper together with
 * a Santa hat (Luca, 2026-11-02; generated art since the same day). The hat is always in the markup but
 * only displayed under html.xmas (lib/season.ts decides). The greeting
 * animation moved from the image to the WRAPPER so the hat dips and
 * tilts with the bird instead of floating still above a moving head —
 * same keyframes, same pivot point, so nothing looks different the
 * rest of the year.
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
  const mark = useRef<HTMLSpanElement>(null);

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
    <span
      ref={mark}
      onClick={replay}
      onAnimationEnd={() => mark.current?.classList.remove("penguin-tapped")}
      className="penguin-mark-wrap shrink-0"
      aria-hidden="true"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/penguin/mark-44.webp"
        srcSet="/penguin/mark-44.webp 1x, /penguin/mark-88.webp 2x, /penguin/mark-132.webp 3x"
        alt=""
        width={width}
        height={height}
        className={`penguin-mark ${className}`}
      />
      <SantaHat />
    </span>
  );
}

/**
 * The Santa hat (Christmas 2026) — Luca's generated art (ChatGPT,
 * 2026-11-02; prompt in docs/marketing/christmas-2026-art.md), which
 * replaced the first hand-drawn SVG. A hat ON ITS OWN, laid over the
 * real penguin, because a generator asked for "the penguin in a hat"
 * redraws the penguin too. Trimmed transparent WebP in
 * public/seasonal/ (128px and 256px wide for 1x/2x+ screens).
 * Hidden outside the season by CSS (.penguin-santa).
 */
function SantaHat() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="penguin-santa"
      src="/seasonal/santa-hat-128.webp"
      srcSet="/seasonal/santa-hat-128.webp 1x, /seasonal/santa-hat-256.webp 2x"
      alt=""
      aria-hidden="true"
      width={128}
      height={103}
      decoding="async"
    />
  );
}
