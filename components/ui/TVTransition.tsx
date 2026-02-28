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
 * Plays a short TV static / channel-change sound using Web Audio API.
 * No external audio file needed — generates white noise + click programmatically.
 */
function playChannelChangeSFX() {
  try {
    const ctx = new AudioContext();

    /* --- White noise burst (the "static" part) --- */
    const noiseDuration = 0.15;
    const noiseBuffer = ctx.createBuffer(1, ctx.sampleRate * noiseDuration, ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      /* Random noise with a quick fade-out envelope */
      const envelope = 1 - i / noiseData.length;
      noiseData[i] = (Math.random() * 2 - 1) * envelope;
    }
    const noiseSource = ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    /* Bandpass filter to make it sound more like TV static */
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 4000;
    filter.Q.value = 0.5;

    const noiseGain = ctx.createGain();
    noiseGain.gain.value = 0.15; /* not too loud */

    noiseSource.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(ctx.destination);
    noiseSource.start();

    /* --- Click / thunk at the start (the "switch" part) --- */
    const clickOsc = ctx.createOscillator();
    clickOsc.type = "sine";
    clickOsc.frequency.value = 150;

    const clickGain = ctx.createGain();
    clickGain.gain.setValueAtTime(0.3, ctx.currentTime);
    clickGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    clickOsc.connect(clickGain);
    clickGain.connect(ctx.destination);
    clickOsc.start();
    clickOsc.stop(ctx.currentTime + 0.05);

    /* Clean up audio context after sounds finish */
    setTimeout(() => ctx.close(), 500);
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
