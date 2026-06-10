/**
 * GET /api/entities/:id — entity detail + full snapshot series for the sparkline.
 * Public. Cached per entity in Redis (60s); the page itself is ISR + on-demand revalidate.
 */
import { NextRequest } from 'next/server';
import { getEntityWithSeries } from '@/lib/queries';
import { cached } from '@/lib/redis';
import { ok, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) return fail(400, 'VALIDATION');

  try {
    const result = await cached(`entity:${id}`, 60, () => getEntityWithSeries(id));
    if (!result) return fail(404, 'NOT_FOUND');
    return ok(result);
  } catch (err) {
    console.error('[api/entities/:id] failed', err);
    return fail(500, 'INTERNAL');
  }
}
