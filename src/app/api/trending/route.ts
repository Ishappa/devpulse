/**
 * GET /api/trending — ranked leaderboard, filterable by language/type/window.
 * Public, heavily cached (matches the 15-min ingest cadence). The trending PAGE renders
 * via ISR + a direct RSC query; this endpoint serves client-side refreshes and widgets.
 */
import { NextRequest } from 'next/server';
import { SearchQuerySchema, searchParamsToObject, type Paginated, type EntitySummary } from '@/schemas';
import { getRanked } from '@/lib/queries';
import { encodeCursor, decodeCursor } from '@/lib/cursor';
import { cached } from '@/lib/redis';
import { ok, validationError, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const parsed = SearchQuerySchema.safeParse(searchParamsToObject(req.nextUrl.searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const { lang, type, limit, window, cursor: rawCursor } = parsed.data;

  const cursor = decodeCursor(rawCursor);
  const key = `trending:${window}:${lang ?? ''}:${type ?? ''}:${limit}:${rawCursor ?? '0'}`;

  try {
    const rows = await cached(key, 900, () =>
      getRanked({ limit: limit + 1, cursor, language: lang, type }),
    );
    const hasMore = rows.length > limit;
    const data: EntitySummary[] = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    const nextCursor =
      hasMore && last ? encodeCursor({ score: last.momentumScore, id: last.id }) : null;

    const body: Paginated<EntitySummary> = { data, nextCursor, hasMore };
    return ok(body);
  } catch (err) {
    console.error('[api/trending] failed', err);
    return fail(500, 'INTERNAL');
  }
}
