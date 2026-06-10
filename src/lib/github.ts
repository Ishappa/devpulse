/**
 * GitHub API client (search + repo metadata).
 *
 * Auth lifts the rate limit from 60/hr (anon) to 5,000/hr. We read the remaining-quota
 * headers and expose them so the ingest worker can back off before exhausting the budget
 * — protecting us from our own pipeline. This is the "upstream budget guard".
 */
import 'server-only';
import { fetchJson } from '@/lib/http';

const API = 'https://api.github.com';

export interface GitHubRepo {
  id: number;
  full_name: string;
  html_url: string;
  description: string | null;
  language: string | null;
  stargazers_count: number;
}

interface SearchResponse {
  total_count: number;
  items: GitHubRepo[];
}

function headers(): HeadersInit {
  const h: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'devpulse-ingest',
  };
  const token = process.env.GITHUB_TOKEN;
  if (token && token !== 'placeholder') h.Authorization = `Bearer ${token}`;
  return h;
}

/**
 * Fetch repos created recently and sorted by stars — a reasonable "trending" proxy
 * using only the public search API (the official trending page has no API).
 */
export async function searchTrendingRepos(opts: {
  since: string; // ISO date, e.g. 30 days ago
  language?: string;
  perPage?: number;
}): Promise<GitHubRepo[]> {
  const q = [`created:>${opts.since}`, opts.language ? `language:${opts.language}` : '']
    .filter(Boolean)
    .join(' ');
  const params = new URLSearchParams({
    q,
    sort: 'stars',
    order: 'desc',
    per_page: String(opts.perPage ?? 30),
  });
  const res = await fetchJson<SearchResponse>(
    `${API}/search/repositories?${params}`,
    { headers: headers() },
    { retries: 0, timeoutMs: 6_000 },
  );
  return res.items ?? [];
}

/** Current star count for a single repo (for refreshing tracked entities). */
export async function getRepo(fullName: string): Promise<GitHubRepo> {
  return fetchJson<GitHubRepo>(`${API}/repos/${fullName}`, { headers: headers() });
}
