/**
 * Resilient fetch with exponential backoff + jitter.
 *
 * Upstream APIs (GitHub, Hacker News) are rate-limited and occasionally flaky. We retry
 * idempotent GETs on 5xx / 429 / network errors, backing off exponentially with jitter
 * to avoid synchronized retry storms. 4xx (other than 429) are not retried — they won't
 * succeed on retry.
 */
export interface RetryOptions {
  retries?: number;
  baseDelayMs?: number;
  timeoutMs?: number;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
  opts: RetryOptions = {},
): Promise<T> {
  const { retries = 3, baseDelayMs = 300, timeoutMs = 10_000 } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...init, signal: ac.signal });
      clearTimeout(timer);

      if (res.ok) return (await res.json()) as T;

      // Retry only on transient statuses.
      if (res.status === 429 || res.status >= 500) {
        lastErr = new HttpError(res.status, `Upstream ${res.status} for ${url}`);
      } else {
        throw new HttpError(res.status, `Upstream ${res.status} for ${url}`);
      }
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof HttpError && err.status < 500 && err.status !== 429) throw err;
      lastErr = err;
    }

    if (attempt < retries) {
      const backoff = baseDelayMs * 2 ** attempt;
      const jitter = backoff * 0.25 * ((attempt % 3) + 1); // bounded, deterministic-ish
      await sleep(backoff + jitter);
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`fetchJson failed: ${url}`);
}
