/**
 * Sliding-window rate limiting backed by Upstash Redis.
 *
 * Two tiers:
 *  - `publicLimiter`  — per-IP, protects public read endpoints from scraping/abuse.
 *  - `authedLimiter`  — per-user, more generous, for authenticated mutations/reads.
 *
 * Sliding window (vs fixed) avoids the burst-at-boundary problem where 2x the limit
 * can slip through across a window edge.
 */
import 'server-only';
import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/redis';

export const publicLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(30, '10 s'),
  prefix: 'rl:pub',
  analytics: true,
});

export const authedLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '10 s'),
  prefix: 'rl:user',
  analytics: true,
});

/** Best-effort client IP from forwarding headers (Vercel sets x-forwarded-for). */
export function clientIp(headers: Headers): string {
  const fwd = headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0]!.trim();
  return headers.get('x-real-ip') ?? '127.0.0.1';
}

export interface LimitResult {
  success: boolean;
  retryAfter: number; // seconds until reset
}

export async function checkLimit(limiter: Ratelimit, identifier: string): Promise<LimitResult> {
  const { success, reset } = await limiter.limit(identifier);
  const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return { success, retryAfter };
}
