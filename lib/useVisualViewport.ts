"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * The VISUAL viewport — the part of the page actually on screen once
 * the on-screen keyboard has taken its share and iOS has panned
 * whatever it panned. `position: fixed` pins to the LAYOUT viewport,
 * which the keyboard doesn't shrink, so anything that must sit
 * exactly above the keyboard (the room chat sheet while typing) has
 * to read this instead.
 *
 * It's an external system with its own events (resize + scroll on
 * window.visualViewport), so it's exposed through useSyncExternalStore
 * rather than a measure-in-effect. Pass `enabled = false` to stop
 * listening (and get null) when a component doesn't need it right now
 * — e.g. the chat only glues to the viewport while the composer is
 * focused.
 *
 * Snapshot identity: useSyncExternalStore re-renders whenever
 * getSnapshot returns a different reference, so the last box is cached
 * and re-used until one of its numbers actually changes — otherwise
 * every call would be "new" and React would loop.
 */

export interface ViewportBox {
  /** Offset of the visual viewport from the layout viewport's top. */
  top: number;
  /** Height of the visible area. */
  height: number;
  /** window.innerHeight at the same moment — the layout height. */
  innerHeight: number;
}

let cached: ViewportBox | null = null;

function readBox(): ViewportBox | null {
  if (typeof window === "undefined") return null;
  const vv = window.visualViewport;
  if (!vv) return null;
  const next = {
    top: vv.offsetTop,
    height: vv.height,
    innerHeight: window.innerHeight,
  };
  if (
    cached &&
    cached.top === next.top &&
    cached.height === next.height &&
    cached.innerHeight === next.innerHeight
  ) {
    return cached;
  }
  cached = next;
  return cached;
}

const getServerSnapshot = () => null;
const getNull = () => null;
const subscribeNothing = () => () => {};

export function useVisualViewport(enabled: boolean = true): ViewportBox | null {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const vv = typeof window !== "undefined" ? window.visualViewport : null;
      if (!vv) return () => {};
      vv.addEventListener("resize", onChange);
      vv.addEventListener("scroll", onChange);
      return () => {
        vv.removeEventListener("resize", onChange);
        vv.removeEventListener("scroll", onChange);
      };
    },
    []
  );

  return useSyncExternalStore(
    enabled ? subscribe : subscribeNothing,
    enabled ? readBox : getNull,
    getServerSnapshot
  );
}
