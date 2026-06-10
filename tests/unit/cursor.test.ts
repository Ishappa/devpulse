import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '@/lib/cursor';

describe('cursor', () => {
  it('round-trips a cursor', () => {
    const c = { score: 87.42, id: 128 };
    expect(decodeCursor(encodeCursor(c))).toEqual(c);
  });

  it('produces a url-safe opaque token', () => {
    const token = encodeCursor({ score: 1.5, id: 9 });
    expect(token).not.toMatch(/[+/=]/); // base64url, no padding/unsafe chars
  });

  it('returns null for empty/absent input', () => {
    expect(decodeCursor(null)).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
  });

  it('returns null (never throws) on malformed input', () => {
    expect(decodeCursor('not-base64-!!!')).toBeNull();
    expect(decodeCursor(Buffer.from('{"s":"x"}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('garbage').toString('base64url'))).toBeNull();
  });

  it('rejects non-integer ids and non-finite scores', () => {
    expect(decodeCursor(Buffer.from('{"s":1,"i":1.5}').toString('base64url'))).toBeNull();
    expect(decodeCursor(Buffer.from('{"s":null,"i":1}').toString('base64url'))).toBeNull();
  });
});
