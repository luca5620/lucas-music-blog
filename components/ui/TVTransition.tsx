"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";

/**
 * TVTransition — Channel-change page transition.
 * When the route changes:
 * 1. A warm analog click SFX plays
 * 2. Two black bars close from top and bottom
 * 3. A brief white flash line appears
 * 4. Bars open again revealing the new page
 *
 * Now rendered INSIDE the DSCaseFrame's .ds-cover div, so the
 * transition is clipped to the cover art area (via contain: paint).
 */

function playWarmClick() {
  try {
    const ctx = new AudioContext();

    // Analog relay click — filtered triangle wave
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(600, ctx.currentTime);
    filter.Q.setValueAtTime(1, ctx.currentTime);

    osc.type = "triangle";
    osc.frequency.setValueAtTime(300, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.05);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.07);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.07);

    // Tiny filtered noise tail
    const bufferSize = ctx.sampleRate * 0.04;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.2));
    }
    const noise = ctx.createBufferSource();
    const noiseFilter = ctx.createBiquadFilter();
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(400, ctx.currentTime);
    const noiseGain = ctx.createGain();
    noise.buffer = noiseBuffer;
    noiseGain.gain.setValueAtTime(0.04, ctx.currentTime);
    noise.connect(noiseFilter).connect(noiseGain).connect(ctx.destination);
    noise.start();
  } catch {
    /* Silently fail — audio is optional */
  }
}

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

    /* Play warm click SFX */
    playWarmClick();

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
