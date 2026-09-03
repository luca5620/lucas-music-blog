"use client";

/**
 * PullToRefresh — the native pull-down gesture, app shell only
 * (Luca 2026-08-27: "pull to refresh is definitely a must").
 *
 * How it works: at scrollTop 0, a downward drag arms a fixed
 * indicator below the status bar (the page itself doesn't move —
 * the app's overscroll is hard-capped, so we draw our own feedback
 * instead of fighting the rubber band). Passing the threshold
 * flips it to ARMED (accent glow + haptic); release then calls
 * router.refresh() inside a transition, so the spinner holds until
 * the server components actually re-render with fresh data.
 *
 * Everything during the drag is refs + direct style writes — no
 * React state until the release, so tracking costs nothing per
 * frame. Listeners are passive; we never preventDefault.
 */

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { hapticTap } from "@/lib/native";
import { useIsNativeApp } from "@/lib/useIsNativeApp";

/** Drag distance (post-resistance px) that arms the refresh. */
const THRESHOLD = 64;
/** Cap so the indicator stops growing on a full-screen yank. */
const MAX_PULL = 110;
/** Raw finger-travel → indicator distance (rubbery feel). */
const RESISTANCE = 0.45;

export default function PullToRefresh() {
  const router = useRouter();
  const enabled = useIsNativeApp();
  const [refreshing, setRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();

  const indicatorRef = useRef<HTMLDivElement>(null);
  const startYRef = useRef<number | null>(null);
  const pullRef = useRef(0);
  const armedRef = useRef(false);

  // The transition ending = fresh data rendered → retract the disc.
  // Settled during render (derived from isPending) rather than in an
  // effect, so the disc retracts on the same frame the data lands.
  if (!isPending && refreshing) setRefreshing(false);

  useEffect(() => {
    if (!enabled) return;

    const paint = () => {
      const el = indicatorRef.current;
      if (!el) return;
      const p = Math.min(pullRef.current / THRESHOLD, 1);
      // Slides down from behind the status bar as the pull grows.
      el.style.transform = `translateX(-50%) translateY(${pullRef.current * 0.55}px) rotate(${pullRef.current * 2.4}deg)`;
      el.style.opacity = String(p);
      el.classList.toggle("ptr-armed", pullRef.current >= THRESHOLD);
    };

    const onStart = (e: TouchEvent) => {
      const scroller = document.scrollingElement;
      if (!scroller || scroller.scrollTop > 0) return;
      // Fullscreen broadcast up → this gesture belongs to the frame
      // (its own drag-to-exit / snap surfing). The page behind is
      // frozen at scrollTop 0, so without this check every pull
      // inside the channel would arm a refresh the viewer can't even
      // see — and a refreshed mix yanks the broadcast back to CH 01.
      if (document.querySelector(".surf-fullscreen")) return;
      startYRef.current = e.touches[0].clientY;
      pullRef.current = 0;
      armedRef.current = false;
    };

    const onMove = (e: TouchEvent) => {
      if (startYRef.current === null) return;
      const scroller = document.scrollingElement;
      // Bail if the page started scrolling normally mid-gesture.
      if (!scroller || scroller.scrollTop > 0) {
        startYRef.current = null;
        pullRef.current = 0;
        paint();
        return;
      }
      const dy = e.touches[0].clientY - startYRef.current;
      pullRef.current = dy > 0 ? Math.min(dy * RESISTANCE, MAX_PULL) : 0;
      // One haptic tick exactly when the pull arms.
      if (pullRef.current >= THRESHOLD && !armedRef.current) {
        armedRef.current = true;
        void hapticTap();
      } else if (pullRef.current < THRESHOLD) {
        armedRef.current = false;
      }
      paint();
    };

    const onEnd = () => {
      if (startYRef.current === null) return;
      const shouldRefresh = pullRef.current >= THRESHOLD;
      startYRef.current = null;
      pullRef.current = 0;
      paint();
      if (shouldRefresh) {
        setRefreshing(true);
        startTransition(() => router.refresh());
      }
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: true });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [enabled, router]);

  if (!enabled) return null;

  return (
    <div
      ref={indicatorRef}
      aria-hidden="true"
      className={`ptr-indicator ${refreshing ? "ptr-refreshing" : ""}`}
    >
      <span className="ptr-disc" />
    </div>
  );
}
