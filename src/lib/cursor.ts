/**
 * Opaque keyset-pagination cursors.
 *
 * We paginate by the indexed tuple (momentum_score DESC, id DESC) rather than OFFSET:
 *  - OFFSET is O(n) — the DB must scan and discard skipped rows.
 *  - OFFSET is unstable under concurrent inserts — rows shift, causing skips/dupes.
 * A keyset cursor encodes the last row's (score, id); the next query resumes after it
 * via an index range scan — O(log n) and stable.
 *
 * The cursor is base64url(JSON) — opaque to clients, who must treat it as a token.
 */
export interface Cursor {
  score: number;
  id: number;
}

export function encodeCursor(c: Cursor): string {
  const json = JSON.stringify({ s: c.score, i: c.id });
  return Buffer.from(json, 'utf8').toString('base64url');
}

export function decodeCursor(raw: string | null | undefined): Cursor | null {
  if (!raw) return null;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const obj = JSON.parse(json) as { s?: unknown; i?: unknown };
    if (typeof obj.s !== 'number' || typeof obj.i !== 'number') return null;
    if (!Number.isFinite(obj.s) || !Number.isInteger(obj.i)) return null;
    return { score: obj.s, id: obj.i };
  } catch {
    return null; // malformed cursor → treat as "from the start", never throw
  }
}
