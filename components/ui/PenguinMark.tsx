"use client";

import { useEffect, useRef, useState } from "react";
import { hapticTap } from "@/lib/native";

/** The mascot: a WHOLE standing penguin (Luca 2026-09-15 — "like it's a
 * standalone thing, it stands there, not with a circle like the original"),
 * so the asset is 3:4 portrait and nothing is masked into a badge.
 *
 * Offline Blender frames: no canvas, render loop, or second WebGL context.
 * The still stays beneath the sequence, so loading/failure never blanks Home.
 * Its parent link supplies the accessible name; this image is decorative.
 */
export default function PenguinMark({ className = "h-8 sm:h-9 aspect-[3/4]", width = 27, height = 36 }: {
  className?: string;
  width?: number;
  height?: number;
}) {
  const mark = useRef<HTMLSpanElement>(null);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [run, setRun] = useState(0);

  useEffect(() => {
    const node = mark.current;
    const link = node?.closest("a");
    if (!link) return;
    const root = document.documentElement;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)");
    const fine = matchMedia("(hover: hover) and (pointer: fine)");
    let image: HTMLImageElement | undefined;
    let loaded = false;
    let pending = false;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const allowed = () => !reduced.matches && !root.classList.contains("low-detail") &&
      (!root.classList.contains("native-app") || root.classList.contains("motion-on"));
    const stop = () => {
      pending = false;
      clearTimeout(timer);
      setPlaying(false);
      setLeaving(false);
    };
    const play = () => {
      if (!allowed()) return;
      clearTimeout(timer);
      setLeaving(false);
      if (loaded) {
        pending = false;
        setRun((value) => value + 1);
        setPlaying(true);
      }
      else pending = true;
    };
    const prepare = () => {
      if (!allowed()) { stop(); return; }
      if (image) return;
      image = new Image();
      image.onload = () => {
        if (disposed) return;
        loaded = true;
        setReady(true);
        if (pending && allowed()) play();
      };
      image.onerror = () => { if (!disposed) stop(); };
      image.src = "/penguin/header.webp";
    };
    const enter = () => {
      if (root.classList.contains("native-app") || !fine.matches) return;
      prepare(); play();
    };
    const leave = () => {
      pending = false;
      // Crossfade to the unchanged poster instead of snapping mid-nod.
      setLeaving(true);
      timer = setTimeout(stop, 110);
    };
    const tap = () => {
      if (!root.classList.contains("native-app")) return;
      void hapticTap();
      prepare(); play();
      // Never preventDefault: the existing Home link navigates immediately.
    };
    const observer = new MutationObserver(prepare);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    reduced.addEventListener("change", prepare);
    link.addEventListener("pointerenter", enter);
    link.addEventListener("pointerleave", leave);
    link.addEventListener("click", tap);
    prepare();
    return () => {
      disposed = true;
      clearTimeout(timer);
      observer.disconnect();
      reduced.removeEventListener("change", prepare);
      link.removeEventListener("pointerenter", enter);
      link.removeEventListener("pointerleave", leave);
      link.removeEventListener("click", tap);
    };
  }, []);

  return (
    <span ref={mark} aria-hidden="true" className={`penguin-mark relative inline-block shrink-0 overflow-hidden ${className}`}>
      {/* Native img keeps the tiny, already-sized assets out of an image
          optimization round trip. All three poster files total under 25KB. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/penguin/poster-32.webp" srcSet="/penguin/poster-32.webp 1x, /penguin/poster-64.webp 2x, /penguin/poster-96.webp 3x" alt="" width={width} height={height} className="penguin-poster" />
      {ready && playing && (
        <span key={run} className={`penguin-sequence${leaving ? " penguin-leaving" : ""}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/penguin/header.webp" alt="" width={1584} height={96} className="penguin-frames" onAnimationEnd={() => setPlaying(false)} onError={() => setPlaying(false)} />
        </span>
      )}
    </span>
  );
}
