/**
 * Seed script — populates the DB with sample entities and a few snapshot cycles so the
 * UI has data without waiting for live ingest. Generates a rising momentum series so
 * sparklines and ranking are visible.
 *
 *   npm run db:seed
 *
 * Requires DATABASE_URL_DIRECT (or DATABASE_URL) in the environment.
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';
import { Redis } from '@upstash/redis';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../src/lib/db/schema';
import {
  momentumScore,
  starVelocity,
  hnActivity,
  computeCohortStats,
  type ScoringSnapshot,
} from '../src/lib/scoring';

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_DIRECT or DATABASE_URL required');

const client = postgres(url, { max: 1, prepare: false });
const db = drizzle(client, { schema });

const SAMPLE = [
  { name: 'vercel/next.js', language: 'TypeScript', baseStars: 122000, growth: 180, hn: 220 },
  { name: 'facebook/react', language: 'JavaScript', baseStars: 228000, growth: 160, hn: 190 },
  { name: 'facebook/react-native', language: 'TypeScript', baseStars: 119000, growth: 140, hn: 175 },
  { name: 'microsoft/TypeScript', language: 'TypeScript', baseStars: 101000, growth: 130, hn: 150 },
  { name: 'spring-projects/spring-boot', language: 'Java', baseStars: 75000, growth: 110, hn: 120 },
  { name: 'expo/expo', language: 'TypeScript', baseStars: 36000, growth: 200, hn: 210 },
  { name: 'vitejs/vite', language: 'TypeScript', baseStars: 69000, growth: 170, hn: 200 },
  { name: 'elastic/elasticsearch', language: 'Java', baseStars: 70000, growth: 90, hn: 95 },
];

const CYCLES = 8;
const INTERVAL = 15 * 60 * 1000;

async function main() {
  console.log('Seeding…');
  const now = Date.now();

  // Build snapshot series per entity (rising stars + late HN spike).
  const prepared = SAMPLE.map((s) => {
    const series: ScoringSnapshot[] = [];
    for (let i = 0; i < CYCLES; i++) {
      series.push({
        stars: s.baseStars + s.growth * i * (1 + i * 0.15),
        hnPoints: i >= CYCLES - 2 ? s.hn : 0,
        hnComments: i >= CYCLES - 2 ? Math.round(s.hn * 0.4) : 0,
        capturedAt: now - (CYCLES - 1 - i) * INTERVAL,
      });
    }
    return { s, series, raw: { starVelocity: starVelocity(series), hnActivity: hnActivity(series) } };
  });

  const cohort = computeCohortStats(prepared.map((p) => p.raw));

  for (const { s, series } of prepared) {
    const [ent] = await db
      .insert(schema.entities)
      .values({
        type: 'repo',
        sourceKey: s.name,
        name: s.name,
        url: `https://github.com/${s.name}`,
        description: `Sample seeded entity for ${s.name}`,
        language: s.language,
      })
      .onConflictDoUpdate({
        target: [schema.entities.type, schema.entities.sourceKey],
        set: { language: s.language },
      })
      .returning({ id: schema.entities.id });

    for (let i = 0; i < series.length; i++) {
      const sub = series.slice(0, i + 1);
      const prevStars = i > 0 ? (series[i - 1].stars ?? 0) : null;
      await db
        .insert(schema.snapshots)
        .values({
          entityId: ent!.id,
          capturedAt: new Date(series[i].capturedAt as number),
          stars: Math.round(series[i].stars ?? 0),
          starsDelta: prevStars != null ? Math.round((series[i].stars ?? 0) - prevStars) : null,
          hnPoints: series[i].hnPoints,
          hnComments: series[i].hnComments,
          momentumScore: String(momentumScore(sub, cohort)),
        })
        .onConflictDoNothing({
          target: [schema.snapshots.entityId, schema.snapshots.capturedAt],
        });
    }
    console.log(`  ✓ ${s.name}`);
  }

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken && !redisUrl.includes('example')) {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    await redis.flushdb();
    console.log('  ✓ Redis cache flushed');
  }

  await client.end();
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
