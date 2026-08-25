/**
 * Sentry — edge runtime (the middleware, mostly: session refresh +
 * the admin gates run there). Same settings as the server config;
 * see sentry.server.config.ts for the reasoning.
 */
import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  enabled: process.env.NODE_ENV === "production",
});
