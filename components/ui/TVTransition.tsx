"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";

/**
 * TVTransition — Channel-change page transition.
 * When the route changes:
 * 1. A channel-change SFX plays (generated with Web Audio API)
 * 2. Two black bars close from top and bottom
 * 3. A brief white flash line appears
 * 4. Bars open again revealing the new page
 *
 * Now rendered INSIDE the DSCaseFrame's .ds-cover div, so the
 * transition is clipped to the cover art area (via contain: paint).
 */

/**
 * Plays the page transition sound effect from an MP3 file.
 */
let sfxAudio: HTMLAudioElement | null = null;

function playChannelChangeSFX() {
  try {
    if (!sfxAudio) {
      sfxAudio = new Audio("/sounds/sicko-mode-sfx.mp3");
      sfxAudio.volume = 0.05;
    }
    sfxAudio.currentTime = 0;
    sfxAudio.play();
  } catch {
    /* Silently fail — audio is optional */
  }
}

export default function TVTransition() {
  const pathname = usePathname();
  const [phase, setPhase] = useState<"idle" | "closing" | "flash" | "opening">("idle");
  const prevPathname = useRef(pathname);
  const isFirstRender = useRef(true);

  /* Memoize the SFX function */
  const playSFX = useCallback(() => {
    playChannelChangeSFX();
  }, []);

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

    /* Play the channel-change sound effect */
    playSFX();

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
  }, [pathname, playSFX]);

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
