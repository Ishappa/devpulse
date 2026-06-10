/**
 * GET /api/feed — the authenticated user's personalized momentum feed.
 * Joins the user's watchlist to the latest snapshots, ranked by momentum.
 * Per-user, so not page-cacheable; the query result is Redis-cached 60s per user.
 */
import { desc, eq, inArray } from 'drizzle-orm';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { entities, snapshots, watches } from '@/lib/db/schema';
import { cached } from '@/lib/redis';
import { ok, fail } from '@/lib/api';
import type { EntitySummary } from '@/schemas';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await auth();
  const userId = session?.user?.dbId;
  if (!userId) return fail(401, 'UNAUTHORIZED');

  try {
    const data = await cached<EntitySummary[]>(`feed:${userId}`, 60, async () => {
      const watched = await db
        .select({ entityId: watches.entityId })
        .from(watches)
        .where(eq(watches.userId, userId));
      const ids = watched.map((w) => w.entityId);
      if (ids.length === 0) return [];

      const latest = db
        .selectDistinctOn([snapshots.entityId], {
          entityId: snapshots.entityId,
          stars: snapshots.stars,
          starsDelta: snapshots.starsDelta,
          hnPoints: snapshots.hnPoints,
          hnComments: snapshots.hnComments,
          momentumScore: snapshots.momentumScore,
          capturedAt: snapshots.capturedAt,
        })
        .from(snapshots)
        .where(inArray(snapshots.entityId, ids))
        .orderBy(snapshots.entityId, desc(snapshots.capturedAt))
        .as('latest');

      const rows = await db
        .select({
          id: entities.id,
          type: entities.type,
          name: entities.name,
          url: entities.url,
          description: entities.description,
          language: entities.language,
          momentumScore: latest.momentumScore,
          stars: latest.stars,
          starsDelta: latest.starsDelta,
          hnPoints: latest.hnPoints,
          hnComments: latest.hnComments,
          capturedAt: latest.capturedAt,
        })
        .from(latest)
        .innerJoin(entities, eq(entities.id, latest.entityId))
        .orderBy(desc(latest.momentumScore));

      return rows.map((r) => ({
        id: r.id,
        type: r.type as EntitySummary['type'],
        name: r.name,
        url: r.url,
        description: r.description,
        language: r.language,
        momentumScore: Number(r.momentumScore),
        stars: r.stars,
        starsDelta: r.starsDelta,
        hnPoints: r.hnPoints,
        hnComments: r.hnComments,
        capturedAt: r.capturedAt.toISOString(),
      }));
    });

    return ok({ data });
  } catch (err) {
    console.error('[api/feed] failed', err);
    return fail(500, 'INTERNAL');
  }
}
