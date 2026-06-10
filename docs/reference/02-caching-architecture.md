# Reference 02 — Caching Architecture

> "There are only two hard things in Computer Science: cache invalidation and naming
> things." This file is about the first one. Naming, we solved: DevPulse.

---

## 1. The four cache layers (request travels top → bottom)

```
Browser ──► [1] CDN / Vercel Edge (ISR HTML + static assets)
                 │ miss / dynamic
                 ▼
            [2] Next.js Data Cache (fetch() memoization, per-render)
                 │ miss
                 ▼
            [3] Upstash Redis (query-result cache, rate-limit, leaderboard)
                 │ miss
                 ▼
            [4] Supabase Postgres (source of truth)
```

Each layer exists for a **different reason** — don't conflate them.

| Layer | Caches | Keyed by | TTL / invalidation | Serves which routes |
|---|---|---|---|---|
| **1. CDN / ISR** | Rendered HTML + RSC payload | URL | `revalidate: 900` + on-demand `revalidatePath` | `/trending`, `/entity/[id]`, SSG pages |
| **2. Next Data Cache** | `fetch()` results within a render | URL + options | `next: { revalidate }` tags | Server components' data fetches |
| **3. Redis** | DB query *results* (JSON) | logical key e.g. `search:rust:7d:cur0` | 60s SWR + tag delete on ingest | dynamic/authed paths ISR can't serve (`/api/search`, `/feed` query) |
| **4. Postgres** | nothing (origin) | — | — | everything on full miss |

---

## 2. Why both ISR *and* Redis? (common interview challenge)

They cache **different things at different granularities:**

- **ISR caches the whole rendered page** — great for routes identical across all users
  (`/trending`). One cache entry serves everyone; the DB is hit ~once per 15 min globally.
- **Redis caches a query result** — needed when the *page* can't be cached (it's
  per-user or has interactive params) but the *underlying query* is shareable or
  repeatable. Example: `/api/search?q=rust` — the HTML isn't cached (it's an API call
  from an interactive filter), but the result for `rust` is identical for everyone for 60s.

> "ISR is page-level caching for shared pages; Redis is data-level caching for the
> dynamic paths ISR can't reach. They're complementary, not redundant."

---

## 3. The read-through + SWR pattern (Redis layer)

```ts
async function cached<T>(key: string, ttl: number, loader: () => Promise<T>): Promise<T> {
  const hit = await redis.get<{ v: T; exp: number }>(key);
  if (hit) {
    if (hit.exp > Date.now()) return hit.v;                 // fresh
    // STALE: return immediately, refresh in background (stale-while-revalidate)
    revalidateInBackground(key, ttl, loader);
    return hit.v;
  }
  return await load(key, ttl, loader);                      // cold miss → load + set
}
```

**Why SWR:** a cold or expired key shouldn't make the user wait for the DB. Serve the
stale value, refresh async. Trades a few seconds of staleness for consistently low latency.

---

## 4. Cache stampede / thundering herd (the senior trap)

**Problem:** a popular key expires → N concurrent requests all miss → all hit the DB
simultaneously → DB spike. Classic.

**Mitigations (in order of how much I'd say in an interview):**

1. **SWR** (above) — expired ≠ empty; only one background refresh fires, others serve stale.
2. **Per-key lock / single-flight** — first miss acquires a short Redis lock (`SET NX PX`),
   others briefly wait or serve stale. Prevents the herd.
3. **Jittered TTLs** — add ±10% randomness so keys don't all expire on the same tick.
4. **Pre-warming** — the ingest worker writes the hot leaderboard key directly after
   each run, so it's never cold for users.

```ts
// single-flight guard
const lock = await redis.set(`lock:${key}`, '1', { nx: true, px: 5000 });
if (!lock) return staleOrWait();      // someone else is already refreshing
```

---

## 5. Invalidation strategy — TTL + targeted on-demand

I deliberately avoid clever invalidation. Two mechanisms only:

- **Time-based (TTL):** the default. Everything expires; staleness is bounded and
  predictable. Tuned per route (15 min trending, 60s search).
- **On-demand (push):** the ingest worker knows exactly which entities changed, so it
  calls `revalidatePath('/entity/' + id)` and `redis.del('entity:' + id)` after writing.
  Surgical, no over-invalidation.

> "I don't try to invalidate on every possible write path — that's where bugs live.
> TTL is the safety net; on-demand revalidation from the single writer (the ingest
> worker) is the precision tool. Only one place writes, so only one place invalidates."

---

## 6. Rate limiting *is* a cache concern (Redis double-duty)

The same Redis powers `@upstash/ratelimit` (sliding-window counters) — counters are
just short-TTL keys. And the "top movers" leaderboard is a Redis **sorted set**
(`ZADD score entity`), updated on write, read with `ZREVRANGE` — O(log n) ranked reads
without touching Postgres.

---

## 7. What I measure

- **Cache hit-rate** per layer (target >90% on read path). Redis `INFO` / app counters.
- **`x-vercel-cache: HIT|STALE|MISS`** header on ISR responses.
- **DB query count per minute** — should be ~flat regardless of user traffic (proves
  the decoupling works).
- **p95 read latency** — should be dominated by cache, not DB.
