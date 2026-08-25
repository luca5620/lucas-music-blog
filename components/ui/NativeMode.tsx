"use client";

import { useEffect } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * NativeMode — tags <html> with .native-app when the site is running
 * inside the iOS/Android shell (detected via the injected Capacitor
 * bridge). CSS scoped to .native-app can then strip the "this is a
 * webpage" tells — long-press callouts, tap flashes, text selection
 * on buttons — WITHOUT changing anything for browser visitors.
 *
 * Because this ships with the website, it reaches already-installed
 * apps instantly on the next deploy — no App Store rebuild needed.
 */
export default function NativeMode() {
  useEffect(() => {
    if (!isNativeApp()) return;
    const root = document.documentElement;
    root.classList.add("native-app");

    // Lock zoom in the shell only. Apps don't pinch-zoom their chrome;
    // WKWebView honors maximum-scale/user-scalable (unlike Safari, which
    // ignores it for accessibility — exactly why we never put this in
    // the global viewport meta for web visitors).
    const meta = document.querySelector('meta[name="viewport"]');
    meta?.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    );

    // THERMAL MODE round 2: decorative motion follows the finger.
    // Any touch/scroll turns the animations on; 12 idle seconds
    // later they pause in place (see the .motion-on rules at the
    // bottom of globals.css). While the set holds still the GPU can
    // finally nap — that idle burn was what warmed the phone.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wake = () => {
      root.classList.add("motion-on");
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => root.classList.remove("motion-on"), 12_000);
    };
    wake(); // launch alive — first stillness comes after first idle

    // capture:true so scrolls inside nested containers (chat panels,
    // dropdown lists) count as activity too.
    window.addEventListener("touchstart", wake, { passive: true });
    window.addEventListener("scroll", wake, { passive: true, capture: true });

    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener("touchstart", wake);
      window.removeEventListener("scroll", wake, { capture: true });
    };
  }, []);

  return null;
}
