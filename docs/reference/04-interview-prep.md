# Reference 04 — Interview Prep: STAR Answers & Drill Questions

> Use these to rehearse. Each answer is structured so you can deliver it in 60–90s and
> then go deeper if probed. Replace the metrics with your *measured* numbers.

---

## A. The 90-second project pitch (memorize this)

> "DevPulse is a developer-trend intelligence platform. It aggregates GitHub and Hacker
> News and computes a momentum score so you can see what's gaining traction before it's
> mainstream. The interesting engineering problem is that both upstreams are rate-limited
> — GitHub gives 5,000 requests/hour — so I separated the write path from the read path:
> a cron fans ingest jobs out through a queue, a worker normalizes both sources and
> writes pre-computed scores to Postgres, and the user-facing read path only ever touches
> a cache and the DB. That means user traffic scales independently of the API quota.
> On the frontend it's Next 14 App Router — trending pages are ISR so they're served from
> the edge, the personalized feed is SSR, and I hit Lighthouse 95+ with Server Components,
> list virtualization, and a multi-layer cache."

---

## B. STAR answers for behavioral-technical questions

### "Tell me about a hard technical decision you made."
- **S:** Both data sources are rate-limited; serving directly from them is fragile and
  blows the quota under any real traffic.
- **T:** Serve fresh-enough data fast without exhausting upstream APIs.
- **A:** Separated write/read paths. Cron + QStash queue fans out idempotent ingest jobs;
  workers pre-compute scores into Postgres; reads hit Redis + ISR only. Made ingest
  idempotent (unique constraint) to tolerate at-least-once delivery.
- **R:** Read path is ~99% cache-served; GitHub usage stays flat (~5k/hr) at any traffic;
  trending LCP dropped from ~3.4s to ~1.1s.

### "Tell me about a performance problem you solved."
- **S:** Search results list with 1000+ rows had janky scroll (high INP).
- **T:** Keep INP < 200ms.
- **A:** Virtualized the list (`@tanstack/react-virtual`) so DOM node count is constant;
  memoized the derived/filtered list with `createSelector`; moved filter compute off the
  render path.
- **R:** INP from ~350ms to ~140ms; constant memory regardless of result count.

### "Tell me about a time you designed for failure."
- **S:** Queue delivers at-least-once; the cron could fail silently and serve stale data
  invisibly.
- **A:** Idempotent upserts so retries are safe; DLQ for poison messages; and crucially I
  alert on **"time since last successful ingest"** — monitoring the *absence* of success,
  not just errors.
- **R:** A failed ingest pages me before users notice staleness.

---

## C. Rapid-fire technical drills (know these cold)

| Q | One-liner answer |
|---|---|
| SSG vs ISR vs SSR? | Static-at-build / static-with-timed-regen / per-request. Pick most static the route tolerates. |
| Why ISR for /trending? | Identical for all users, tolerates 15-min staleness → one edge cache serves everyone. |
| Offset vs cursor pagination? | Offset O(n) + unstable under writes; cursor O(log n) on indexed tuple + stable. |
| Why Redux not Context? | Context re-renders all consumers on any change; Redux has selectors → targeted re-render. |
| Server vs client state? | Server: RSC/RTK Query. Client UI: Redux. Local: useState. Don't put server data in Redux. |
| How prevent cache stampede? | SWR + single-flight lock + jittered TTL + pre-warm hot keys on write. |
| Cache invalidation strategy? | TTL default + on-demand revalidatePath from the single writer. Avoid clever multi-path invalidation. |
| Idempotency with at-least-once? | Unique (entity_id, captured_at) upsert; side-effect-free worker; DLQ. |
| XSS prevention? | React auto-escapes; no dangerouslySetInnerHTML on upstream data; nonce CSP. |
| CSRF prevention? | SameSite=Lax cookies + NextAuth CSRF token + JSON-only state-changing endpoints. |
| Why JWT session? | Stateless, no per-request session-table read. Tradeoff: hard to revoke instantly. |
| How measure CWV honestly? | Field RUM (Vercel Speed Insights), not just lab Lighthouse. |
| Why Route Handlers over Spring Boot? | I/O-bound + co-location removes a hop; would switch for CPU-bound/long-lived work. |
| Connection limits on serverless + Postgres? | PgBouncer/transaction pooling or Prisma Data Proxy. |

---

## D. Likely "go deeper" probes and your prepared depth

**"Walk me through what happens on a single request to /trending."**
1. Browser hits Vercel edge. 2. CDN has cached ISR HTML (`x-vercel-cache: HIT`) → return,
~0 DB. 3. If stale, edge serves stale + triggers background regen. 4. Regen runs the RSC,
which reads the leaderboard from Redis (sorted set / cached query). 5. Redis miss → one
`DISTINCT ON` query on the indexed snapshots table. 6. HTML re-cached at edge.

**"What breaks first at 100k users?"** → See `05-system-design-scaling.md`. Short: not the
read path (it's cached) — it's ingest breadth (need more entities tracked) and snapshot
table growth. Fixes: Kafka fan-out, table partitioning + rollups, dedicated search index.

**"How is the momentum score actually computed?"** → See `01-trend-scoring-deep-dive.md`.
Exp-weighted star velocity + log-compressed HN activity + corroboration bonus, normalized,
computed on the *write* path so reads stay O(1) and cacheable.

---

## E. Questions to ASK the interviewer (shows seniority)

- "How do you handle freshness SLAs on derived/aggregated data internally?"
- "Where's the boundary between your BFF and core services — sync calls or queues?"
- "How do you monitor the absence of success, not just error rates?"
- "What's your approach to cache invalidation across services?"

---

## F. Honest weaknesses to volunteer (disarms the trap)

Interviewers respect knowing your system's limits:
- "It's eventually consistent — 15-min staleness. Fine for trends, wrong for anything
  transactional."
- "JWT sessions can't be instantly revoked; I'd add a short TTL + denylist if it mattered."
- "Single-region. Multi-region would need read replicas + cache replication — out of scope
  for a portfolio but I know the shape."
- "Star-based signals are gameable; corroboration is a heuristic, not real anomaly
  detection."
