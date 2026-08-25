import { NextResponse } from "next/server";
import * as Sentry from "@sentry/nextjs";

/**
 * TEMPORARY — Sentry pipeline debugging round 2 (2026-08-25).
 * The tunnel/browser path is verified; the thrown-route-error path
 * didn't show up in the dashboard. Two modes to isolate why:
 *   ?boom=1    → throws (tests Next's onRequestError hook)
 *   ?capture=1 → explicit captureException + flush (tests the SDK's
 *                delivery from a Vercel function at all)
 * DELETE THIS FILE once the verdict is in.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("capture") === "1") {
    Sentry.captureException(
      new Error("SENTRY TEST B — explicit capture from server")
    );
    // Serverless functions can freeze right after responding; flush
    // forces the event out before we return.
    const flushed = await Sentry.flush(4000);
    return NextResponse.json({
      ok: true,
      flushed,
      dsnSeen: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
      env: process.env.NODE_ENV,
    });
  }

  if (url.searchParams.get("boom") === "1") {
    throw new Error("SENTRY TEST A — thrown route error");
  }

  return NextResponse.json({ ok: true, hint: "?boom=1 or ?capture=1" });
}
