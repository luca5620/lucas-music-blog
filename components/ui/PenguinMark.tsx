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
 * a Santa hat (Luca, 2026-11-02). The hat is always in the markup but
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
 * The Santa hat (Christmas 2026). Drawn to sit on the mark's head,
 * tipped back a little with the tip flopping to the right: a red body
 * with a darker fold and a soft highlight, a fluffy white brim made of
 * overlapping puffs, and a pompom. Sized in % of the wrapper, so it
 * fits the 44px header mark and the bigger sign-in mark alike.
 * Hidden outside the season by CSS (.penguin-santa).
 */
function SantaHat() {
  return (
    <svg className="penguin-santa" viewBox="0 0 64 48" aria-hidden="true">
      {/* body */}
      <path d="M8 37 C 10 22, 22 9, 38 8 C 48 7.5, 55 12, 57 20 L 52 24 C 49 18, 44 16, 39 18 C 31 21, 27 29, 26 37 Z" fill="#d42a3c" />
      {/* fold / shadow side */}
      <path d="M39 18 C 44 16, 49 18, 52 24 L 57 20 C 55.5 15, 51 11.5, 45 10.5 C 46 13, 44 16, 39 18 Z" fill="#a51d2c" />
      <path d="M26 37 C 27 29, 31 21, 39 18 C 33 22, 30 29, 30 37 Z" fill="#b8202f" />
      {/* highlight */}
      <path d="M14 33 C 16 23, 24 14, 34 12" fill="none" stroke="#ef6574" strokeWidth="2" strokeLinecap="round" opacity=".7" />
      {/* fluffy brim */}
      <g fill="#f6f2ea">
        <ellipse cx="17" cy="38" rx="11" ry="6" />
        <ellipse cx="9" cy="38.5" rx="6" ry="5.2" />
        <ellipse cx="26" cy="38.5" rx="6.5" ry="5.4" />
        <ellipse cx="18" cy="35.5" rx="8" ry="4" />
      </g>
      <path d="M5 40.5 C 12 44, 24 44, 31 40.5" fill="none" stroke="#d8d1c4" strokeWidth="1.6" strokeLinecap="round" />
      {/* pompom */}
      <circle cx="56" cy="24" r="6.2" fill="#f6f2ea" />
      <circle cx="57.5" cy="26" r="3.2" fill="#e2dbcf" />
      <circle cx="54.2" cy="21.8" r="1.6" fill="#ffffff" />
    </svg>
  );
}
