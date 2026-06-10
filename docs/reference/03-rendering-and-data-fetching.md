# Reference 03 — Rendering Modes, Data Fetching & the Backend Decision

---

## 1. Rendering decision matrix

Pick the **most static mode the route can tolerate**, then step up only for freshness
or personalization.

```
                  personalized?
                  NO            YES
freshness  high  ┌──────────┬──────────┐
required?        │  ISR     │   SSR    │
                 │ (revalid)│ (dynamic)│
            low  ├──────────┼──────────┤
                 │  SSG     │  SSR or  │
                 │          │  client  │
                 └──────────┴──────────┘
```

| Route | Personalized | Freshness | Mode | `export const` |
|---|---|---|---|---|
| `/` landing | No | None | **SSG** | (default static) |
| `/trending`, `/trending/[lang]` | No | 15 min | **ISR** | `revalidate = 900` + `generateStaticParams` |
| `/entity/[id]` | No | event-driven | **ISR + on-demand** | `revalidate = 900`; worker calls `revalidatePath` |
| `/radar` (search) | No (but interactive) | live filter | **SSR shell + client fetch** | `dynamic = 'force-dynamic'` for shell |
| `/feed` | **Yes** (session) | live | **SSR** | reads cookies → auto-dynamic |
| `/about`, `/docs` | No | None | **SSG** | static |

---

## 2. How rendering modes stack with the cache layers

This is the part people get wrong. The rendering mode determines **layer 1 (CDN)**
behavior; the cache layers below are independent.

```
/trending  (ISR)   → Layer 1 CDN serves cached HTML  → on revalidate, RSC runs →
                     Layer 3 Redis serves the leaderboard query → rarely Layer 4 DB

/feed      (SSR)   → Layer 1 BYPASSED (dynamic)       → RSC runs every request →
                     Layer 3 Redis caches the per-user query (60s) → Layer 4 DB on miss

/api/search        → not a page, no Layer 1           → Route Handler →
                     Layer 3 Redis (60s by query) → Layer 4 DB on miss
```

Takeaway: **SSR doesn't mean "no cache"** — it means "no *page* cache." The data
underneath is still Redis-cached. Saying this distinguishes you.

---

## 3. Where data is fetched

| Context | Mechanism | Why |
|---|---|---|
| Server Components (trending, entity, feed) | `await fetch()` / direct DB call in the RSC | No client JS, no waterfall, data ready at first paint |
| Interactive client (radar filters, infinite scroll, watch toggle) | **RTK Query** hooks | Client-side cache, dedup, optimistic updates, tag invalidation |
| Mutations (watch/unwatch) | RTK Query mutation → Route Handler | Optimistic update + `invalidatesTags(['Watches'])` |

> Rule: read-only + first-paint data → Server Components. Interactive + authed mutating
> data → RTK Query. Never fetch in a `useEffect` if a Server Component can do it.

---

## 4. The backend decision — Route Handlers vs. Spring Boot (defended)

The brief offered either. I chose **Next.js Route Handlers**. Here's the full reasoning
because it's a likely interview question given my Spring Boot background.

### Why Route Handlers win *here*

| Factor | Route Handlers | Separate Spring Boot |
|---|---|---|
| Latency | Co-located with frontend on Vercel — no extra hop | +1 network hop, CORS preflight |
| Workload fit | I/O-bound (fetch + cache) — Node's event loop excels | JVM shines at CPU-bound; wasted here |
| Deploy/ops (solo dev) | One deploy target, one language | Two deploys, two runtimes, more YAML |
| Cold start | Fast (V8) | JVM cold start hurts on serverless |
| Type sharing | Zod schema → shared TS types FE↔BE | Manual DTO duplication across languages |

### When I *would* reach for Spring Boot (say this — it shows judgment)

- **CPU-bound work**: if scoring became ML inference or heavy batch computation, a JVM
  worker pool (or a Python service) beats Node.
- **Long-running stateful processes**: WebSocket fan-out at scale, scheduled batch jobs
  with complex transactions — Spring's ecosystem (Batch, Scheduler, JPA) earns its weight.
- **Team/org reality**: if the company standard is Spring and there's a platform team,
  matching the org beats a clever solo choice.

> "I used Route Handlers because this workload is I/O-bound and co-location removes a hop
> and a deploy. I'd extract a Spring Boot service the moment the work became CPU-bound or
> needed long-lived stateful processes — and I'd put a queue between them, not a sync call."

### The hybrid I'd actually draw at scale

```
Next.js (BFF / read API on Vercel)  ──►  Redis / Postgres
        │
        └── enqueue ──►  Kafka  ──►  Spring Boot ingest workers (CPU-heavy scoring)
                                          └──► Postgres (writes)
```

The Route-Handler ingest worker *is* the seed of that Spring Boot worker — same
responsibility, swap the runtime when scale demands.
