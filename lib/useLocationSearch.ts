"use client";

import { useSyncExternalStore } from "react";

/**
 * The page's query string (`window.location.search`), read the
 * useSyncExternalStore way.
 *
 * Why not useSearchParams: in the App Router it forces a Suspense
 * boundary around the whole client page (the login and signup pages
 * deliberately avoid that). Why not read it in an effect: that's a
 * setState-in-effect — one wasted render and the lint error to go
 * with it.
 *
 * The server snapshot is "" so the server HTML and the hydrating
 * client render agree; React re-renders with the real query string
 * right after hydration. Subscribes to popstate so a back/forward
 * navigation that changes the query is picked up too.
 */

function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

const getSnapshot = () => window.location.search;
const getServerSnapshot = () => "";

export function useLocationSearch(): string {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
