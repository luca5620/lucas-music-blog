/**
 * Next.js instrumentation hook — runs once when the server starts,
 * before anything else. This is where Sentry's server/edge halves get
 * loaded (the browser half lives in instrumentation-client.ts).
 */
import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("./sentry.edge.config");
  }
}

// Called by Next.js for every error in server components / route
// handlers — this is what actually files server-side crash reports.
export const onRequestError = Sentry.captureRequestError;
