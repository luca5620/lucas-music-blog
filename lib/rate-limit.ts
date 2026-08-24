/**
 * Rate limiter — Upstash Redis when configured, in-memory fallback.
 *
 * With UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN set, counts
 * live in one shared Redis, so a limit means what it says across
 * every Vercel instance. Without them (local dev, missing config) it
 * falls back to the old per-instance in-memory buckets — imperfect,
 * but the site keeps working.
 *
 * Redis errors FAIL OPEN (request allowed, error logged): a hiccup at
 * Upstash must never take the whole API down with it.
 *
 * Usage in a route handler:
 *   const limited = await rateLimit(`comments:${user.id}`, 10, 60_000);
 *   if (limited) return limited; // 429 response ready to return
 */
import { NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

const url = process.env.UPSTASH_REDIS_REST_URL;
const token = process.env.UPSTASH_REDIS_REST_TOKEN;
const redis = url && token ? new Redis({ url, token }) : null;

function tooMany(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "Too many requests — slow down a little." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } }
  );
}

/* ---- Shared counter: fixed window in Redis ---- */

async function redisLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<NextResponse | null> {
  const k = `rl:${key}`;
  try {
    const [count, ttl] = await redis!
      .pipeline()
      .incr(k)
      .pttl(k)
      .exec<[number, number]>();

    // Fresh key (or one that somehow lost its expiry): start the window.
    if (ttl < 0) {
      await redis!.pexpire(k, windowMs);
    }

    if (count > max) {
      const msLeft = ttl > 0 ? ttl : windowMs;
      return tooMany(Math.max(1, Math.ceil(msLeft / 1000)));
    }
    return null;
  } catch (err) {
    console.error("rate-limit: redis unreachable, failing open:", err);
    return null;
  }
}

/* ---- Fallback: per-instance in-memory buckets ---- */

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

function memoryLimit(
  key: string,
  max: number,
  windowMs: number
): NextResponse | null {
  const now = Date.now();
  prune(now);

  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return null;
  }

  bucket.count += 1;
  if (bucket.count > max) {
    return tooMany(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)));
  }
  return null;
}

/**
 * Returns null if the request is allowed, or a ready-made 429 NextResponse
 * if the key has exceeded `max` calls within `windowMs`.
 */
export async function rateLimit(
  key: string,
  max: number,
  windowMs: number
): Promise<NextResponse | null> {
  if (redis) return redisLimit(key, max, windowMs);
  return memoryLimit(key, max, windowMs);
}
