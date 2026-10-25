/**
 * "Top-level" navigation marks (Luca 2026-10-25): the profile's ← Back
 * should only show when you clearly came FROM somewhere (a review, a
 * comment, a feed), not when you opened your own profile from the tab
 * bar's Profile button or the top-right menu. Those two links call
 * markNavRoot(href) on click; the profile's BackLink calls
 * consumeNavRoot() when it mounts and hides itself if the mark matches
 * the page it's on.
 *
 * sessionStorage, not React state, because the click happens in the
 * app chrome and the read happens in the next page. The mark carries a
 * timestamp so a stale one (a tap that never navigated) can't hide the
 * button on some later visit, and it's removed as soon as it's read.
 */

const KEY = "pmr-nav-root";
/** A mark older than this didn't come from the tap that opened this page. */
const MAX_AGE_MS = 10_000;

/** Remember that `href` is being opened from top-level navigation. */
export function markNavRoot(href: string) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ href, t: Date.now() }));
  } catch {
    /* storage refused (private mode): the back button just shows */
  }
}

/** True when the current page was opened from top-level navigation. Clears the mark. */
export function consumeNavRoot(): boolean {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return false;
    sessionStorage.removeItem(KEY);
    const { href, t } = JSON.parse(raw) as { href?: string; t?: number };
    if (!href || !t || Date.now() - t > MAX_AGE_MS) return false;
    return decodeURIComponent(window.location.pathname) === decodeURIComponent(href);
  } catch {
    return false;
  }
}
