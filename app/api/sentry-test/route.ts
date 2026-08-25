import { NextResponse } from "next/server";

/**
 * TEMPORARY — Sentry pipeline verification (2026-08-25).
 * Throws one deliberate server error so we can confirm reports reach
 * the Sentry dashboard end-to-end. DELETE THIS FILE right after the
 * test — it's harmless (all it does is error), but it's clutter.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("boom") === "1") {
    throw new Error("SENTRY TEST — deliberate error, pipeline works");
  }
  return NextResponse.json({ ok: true, hint: "add ?boom=1 to throw" });
}
