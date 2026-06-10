/**
 * Hacker News (Firebase) API client.
 *
 * The HN API is unauthenticated but requires fanning out one request per item, so we
 * fetch top-story ids then resolve items with bounded concurrency to avoid a request
 * storm. We extract GitHub repo links from story URLs/text to correlate HN discussion
 * with GitHub entities — the cross-source join at the heart of DevPulse.
 */
import 'server-only';
import { fetchJson } from '@/lib/http';

const API = 'https://hacker-news.firebaseio.com/v0';

export interface HnItem {
  id: number;
  type?: string;
  title?: string;
  url?: string;
  text?: string;
  score?: number;
  descendants?: number; // comment count
  time?: number;
}

export async function getTopStoryIds(limit = 100): Promise<number[]> {
  const ids = await fetchJson<number[]>(`${API}/topstories.json`);
  return ids.slice(0, limit);
}

export async function getItem(id: number): Promise<HnItem | null> {
  return fetchJson<HnItem | null>(`${API}/item/${id}.json`);
}

/** Resolve many items with bounded concurrency (default 8 in-flight). */
export async function getItems(ids: number[], concurrency = 8): Promise<HnItem[]> {
  const out: HnItem[] = [];
  let i = 0;
  async function worker() {
    while (i < ids.length) {
      const id = ids[i++];
      try {
        const item = await getItem(id);
        if (item) out.push(item);
      } catch {
        // skip individual failures; partial data is fine for an aggregate signal
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
  return out;
}

const REPO_RE = /github\.com\/([\w.-]+\/[\w.-]+)/i;

/** Extract an "owner/repo" slug from an HN item's url or text, if present. */
export function extractRepoSlug(item: HnItem): string | null {
  const haystack = `${item.url ?? ''} ${item.text ?? ''}`;
  const m = haystack.match(REPO_RE);
  if (!m) return null;
  return m[1].replace(/\.git$/, '').replace(/[).,]+$/, '');
}
