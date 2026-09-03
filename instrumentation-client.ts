/**
 * Sentry — browser side. Loaded automatically by Next.js on every
 * page. Reports uncaught client errors: crashes in components, failed
 * hydration, unhandled promise rejections — the bugs a visitor hits
 * on their phone and never emails us about.
 *
 * Events don't go straight to sentry.io: withSentryConfig's
 * tunnelRoute (next.config.ts) proxies them through our own
 * /monitoring path, so (a) the strict CSP connect-src stays untouched
 * ('self' covers it) and (b) ad-blockers that eat sentry.io requests
 * don't blind us.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Errors only — no tracing, no session replay. Keeps the JS bundle
  // small (replay alone is ~50KB gzipped) and the free quota focused
  // on actual crashes.
  tracesSampleRate: 0,
  sendDefaultPii: false,
  enabled: process.env.NODE_ENV === "production",

  // Supabase auth-js guards session refresh with the Web Locks API and
  // forcibly steals the lock when a waiter times out — the loser's
  // promise rejects with this message. Benign (the session stays
  // valid), fires mostly on iOS WKWebView after backgrounding, and is
  // an upstream issue, not ours. Don't page on it.
  ignoreErrors: [/Lock was stolen by another request/],
});

// Lets Sentry name errors after the route the user was navigating to.
export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
