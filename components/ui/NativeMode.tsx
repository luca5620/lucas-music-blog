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
    document.documentElement.classList.add("native-app");

    // Lock zoom in the shell only. Apps don't pinch-zoom their chrome;
    // WKWebView honors maximum-scale/user-scalable (unlike Safari, which
    // ignores it for accessibility — exactly why we never put this in
    // the global viewport meta for web visitors).
    const meta = document.querySelector('meta[name="viewport"]');
    meta?.setAttribute(
      "content",
      "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover"
    );
  }, []);

  return null;
}
