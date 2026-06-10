/**
 * Shared, index-backed read queries. Used by the ingest worker (history) and the read
 * API (trending, search, detail). Raw SQL via Drizzle's `sql` where a window function
 * or DISTINCT ON is clearer than the query builder.
 */
import 'server-only';
import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { entities, snapshots } from '@/lib/db/schema';
import type { EntitySummary } from '@/schemas';
import type { ScoringSnapshot } from '@/lib/scoring';
import type { Cursor } from '@/lib/cursor';

/** Recent snapshots per entity, oldest→newest, for the scoring window. */
export async function getHistory(
  entityId: number,
  limit = 12,
): Promise<ScoringSnapshot[]> {
  const rows = await db
    .select({
      stars: snapshots.stars,
      hnPoints: snapshots.hnPoints,
      hnComments: snapshots.hnComments,
      capturedAt: snapshots.capturedAt,
    })
    .from(snapshots)
    .where(eq(snapshots.entityId, entityId))
    .orderBy(desc(snapshots.capturedAt))
    .limit(limit);
  return rows.reverse().map((r) => ({
    stars: r.stars,
    hnPoints: r.hnPoints,
    hnComments: r.hnComments,
    capturedAt: r.capturedAt,
  }));
}

/**
 * Latest snapshot per entity joined to entity metadata, ranked by momentum.
 * Uses DISTINCT ON (entity_id) ordered by captured_at DESC — index-backed, no full
 * window sort. Supports keyset pagination via the (score, id) cursor and optional
 * language / type / text filters.
 */
export async function getRanked(opts: {
  limit: number;
  cursor?: Cursor | null;
  language?: string;
  type?: string;
  q?: string;
}): Promise<EntitySummary[]> {
  const { limit, cursor, language, type, q } = opts;

  // Latest snapshot per entity.
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
    .orderBy(snapshots.entityId, desc(snapshots.capturedAt))
    .as('latest');

  const filters = [];
  if (language) filters.push(eq(entities.language, language));
  if (type) filters.push(eq(entities.type, type as never));
  if (q) filters.push(sql`${entities.name} ILIKE ${'%' + q + '%'}`);
  // Keyset: rows strictly "after" the cursor in (score DESC, id DESC) order.
  if (cursor) {
    filters.push(
      or(
        lt(latest.momentumScore, String(cursor.score)),
        and(eq(latest.momentumScore, String(cursor.score)), lt(entities.id, cursor.id)),
      ),
    );
  }

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
    .where(filters.length ? and(...filters) : undefined)
    .orderBy(desc(latest.momentumScore), desc(entities.id))
    .limit(limit);

  return rows.map(toSummary);
}

/** A single entity with its full snapshot series (for the detail page sparkline). */
export async function getEntityWithSeries(id: number): Promise<{
  entity: EntitySummary;
  series: { capturedAt: string; momentumScore: number; stars: number | null }[];
} | null> {
  const [ent] = await db.select().from(entities).where(eq(entities.id, id)).limit(1);
  if (!ent) return null;

  const snaps = await db
    .select()
    .from(snapshots)
    .where(eq(snapshots.entityId, id))
    .orderBy(snapshots.capturedAt)
    .limit(96);

  const latest = snaps.at(-1);
  return {
    entity: toSummary({
      id: ent.id,
      type: ent.type,
      name: ent.name,
      url: ent.url,
      description: ent.description,
      language: ent.language,
      momentumScore: latest?.momentumScore ?? '0',
      stars: latest?.stars ?? null,
      starsDelta: latest?.starsDelta ?? null,
      hnPoints: latest?.hnPoints ?? null,
      hnComments: latest?.hnComments ?? null,
      capturedAt: latest?.capturedAt ?? ent.createdAt,
    }),
    series: snaps.map((s) => ({
      capturedAt: s.capturedAt.toISOString(),
      momentumScore: Number(s.momentumScore),
      stars: s.stars,
    })),
  };
}

interface RankRow {
  id: number;
  type: string;
  name: string;
  url: string | null;
  description: string | null;
  language: string | null;
  momentumScore: string | number;
  stars: number | null;
  starsDelta: number | null;
  hnPoints: number | null;
  hnComments: number | null;
  capturedAt: Date | string;
}

function toSummary(r: RankRow): EntitySummary {
  return {
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
    capturedAt: r.capturedAt instanceof Date ? r.capturedAt.toISOString() : r.capturedAt,
  };
}
