/**
 * Simple in-memory rate limiter (token bucket per key).
 *
 * Why in-memory? We run on Vercel serverless — each warm instance keeps its
 * own counters, so this is NOT a perfect global limit. It still stops the
 * common abuse case (one client hammering one instance in a tight loop)
 * without adding a Redis dependency. If the site grows, swap this for
 * Upstash Ratelimit with the same call shape.
 *
 * Usage in a route handler:
 *   const limited = rateLimit(`comments:${user.id}`, 10, 60_000);
 *   if (limited) return limited; // 429 response ready to return
 */
import { NextResponse } from "next/server";

interface Bucket {
  count: number;
  resetAt: number; // epoch ms when the window resets
}

// Module-level map survives between requests on a warm instance.
const buckets = new Map<string, Bucket>();

// Prevent unbounded memory growth: prune expired buckets occasionally.
function prune(now: number) {
  if (buckets.size < 5000) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

/**
 * Returns null if the request is allowed, or a ready-made 429 NextResponse
 * if the key has exceeded `max` calls within `windowMs`.
 */
export function rateLimit(
  key: string,
  max: number,
  windowMs: number
): NextResponse | null {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    // New window
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > max) {
    const retryAfterSec = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    return NextResponse.json(
      { error: "Too many requests — slow down a little." },
      { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }
  return null;
}
