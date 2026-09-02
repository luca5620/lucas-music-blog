"use client";

import { useSyncExternalStore } from "react";
import { isNativeApp } from "@/lib/native";

/**
 * "Are we inside the iOS/Android shell?" — the one place that answers it.
 *
 * Six components used to ask this the same way: `useState(false)` plus
 * `useEffect(() => setNative(isNativeApp()), [])`. That works, but it's
 * a setState-in-effect, which means an extra render pass after paint on
 * every one of them — and it's the pattern the React Compiler lint rule
 * flags, because reading an external system is exactly what
 * useSyncExternalStore is for.
 *
 * The server snapshot is always false: SSR can't know, and the web is
 * the safe default (a web visitor must never get app-only chrome). The
 * client snapshot reads the injected Capacitor bridge, which is in
 * place before any of our JS runs and never changes afterwards — so
 * subscribe() has nothing to listen to and returns a no-op unsubscribe.
 *
 * Both snapshot functions return a plain boolean, so React's identity
 * check is stable and this can't loop.
 */

/** Nothing to subscribe to — the answer is fixed for the page's life. */
const subscribe = () => () => {};

const getSnapshot = () => isNativeApp();

const getServerSnapshot = () => false;

export function useIsNativeApp(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
