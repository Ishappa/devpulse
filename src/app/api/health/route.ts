/**
 * GET /api/health — liveness + dependency + data-freshness check.
 *
 * We report "time since last successful ingest" so monitoring can alert on the ABSENCE
 * of success (stale data), not just on errors — the failure mode that's otherwise invisible.
 */
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { snapshots } from '@/lib/db/schema';
import { redis } from '@/lib/redis';
import { ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const checks: Record<string, unknown> = {};
  let healthy = true;

  try {
    await db.execute(sql`select 1`);
    checks.db = 'ok';
  } catch {
    checks.db = 'down';
    healthy = false;
  }

  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch {
    checks.redis = 'down';
    healthy = false;
  }

  try {
    const [row] = await db
      .select({ last: sql<string>`max(${snapshots.capturedAt})` })
      .from(snapshots);
    const last = row?.last ? new Date(row.last) : null;
    const ageMin = last ? Math.round((Date.now() - last.getTime()) / 60000) : null;
    checks.lastIngestMinutesAgo = ageMin;
    // Ingest runs every 15 min; >45 min stale is a problem.
    if (ageMin != null && ageMin > 45) healthy = false;
  } catch {
    checks.lastIngestMinutesAgo = 'unknown';
  }

  return healthy ? ok({ status: 'healthy', checks }) : fail(503, 'INTERNAL', { status: 'degraded', checks });
}
