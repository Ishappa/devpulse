/**
 * "Top movers" leaderboard backed by a Redis sorted set.
 *
 * Updated on the WRITE path (ingest), read with ZREVRANGE — O(log n) ranked reads of
 * the hottest entities without touching Postgres. This is the read/write decoupling at
 * the cache layer: user-facing "top movers" never triggers a DB query.
 */
import 'server-only';
import { redis } from '@/lib/redis';

const KEY = 'leaderboard:momentum';

export async function recordScore(entityId: number, score: number): Promise<void> {
  await redis.zadd(KEY, { score, member: String(entityId) });
}

/** Top N entity ids by momentum (highest first). */
export async function topMovers(n = 10): Promise<number[]> {
  const ids = await redis.zrange<string[]>(KEY, 0, n - 1, { rev: true });
  return ids.map(Number);
}
