"use client";

import { useRef } from "react";

/**
 * PressTapTarget — the in-app switch for press mode.
 *
 * The website toggles press mode with ?press=1 (see PressMode.tsx),
 * but the native app shell has no URL bar. So the footer's
 * "Found a problem?" text doubles as a hidden switch: five taps
 * within three seconds toggles the blur. Looks and reads exactly
 * like the plain text it wraps — no one finds it by accident.
 */
export default function PressTapTarget({
  children,
}: {
  children: React.ReactNode;
}) {
  const taps = useRef<number[]>([]);

  function onTap() {
    const now = Date.now();
    taps.current = [...taps.current.filter((t) => now - t < 3000), now];
    if (taps.current.length < 5) return;
    taps.current = [];

    const KEY = "pmr-press-mode";
    let on = false;
    try {
      on = localStorage.getItem(KEY) === "1";
      if (on) localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, "1");
    } catch {
      // Storage blocked — still toggle for this page-load.
      on = document.documentElement.classList.contains("press-mode");
    }
    document.documentElement.classList.toggle("press-mode", !on);
    alert(!on ? "Press mode ON — artwork blurred" : "Press mode OFF");
  }

  return <span onClick={onTap}>{children}</span>;
}
