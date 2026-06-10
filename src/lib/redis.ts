/**
 * Upstash Redis client + read-through cache with stale-while-revalidate.
 *
 * Upstash uses an HTTP/REST API (no persistent TCP socket), which is exactly what
 * serverless functions need — no connection pool to exhaust.
 *
 * The cache helper implements SWR: an expired key still returns its value immediately
 * and refreshes in the background, so users never wait on a cold DB read. A short
 * single-flight lock prevents a cache stampede when a hot key expires.
 */
import 'server-only';
import { Redis } from '@upstash/redis';
import { env } from '@/lib/env';

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN,
});

interface Wrapped<T> {
  v: T;
  exp: number; // epoch ms after which the value is stale
}

/** Add ±10% jitter so many keys don't expire on the same tick (stampede avoidance). */
function jitter(ttlMs: number): number {
  const delta = ttlMs * 0.1;
  // deterministic-enough spread without Math.random's resume hazards in workers
  return ttlMs + (delta - 2 * delta * (Date.now() % 2 === 0 ? 0 : 1));
}

async function refresh<T>(key: string, ttlSeconds: number, loader: () => Promise<T>): Promise<T> {
  const lockKey = `lock:${key}`;
  const gotLock = await redis.set(lockKey, '1', { nx: true, px: 5000 });
  if (!gotLock) {
    // Someone else is already refreshing; caller falls back to stale value.
    const existing = await redis.get<Wrapped<T>>(key);
    if (existing) return existing.v;
  }
  try {
    const value = await loader();
    const exp = Date.now() + jitter(ttlSeconds * 1000);
    // Keep the physical key alive a bit past logical expiry so SWR can serve stale.
    await redis.set<Wrapped<T>>(key, { v: value, exp }, { ex: ttlSeconds * 3 });
    return value;
  } finally {
    if (gotLock) await redis.del(lockKey);
  }
}

/**
 * Read-through cache. On a fresh hit, returns immediately. On a stale hit, returns the
 * stale value and refreshes in the background. On a miss, loads synchronously.
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  loader: () => Promise<T>,
): Promise<T> {
  const hit = await redis.get<Wrapped<T>>(key);
  if (hit) {
    if (hit.exp > Date.now()) return hit.v; // fresh
    // stale: serve now, refresh async (don't await)
    void refresh(key, ttlSeconds, loader).catch(() => undefined);
    return hit.v;
  }
  return refresh(key, ttlSeconds, loader); // cold miss
}

/** Invalidate a cache key (called by the ingest worker on write). */
export async function invalidate(...keys: string[]): Promise<void> {
  if (keys.length) await redis.del(...keys);
}
