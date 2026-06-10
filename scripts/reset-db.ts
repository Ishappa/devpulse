import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';
import { Redis } from '@upstash/redis';

const url = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL_DIRECT or DATABASE_URL required');

const client = postgres(url, { max: 1, prepare: false });

async function main() {
  console.log('Clearing database…');
  await client`TRUNCATE entity_tags, watches, snapshots, entities RESTART IDENTITY CASCADE`;
  console.log('  ✓ DB truncated');

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (redisUrl && redisToken && !redisUrl.includes('example')) {
    const redis = new Redis({ url: redisUrl, token: redisToken });
    await redis.flushdb();
    console.log('  ✓ Redis cache flushed');
  } else {
    console.log('  ⚠ Redis skipped (no valid credentials)');
  }

  await client.end();
  console.log('Done. Run db:seed or curl ingest to populate with data.');
}

main().catch((e) => { console.error(e); process.exit(1); });
