/**
 * "This click was handled — it is not a navigation."
 *
 * NavigationPending shows the TUNING panel on any click that lands on
 * an internal link to a DIFFERENT path, and it deliberately does NOT
 * check `defaultPrevented`: Next's <Link> prevents the default on
 * every client-side navigation, so honouring that flag made the panel
 * never appear at all (the bug that shipped dead on 2026-09-01).
 *
 * That leaves no way for a component to say "I hijacked this click to
 * do something else, please don't blank the page" — which is exactly
 * what UserLink does when a press-and-hold opens the mini profile
 * instead of following the link (2026-09-16). Without this marker the
 * long press swapped the whole page for the loading panel, and since
 * the path never changed it sat there until the 8-second failsafe.
 *
 * So: one explicit flag on the NATIVE event, set by whoever hijacked
 * the click and read by NavigationPending. Deliberately not
 * `stopPropagation()` — React 19 delegates from the root container, so
 * where a synthetic handler sits relative to a document listener is an
 * implementation detail no component should have to reason about.
 */

/** Non-enumerable-ish private key; the name is the documentation. */
const HANDLED = "__pmrClickHandledNotNavigation";

type Marked = MouseEvent & { [HANDLED]?: true };

/**
 * Call from a click handler that consumed the click for something
 * other than navigating. Pass `event.nativeEvent` from React.
 */
export function markClickHandled(event: MouseEvent): void {
  (event as Marked)[HANDLED] = true;
}

/** True when some component already consumed this click. */
export function wasClickHandled(event: MouseEvent): boolean {
  return (event as Marked)[HANDLED] === true;
}
