/**
 * Zod schemas — the single source of truth for runtime validation AND static types.
 * Every external input (query, body) crosses one of these gates before reaching logic.
 */
import { z } from 'zod';

export const TIME_WINDOWS = ['1d', '7d', '30d'] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number];

export const ENTITY_TYPES = ['repo', 'topic', 'hn_story'] as const;

/** GET /api/search and /api/trending query params. */
export const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(64).optional(),
  lang: z.string().trim().max(32).optional(),
  type: z.enum(ENTITY_TYPES).optional(),
  window: z.enum(TIME_WINDOWS).default('7d'),
  cursor: z.string().max(256).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/** POST/DELETE /api/watches body. */
export const WatchBodySchema = z.object({
  entityId: z.coerce.number().int().positive(),
});
export type WatchBody = z.infer<typeof WatchBodySchema>;

/** Shape returned to clients for a single entity in lists. */
export const EntitySummarySchema = z.object({
  id: z.number().int(),
  type: z.enum(ENTITY_TYPES),
  name: z.string(),
  url: z.string().nullable(),
  description: z.string().nullable(),
  language: z.string().nullable(),
  momentumScore: z.number(),
  stars: z.number().nullable(),
  starsDelta: z.number().nullable(),
  hnPoints: z.number().nullable(),
  hnComments: z.number().nullable(),
  capturedAt: z.string(), // ISO
});
export type EntitySummary = z.infer<typeof EntitySummarySchema>;

/** Generic cursor-paginated list envelope. */
export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
  hasMore: boolean;
}

/** Parse URLSearchParams into a plain object for schema validation. */
export function searchParamsToObject(params: URLSearchParams): Record<string, string> {
  const obj: Record<string, string> = {};
  for (const [k, v] of params.entries()) obj[k] = v;
  return obj;
}
