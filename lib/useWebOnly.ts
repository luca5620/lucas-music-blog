"use client";

import { useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * "Is it safe to show WEBSITE-ONLY money stuff here?" (2026-10-25).
 *
 * The mirror image of lib/useIsNativeApp: same store trick (the
 * Capacitor bridge is in place before our JS and never changes, so
 * there's nothing to subscribe to), but the SERVER answer is false —
 * "don't show". useIsNativeApp defaults to the web because a web
 * visitor must never get app chrome; here the risk runs the other way:
 * a support link or price must never be in the HTML the app receives,
 * not even for the instant before hydration (Apple 3.1.1 / 3.1.3).
 * Web visitors see it one render later, which for a footer link and
 * the /support panel is invisible.
 */
const subscribe = () => () => {};
const getSnapshot = () => !isNativeApp();
const getServerSnapshot = () => false;

export function useWebOnly(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
