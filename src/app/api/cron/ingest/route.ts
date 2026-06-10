/**
 * POST/GET /api/cron/ingest — triggered by Vercel Cron (every 15 min).
 *
 * Protected by a shared CRON_SECRET so the public can't trigger ingest. Orchestrates a
 * full ingest cycle; if QStash is configured it fans out one persist job per entity
 * (the production shape), otherwise it persists inline (dev / no-queue).
 */
import { NextRequest } from 'next/server';
import { Client } from '@upstash/qstash';
import { runIngest, type SnapshotWrite } from '@/lib/ingest';
import { fail, ok } from '@/lib/api';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return fail(401, 'UNAUTHORIZED');
  }

  const now = new Date();
  let dispatch: ((w: SnapshotWrite) => Promise<void>) | undefined;

  if (process.env.QSTASH_TOKEN) {
    const qstash = new Client({ token: process.env.QSTASH_TOKEN });
    const origin = new URL(req.url).origin;
    dispatch = async (w) => {
      await qstash.publishJSON({ url: `${origin}/api/jobs/ingest-entity`, body: w, retries: 3 });
    };
  }

  // Fire-and-forget in dev (no QStash). In production, QStash handles per-entity retries.
  // We return immediately so the cron scheduler / curl don't wait 2+ minutes.
  void runIngest(now, dispatch).catch((err) => console.error('[cron/ingest] failed', err));
  return ok({ ok: true, status: 'started', at: now.toISOString() });
}

// Vercel Cron issues GET by default; accept both.
export const GET = POST;
