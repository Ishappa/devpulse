# Reference 05 — System Design & Scaling (100k → 10M users)

> For each major feature: **Current → Bottleneck at scale → Production-scale solution.**
> This is the structure FAANG system-design rounds want. Memorize the *shape*, not the words.

---

## 1. Data ingestion (write path)

**Current:** Vercel Cron (every 15 min) → `/api/cron/ingest` enqueues per-entity jobs to
QStash → worker Route Handler fetches GitHub/HN, normalizes, scores, upserts snapshot.

**Bottleneck at 100k users / wider coverage:**
- We track a few thousand entities. To cover *all* of GitHub trending + HN, the per-cycle
  job count explodes. A single cron-triggered fan-out and QStash's throughput become the
  limit; GitHub's 5k/hr quota is the hard ceiling.
- The quota is the real wall — not user count (reads are decoupled), but ingest breadth.

**Production-scale solution:**
- Replace QStash with **Kafka/PubSub**; a fleet of **worker consumers** (Spring Boot /
  Go) auto-scaled on lag.
- **Multiple GitHub tokens / GitHub App installation tokens** to multiply quota; a
  central **rate-budget service** (Redis token bucket) hands out call permits.
- **Tiered freshness**: hot entities ingested every few minutes, long-tail hourly/daily —
  prioritize the queue by popularity. Event-driven: HN firehose pushes new items rather
  than polling.

---

## 2. Read path (trending / entity pages)

**Current:** ISR + CDN serve cached HTML; Redis caches queries; Postgres on miss.

**Bottleneck at 100k:** Honestly, **this scales fine** — it's CDN-served. The risk is
cache stampede on popular-key expiry and a single Postgres primary for misses.

**Production-scale solution:**
- **Read replicas** for Postgres; route reads to replicas, writes to primary.
- **Multi-region edge cache** + regional Redis (replicated) so reads are local.
- **Single-flight + pre-warming** (already designed in caching ref) prevents stampede.
- Say it plainly: "The read path was architected to scale from day one via the
  write/read split — that was the point."

---

## 3. Search + filtering

**Current:** Postgres `pg_trgm` GIN index + filtered query, cursor-paginated, Redis-cached.

**Bottleneck at 100k + millions of entities:** trigram search on a huge table degrades;
complex multi-facet filtering (language + window + tags + relevance) strains Postgres;
typo-tolerance and ranking get expensive.

**Production-scale solution:**
- Dedicated **search index: Elasticsearch / OpenSearch / Typesense / Meilisearch**.
- Ingest worker dual-writes to Postgres (source of truth) + search index (denormalized,
  optimized for query). **CDC** (Debezium) keeps them in sync to avoid dual-write skew.
- Faceted aggregations + relevance ranking move to the search engine; Postgres stays the
  transactional store.

---

## 4. Time-series snapshots (table growth)

**Current:** append-only `snapshots`, one row per entity per cycle. Indexed for
latest-per-entity and leaderboard queries.

**Bottleneck at 100k+:** N entities × 96 snapshots/day grows unbounded → index bloat,
slow scans, expensive storage. Classic time-series problem.

**Production-scale solution:**
- **Partition by time** (`PARTITION BY RANGE (captured_at)`, monthly) → query pruning,
  cheap drop-old-partition retention.
- **Rollup/downsample job**: keep 15-min granularity for 7 days, hourly for 90 days, daily
  beyond. Old detail aggregated into rollup tables.
- At extreme scale: a **purpose-built TSDB** (TimescaleDB hypertables, or ClickHouse) for
  the analytical sparkline queries; Postgres keeps current state.

---

## 5. Personalized feed (per-user fan-out)

**Current:** SSR; on request, join the user's `watches` to latest snapshots, Redis-cache
the result 60s per user.

**Bottleneck at 100k:** many users × per-user query = cache fragmentation (low hit-rate,
every user is a unique key); the join runs per active user.

**Production-scale solution:**
- **Fan-out-on-write vs read** tradeoff (the classic Twitter timeline problem): for users
  with small watchlists, compute on read (current). For power users, **precompute feeds**
  on ingest and push to a per-user Redis list.
- Hybrid: precompute for active users, on-demand for inactive — same pattern as a social
  timeline. *Naming this tradeoff explicitly scores points.*

---

## 6. Rate limiting & abuse

**Current:** `@upstash/ratelimit` sliding window per-IP/per-user in Redis.

**Bottleneck at 100k:** per-IP is weak behind NAT/CGNAT and ineffective against
distributed abuse; a single Redis becomes a hotspot for counter writes.

**Production-scale solution:**
- **Edge/WAF rate limiting** (Cloudflare) in front; app-layer limit as backstop.
- **Sharded/clustered Redis** for counters; or token-bucket at the edge.
- **Auth-tiered limits** (anon < free < authed) + bot detection.

---

## 7. The "draw it on the whiteboard" target architecture

```
            ┌────────── CDN (multi-region, edge cache) ──────────┐
Clients ───►│  static + ISR HTML                                  │
            └───────────────┬─────────────────────────────────────┘
                            │ dynamic / API
                  ┌─────────▼──────────┐         ┌──────────────────┐
                  │  BFF / Read API     │◄───────►│ Regional Redis    │
                  │  (Next on Vercel/k8s)│        │ (cache, RL, feeds)│
                  └───┬──────────────┬──┘         └──────────────────┘
            reads     │              │ search
          ┌───────────▼──┐    ┌──────▼───────┐
          │ PG read       │    │ OpenSearch /  │
          │ replicas      │    │ Typesense     │
          └───────▲───────┘    └──────▲────────┘
                  │ CDC (Debezium)    │ CDC
          ┌───────┴───────────────────┴────────┐
          │      Postgres primary (writes)       │  ◄── partitioned snapshots + rollups
          └───────▲──────────────────────────────┘
                  │ upserts
          ┌───────┴────────┐   consume   ┌──────────────────────┐
          │ Ingest workers   │◄───────────│ Kafka (ingest topic)  │
          │ (Spring/Go fleet)│            └──────────▲────────────┘
          └───────▲──────────┘                       │ produce
                  │ fetch (token-budgeted)            │
          ┌───────┴───────┐                  ┌────────┴─────────┐
          │ GitHub / HN    │                  │ Scheduler / HN   │
          │ (rate-limited) │                  │ firehose         │
          └────────────────┘                  └──────────────────┘
```

**The through-line for the whole interview:** *DevPulse's single-node version already has
the right shape — cron≈scheduler, QStash≈Kafka, ingest Route Handler≈worker fleet, Redis
sorted set≈feed store, pg_trgm≈search engine. Scaling is swapping each component for its
distributed equivalent, not redesigning.* That sentence is what separates a senior answer
from a junior one.
