/**
 * Ingest pipeline — the WRITE path.
 *
 * Orchestration (runIngest):
 *   1. gather candidates from GitHub + Hacker News (correlated by repo slug)
 *   2. upsert entities (idempotent on type+source_key)
 *   3. load per-entity history, compute raw scoring components
 *   4. compute cohort stats across the batch, then each entity's momentum score
 *   5. dispatch one persist job per entity — via QStash if configured, else inline
 *
 * Persistence (persistSnapshot) is a dumb, IDEMPOTENT writer: insert-on-conflict-do-
 * nothing keyed by (entity_id, captured_at). Because captured_at is fixed at
 * orchestration time and passed through the queue, an at-least-once redelivery reuses
 * the same key and is safely de-duplicated. The writer also updates the Redis
 * leaderboard and revalidates the entity's ISR page.
 */
import 'server-only';
import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { db } from '@/lib/db';
import { entities, snapshots } from '@/lib/db/schema';
import { searchTrendingRepos } from '@/lib/github';
import { getTopStoryIds, getItems, extractRepoSlug } from '@/lib/hackernews';
import {
  momentumScore,
  starVelocity,
  hnActivity,
  computeCohortStats,
  type ScoringSnapshot,
} from '@/lib/scoring';
import { getHistory } from '@/lib/queries';
import { recordScore } from '@/lib/leaderboard';
import { invalidate } from '@/lib/redis';

export interface Candidate {
  type: 'repo' | 'hn_story';
  sourceKey: string;
  name: string;
  url: string | null;
  description: string | null;
  language: string | null;
  stars: number | null;
  hnPoints: number | null;
  hnComments: number | null;
}

export const SnapshotWriteSchema = z.object({
  entityId: z.number().int().positive(),
  capturedAt: z.string(), // ISO
  stars: z.number().int().nullable(),
  starsDelta: z.number().int().nullable(),
  hnPoints: z.number().int().nullable(),
  hnComments: z.number().int().nullable(),
  momentumScore: z.number(),
});
export type SnapshotWrite = z.infer<typeof SnapshotWriteSchema>;

import { TRACKED_LANGUAGES, REPOS_PER_LANGUAGE, TRENDING_DAYS, HN_STORIES_LIMIT } from '@/config/tech';

/** Collect and correlate trending candidates from both upstreams. */
export async function gatherCandidates(): Promise<Candidate[]> {
  const since = new Date(Date.now() - TRENDING_DAYS * 86_400_000).toISOString().slice(0, 10);

  // Search each language in parallel so every language gets representation.
  const [langResults, storyIds] = await Promise.all([
    Promise.all(
      TRACKED_LANGUAGES.map((lang) =>
        searchTrendingRepos({ since, language: lang, perPage: REPOS_PER_LANGUAGE }).catch(() => []),
      ),
    ),
    getTopStoryIds(HN_STORIES_LIMIT).catch(() => [] as number[]),
  ]);

  const repos = langResults.flat();
  const map = new Map<string, Candidate>();

  for (const r of repos) {
    map.set(`repo:${r.full_name}`, {
      type: 'repo',
      sourceKey: r.full_name,
      name: r.full_name,
      url: r.html_url,
      description: r.description,
      language: r.language,
      stars: r.stargazers_count,
      hnPoints: null,
      hnComments: null,
    });
  }

  const stories = await getItems(storyIds).catch(() => []);
  for (const item of stories) {
    if (item.type && item.type !== 'story') continue;
    const slug = extractRepoSlug(item);
    if (slug && map.has(`repo:${slug}`)) {
      // Cross-source corroboration: HN discussion about a tracked repo.
      const c = map.get(`repo:${slug}`)!;
      c.hnPoints = (c.hnPoints ?? 0) + (item.score ?? 0);
      c.hnComments = (c.hnComments ?? 0) + (item.descendants ?? 0);
    } else if (item.title) {
      map.set(`hn_story:${item.id}`, {
        type: 'hn_story',
        sourceKey: String(item.id),
        name: item.title,
        url: item.url ?? `https://news.ycombinator.com/item?id=${item.id}`,
        description: null,
        language: null,
        stars: null,
        hnPoints: item.score ?? 0,
        hnComments: item.descendants ?? 0,
      });
    }
  }

  return [...map.values()];
}

