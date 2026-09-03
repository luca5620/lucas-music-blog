"use client";

import { useSyncExternalStore } from "react";

/**
 * "Has this component hydrated on the client yet?" — the one place
 * that answers it.
 *
 * The old way was `useState(false)` + `useEffect(() => setMounted(true),
 * [])`: correct, but a setState-in-effect, which costs an extra render
 * pass after paint and is what the React Compiler lint rule flags.
 * "Am I on the client" is a fact about the outside world, and reading
 * the outside world is what useSyncExternalStore is for.
 *
 * How it works: React uses getServerSnapshot (false) for the server
 * render AND for the hydrating first client render — so the HTML the
 * two sides produce matches — then immediately re-renders with the
 * client snapshot (true). Nothing to subscribe to: the answer never
 * changes once it's true.
 *
 * Use it wherever a component must render nothing (or a placeholder)
 * until it's safe to touch `document` / `window` — portals, live
 * clocks, anything that reads the viewport.
 */

const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
