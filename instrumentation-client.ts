/**
 * Sentry — browser side. Reports uncaught client errors: crashes in
 * components, failed hydration, unhandled promise rejections — the
 * bugs a visitor hits on their phone and never emails us about.
 *
 * Events don't go straight to sentry.io: withSentryConfig's
 * tunnelRoute (next.config.ts) proxies them through our own
 * /monitoring path, so (a) the strict CSP connect-src stays untouched
 * ('self' covers it) and (b) ad-blockers that eat sentry.io requests
 * don't blind us.
 *
 * PERFORMANCE (2026-09-15). Sentry was the single biggest thing the
 * app downloaded before it could respond: 424KB uncompressed, larger
 * than Supabase, parsed on the main thread during the first load of
 * every page. A crash reporter earning that spot in the critical path
 * is the tail wagging the dog, so the SDK is now imported when the
 * browser is IDLE, after first paint.
 *
 * The cost of doing that honestly: for the first moment of a page
 * there is no Sentry to catch anything. So this file installs two
 * plain listeners immediately, buffers whatever they catch, and
 * replays it into Sentry once the SDK arrives — errors during boot
 * are exactly the ones worth keeping, and they are still reported,
 * just a second later.
 */

type BufferedError = { error: unknown; kind: "error" | "unhandledrejection" };

const buffer: BufferedError[] = [];
let sentry: typeof import("@sentry/nextjs") | null = null;

const onError = (event: ErrorEvent) => {
  if (sentry) return; // the SDK's own handlers have it from here
  buffer.push({ error: event.error ?? event.message, kind: "error" });
};
const onRejection = (event: PromiseRejectionEvent) => {
  if (sentry) return;
  buffer.push({ error: event.reason, kind: "unhandledrejection" });
};

if (typeof window !== "undefined") {
  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onRejection);

  const start = async () => {
    try {
      const mod = await import("@sentry/nextjs");
      mod.init({
        dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

        // Errors only — no tracing, no session replay. Keeps the
        // download small and the free quota focused on real crashes.
        tracesSampleRate: 0,
        sendDefaultPii: false,
        enabled: process.env.NODE_ENV === "production",

        // Supabase auth-js guards session refresh with the Web Locks
        // API and forcibly steals the lock when a waiter times out —
        // the loser's promise rejects with this message. Benign (the
        // session stays valid), fires mostly on iOS WKWebView after
        // backgrounding, and is an upstream issue, not ours.
        ignoreErrors: [/Lock was stolen by another request/],
      });
      sentry = mod;
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      for (const item of buffer.splice(0)) {
        mod.captureException(item.error, {
          tags: { buffered: "boot", kind: item.kind },
        });
      }
    } catch {
      /* Reporting failing must never be the thing that breaks a page. */
    }
  };

  const whenIdle = () => {
    const idle = (
      window as unknown as {
        requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
      }
    ).requestIdleCallback;
    // Safari has no requestIdleCallback; a timeout is close enough for
    // something whose only requirement is "not during the first paint".
    if (idle) idle(() => void start(), { timeout: 4000 });
    else setTimeout(() => void start(), 2000);
  };

  if (document.readyState === "complete") whenIdle();
  else window.addEventListener("load", whenIdle, { once: true });
}

/**
 * Lets Sentry name errors after the route the user was navigating to.
 * Next calls this on every client navigation; before the SDK lands it
 * is a no-op, which is the correct behaviour rather than a reason to
 * load 424KB earlier.
 */
export function onRouterTransitionStart(
  ...args: Parameters<typeof import("@sentry/nextjs").captureRouterTransitionStart>
) {
  sentry?.captureRouterTransitionStart(...args);
}
