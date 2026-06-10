/**
 * GET /api/search — fuzzy search + filter over ranked entities.
 * Public, rate-limited per IP. Cursor (keyset) paginated. Results cached in Redis 60s.
 */
import { NextRequest } from 'next/server';
import { SearchQuerySchema, searchParamsToObject, type Paginated, type EntitySummary } from '@/schemas';
import { getRanked } from '@/lib/queries';
import { encodeCursor, decodeCursor } from '@/lib/cursor';
import { cached } from '@/lib/redis';
import { publicLimiter, checkLimit, clientIp } from '@/lib/ratelimit';
import { ok, validationError, rateLimited, fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { success, retryAfter } = await checkLimit(publicLimiter, clientIp(req.headers));
  if (!success) return rateLimited(retryAfter);

  const parsed = SearchQuerySchema.safeParse(searchParamsToObject(req.nextUrl.searchParams));
  if (!parsed.success) return validationError(parsed.error);
  const { q, lang, type, limit, cursor: rawCursor } = parsed.data;

  const cursor = decodeCursor(rawCursor);
  // Cache only the first, unfiltered-ish page heavily; deep/filtered pages are dynamic.
  const cacheable = !cursor;
  const key = `search:${q ?? ''}:${lang ?? ''}:${type ?? ''}:${limit}`;

  try {
    const load = () => getRanked({ limit: limit + 1, cursor, language: lang, type, q });
    const rows = cacheable ? await cached(key, 60, load) : await load();

    const hasMore = rows.length > limit;
    const data: EntitySummary[] = hasMore ? rows.slice(0, limit) : rows;
    const last = data.at(-1);
    const nextCursor = hasMore && last ? encodeCursor({ score: last.momentumScore, id: last.id }) : null;

    const body: Paginated<EntitySummary> = { data, nextCursor, hasMore };
    return ok(body);
  } catch (err) {
    console.error('[api/search] failed', err);
    return fail(500, 'INTERNAL');
  }
}