async function upsertEntity(c: Candidate): Promise<number> {
  const [row] = await db
    .insert(entities)
    .values({
      type: c.type,
      sourceKey: c.sourceKey,
      name: c.name,
      url: c.url,
      description: c.description,
      language: c.language,
    })
    .onConflictDoUpdate({
      target: [entities.type, entities.sourceKey],
      set: { name: c.name, url: c.url, description: c.description, language: c.language },
    })
    .returning({ id: entities.id });
  return row!.id;
}

/** Idempotent snapshot writer — safe under at-least-once queue redelivery. */
export async function persistSnapshot(w: SnapshotWrite): Promise<void> {
  await db
    .insert(snapshots)
    .values({
      entityId: w.entityId,
      capturedAt: new Date(w.capturedAt),
      stars: w.stars,
      starsDelta: w.starsDelta,
      hnPoints: w.hnPoints,
      hnComments: w.hnComments,
      momentumScore: String(w.momentumScore),
    })
    .onConflictDoNothing({ target: [snapshots.entityId, snapshots.capturedAt] });

  // Redis + revalidation is batched by the caller (runIngest) for bulk efficiency.
  // This path is only used by the QStash worker (one entity at a time).
  await recordScore(w.entityId, w.momentumScore);
  await invalidate('trending:7d', `entity:${w.entityId}`);
  revalidatePath(`/entity/${w.entityId}`);
}

export interface IngestResult {
  candidates: number;
  dispatched: number;
  mode: 'queue' | 'inline';
}

/**
 * Full ingest cycle. `dispatch` lets the cron route inject a QStash publisher; when
 * absent we persist inline (dev / no-queue deployments).
 */
export async function runIngest(
  capturedAt: Date,
  dispatch?: (write: SnapshotWrite) => Promise<void>,
): Promise<IngestResult> {
  const candidates = await gatherCandidates();

  // Upsert + load history in parallel (bounded at 8 concurrent DB connections).
  const CONCURRENCY = 8;
  const prepared: Array<{
    write: Omit<SnapshotWrite, 'momentumScore'>;
    series: ScoringSnapshot[];
    raw: { starVelocity: number; hnActivity: number };
  }> = [];

  for (let i = 0; i < candidates.length; i += CONCURRENCY) {
    const batch = candidates.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      batch.map(async (c) => {
        const entityId = await upsertEntity(c);
        const history = await getHistory(entityId);
        const current: ScoringSnapshot = {
          stars: c.stars,
          hnPoints: c.hnPoints,
          hnComments: c.hnComments,
          capturedAt,
        };
        const series = [...history, current];
        const lastStars = history.at(-1)?.stars ?? null;
        const starsDelta =
          c.stars != null && lastStars != null ? c.stars - lastStars : null;
        return {
          write: {
            entityId,
            capturedAt: capturedAt.toISOString(),
            stars: c.stars,
            starsDelta,
            hnPoints: c.hnPoints,
            hnComments: c.hnComments,
          },
          series,
          raw: { starVelocity: starVelocity(series), hnActivity: hnActivity(series) },
        };
      }),
    );
    prepared.push(...results);
  }

  const cohort = computeCohortStats(prepared.map((p) => p.raw));

  const writes: SnapshotWrite[] = prepared.map((p) => ({
    ...p.write,
    momentumScore: momentumScore(p.series, cohort),
  }));

  if (dispatch) {
    // QStash: fan out one message per entity (production path).
    await Promise.all(writes.map((w) => dispatch(w)));
  } else {
    // Inline (dev / no-queue): bulk DB insert, then single Redis batch update.
    await Promise.all(
      writes.map((w) =>
        db
          .insert(snapshots)
          .values({
            entityId: w.entityId,
            capturedAt: new Date(w.capturedAt),
            stars: w.stars,
            starsDelta: w.starsDelta,
            hnPoints: w.hnPoints,
            hnComments: w.hnComments,
            momentumScore: String(w.momentumScore),
          })
          .onConflictDoNothing({ target: [snapshots.entityId, snapshots.capturedAt] }),
      ),
    );

    // Single Redis pipeline: update leaderboard for all entities at once.
    const { redis } = await import('@/lib/redis');
    const members = writes.map((w) => ({ score: w.momentumScore, member: String(w.entityId) }));
    if (members.length > 0) {
      const [first, ...rest] = members;
      await redis.zadd('leaderboard:momentum', first, ...rest);
    }
  }

  // One cache invalidation for the whole batch (not per-entity).
  await invalidate('trending:7d');
  revalidatePath('/trending');

  return { candidates: candidates.length, dispatched: writes.length, mode: dispatch ? 'queue' : 'inline' };
}
