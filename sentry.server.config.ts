/**
 * Sentry — server side (Node). Loaded once per server boot via
 * instrumentation.ts. Reports uncaught errors from server components,
 * route handlers, and server actions.
 *
 * The DSN ("where do reports go") comes from the NEXT_PUBLIC_SENTRY_DSN
 * env var — set in Vercel's dashboard, never hardcoded. A DSN is not a
 * secret (it can only RECEIVE events, not read them), which is why the
 * NEXT_PUBLIC_ prefix is fine. With the var unset (e.g. local dev),
 * Sentry.init simply disables itself — zero noise, zero cost.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Errors only — no performance tracing. The free plan's quota is
  // for crashes we'd otherwise never hear about, not waterfalls.
  tracesSampleRate: 0,

  // Never attach request headers/cookies/IPs to events — we don't
  // need them to fix bugs, and users didn't sign up to be profiled.
  sendDefaultPii: false,

  // Local `npm run dev` errors belong in the terminal, not the dashboard.
  enabled: process.env.NODE_ENV === "production",
});
