"use client";

import { useSyncExternalStore } from "react";

/**
 * LOW DETAIL MODE (Luca 2026-09-03: "a low-detail mode for the
 * website for users to toggle if they don't have a strong computer").
 *
 * The phone + app shell already run a GPU diet — the THERMAL MODE
 * rounds at the bottom of globals.css (still liquid, solid panels, no
 * full-screen overlays, decorative motion off). Desktop keeps the full
 * cinema by media query. This is the same diet
 * as a TOGGLE for any device: `html.low-detail` applies every thermal
 * rule regardless of viewport, so an old laptop or a budget Android in
 * a browser gets the app's still, cheap atmosphere.
 *
 * ON BY DEFAULT (Luca 2026-09-03: "it definitely is difficult to run
 * when I don't have hardware acceleration on"). A visitor with no
 * stored preference gets low detail; only an explicit "0" in storage
 * turns the full cinema on. So the heavy version is the opt-in now,
 * not the diet.
 *
 * The preference is PER DEVICE, not per account, on purpose — it
 * describes the machine, not the person — so it lives in localStorage
 * and works signed-out too. A tiny inline script in app/layout.tsx
 * reads the same key before first paint and stamps the class, so the
 * default visitor never sees a frame of the heavy version.
 *
 * The <html> class is the source of truth for readers (the inline
 * script may have set it even when storage is later refused), and
 * every change fires one window event so any mounted toggle re-reads.
 */

export const LOW_DETAIL_KEY = "pmr-low-detail";
export const LOW_DETAIL_CLASS = "low-detail";
const CHANGE_EVENT = "pmr-low-detail-change";

/** The exact script the layout inlines — kept here so key + class stay in one file. */
export const LOW_DETAIL_BOOT_SCRIPT = `var on=true;try{on=localStorage.getItem("${LOW_DETAIL_KEY}")!=="0"}catch(e){}if(on)document.documentElement.classList.add("${LOW_DETAIL_CLASS}")`;

export function isLowDetail(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.classList.contains(LOW_DETAIL_CLASS);
}

export function setLowDetail(on: boolean): void {
  if (typeof document === "undefined") return;
  try {
    // Both states are written explicitly; a MISSING key means the default (on).
    localStorage.setItem(LOW_DETAIL_KEY, on ? "1" : "0");
  } catch {
    /* storage refused (private mode) — the mode still applies for this page's life */
  }
  document.documentElement.classList.toggle(LOW_DETAIL_CLASS, on);
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(CHANGE_EVENT, onChange);
  // Another tab flipping the switch: mirror it here too.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== LOW_DETAIL_KEY) return;
    document.documentElement.classList.toggle(LOW_DETAIL_CLASS, e.newValue !== "0");
    onChange();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

// The default is on, so the server-rendered switch says "On" and only
// flips for the minority who opted out — no flash for the common case.
const getServerSnapshot = () => true;

/** Reactive "is low detail on?" — the default (true) during SSR, the real state after hydration. */
export function useLowDetail(): boolean {
  return useSyncExternalStore(subscribe, isLowDetail, getServerSnapshot);
}
