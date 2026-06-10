import { describe, it, expect } from 'vitest';
import { extractRepoSlug } from '@/lib/hackernews';

describe('extractRepoSlug', () => {
  it('extracts owner/repo from a github url', () => {
    expect(extractRepoSlug({ id: 1, url: 'https://github.com/vercel/next.js' })).toBe(
      'vercel/next.js',
    );
  });

  it('extracts from text content', () => {
    expect(
      extractRepoSlug({ id: 1, text: 'check out github.com/tokio-rs/tokio for async rust' }),
    ).toBe('tokio-rs/tokio');
  });

  it('strips trailing punctuation and .git', () => {
    expect(extractRepoSlug({ id: 1, url: 'https://github.com/a/b.git' })).toBe('a/b');
    expect(extractRepoSlug({ id: 1, text: '(see github.com/a/b).' })).toBe('a/b');
  });

  it('returns null when no repo link is present', () => {
    expect(extractRepoSlug({ id: 1, url: 'https://example.com/article' })).toBeNull();
    expect(extractRepoSlug({ id: 1 })).toBeNull();
  });
});
