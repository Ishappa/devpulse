/**
 * Integration-ish tests for the API boundary contracts: validation schemas and the
 * cursor↔response relationship. These exercise the seams between input parsing and the
 * pagination protocol WITHOUT a live DB — fast and deterministic.
 */
import { describe, it, expect } from 'vitest';
import { SearchQuerySchema, WatchBodySchema, searchParamsToObject } from '@/schemas';
import { encodeCursor, decodeCursor } from '@/lib/cursor';

describe('SearchQuerySchema', () => {
  it('applies defaults for window and limit', () => {
    const r = SearchQuerySchema.parse({});
    expect(r.window).toBe('7d');
    expect(r.limit).toBe(20);
  });

  it('coerces and clamps limit within [1,50]', () => {
    expect(SearchQuerySchema.parse({ limit: '5' }).limit).toBe(5);
    expect(SearchQuerySchema.safeParse({ limit: '999' }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('rejects invalid window and over-long query', () => {
    expect(SearchQuerySchema.safeParse({ window: '1y' }).success).toBe(false);
    expect(SearchQuerySchema.safeParse({ q: 'x'.repeat(65) }).success).toBe(false);
  });

  it('parses URLSearchParams via the helper', () => {
    const params = new URLSearchParams('q=rust&lang=Rust&limit=10');
    const r = SearchQuerySchema.parse(searchParamsToObject(params));
    expect(r).toMatchObject({ q: 'rust', lang: 'Rust', limit: 10 });
  });
});

describe('WatchBodySchema', () => {
  it('requires a positive integer entityId', () => {
    expect(WatchBodySchema.safeParse({ entityId: 5 }).success).toBe(true);
    expect(WatchBodySchema.safeParse({ entityId: -1 }).success).toBe(false);
    expect(WatchBodySchema.safeParse({}).success).toBe(false);
  });
});

describe('pagination protocol', () => {
  it('a cursor built from the last row resumes deterministically', () => {
    const lastRow = { momentumScore: 42.5, id: 99 };
    const cursor = encodeCursor({ score: lastRow.momentumScore, id: lastRow.id });
    const decoded = decodeCursor(cursor);
    expect(decoded).toEqual({ score: 42.5, id: 99 });
    // round-trips through the query-string boundary
    const viaParams = new URLSearchParams({ cursor }).get('cursor');
    expect(decodeCursor(viaParams)).toEqual({ score: 42.5, id: 99 });
  });
});
