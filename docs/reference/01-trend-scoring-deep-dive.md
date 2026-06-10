# Reference 01 — Momentum Score: Algorithm Deep-Dive

> The single most important piece of business logic in DevPulse, and the one an
> interviewer will probe hardest because it's where product sense meets engineering.

---

## 1. The problem with naive metrics

| Metric | Why it fails |
|---|---|
| Raw star count | Lagging & cumulative — a 10-year-old repo always "wins". Tells you nothing about *now*. |
| Star delta (today − yesterday) | Noisy; a single HN front-page day spikes it. No smoothing, no decay. |
| HN points alone | Sparse — most repos are never on HN. Can't rank the long tail. |

We want a score that captures **velocity + recency + cross-source corroboration**, normalized so a small fast-rising repo can out-rank a huge stagnant one.

---

## 2. The model

`momentum = w_s · normalizedStarVelocity + w_h · normalizedHNActivity + w_c · corroborationBonus`

Each component is **time-decayed** so recent activity dominates. We use an
exponential decay over snapshot buckets:

```
decay(age_in_buckets) = exp(-λ · age)        // λ ≈ 0.35 → ~half-life of 2 buckets (30 min if 15-min cadence... tune to days for real signal)
```

### Component A — star velocity (per snapshot)

```ts
// snapshots are ordered oldest→newest, evenly spaced (15 min)
function starVelocity(snaps: Snapshot[]): number {
  let weighted = 0, weightSum = 0;
  for (let i = 1; i < snaps.length; i++) {
    const delta = snaps[i].stars - snaps[i - 1].stars;     // stars gained this interval
    const age   = snaps.length - 1 - i;                    // 0 = most recent
    const w     = Math.exp(-LAMBDA * age);
    weighted   += delta * w;
    weightSum  += w;
  }
  return weightSum === 0 ? 0 : weighted / weightSum;        // exp-weighted avg gain/interval
}
```

### Component B — HN activity

```ts
function hnActivity(snaps: Snapshot[]): number {
  // points + comments are both signals; comments weighted lower (noisier)
  const recent = snaps.at(-1)!;
  return Math.log1p(recent.hnPoints) + 0.5 * Math.log1p(recent.hnComments);
  //   log1p compresses outliers so one viral story doesn't dominate
}
```

### Component C — corroboration bonus

If an entity is rising on **both** sources in the same window, that's a stronger
signal than either alone (independent confirmation). Small multiplicative bonus:

```ts
const corroboration = (starVelocity > 0 && hnActivity > 0) ? 1.15 : 1.0;
```

### Normalization

Raw components live on different scales. Normalize each to `[0,1]` using a
**rolling percentile** across the current cohort (computed at ingest time, stored),
then combine:

```ts
function momentumScore(snaps: Snapshot[], cohortStats: CohortStats): number {
  const sv = normalize(starVelocity(snaps), cohortStats.starVelocity);   // min-max or percentile
  const hn = normalize(hnActivity(snaps),  cohortStats.hnActivity);
  const base = W_STAR * sv + W_HN * hn;
  return round(base * corroboration(sv, hn) * 100, 3);                   // 0–115 scale
}

const W_STAR = 0.6, W_HN = 0.4, LAMBDA = 0.35;
```

---

## 3. The key engineering decision: compute on **write**, not read

| | Compute on read | **Compute on write (chosen)** |
|---|---|---|
| Freshness | Always current | Stale up to 1 ingest interval (15 min) |
| Read latency | High — window function over snapshots per request | Low — plain indexed `SELECT momentum_score` |
| DB load under traffic | Scales with **read** QPS | Constant — scales with ingest cadence only |
| Cacheability | Hard (depends on `now()`) | Trivial (value is stable between ingests) |

**Decision:** compute in the ingest worker, persist `momentum_score` + `stars_delta`
on the snapshot row. The read path becomes a trivial cacheable select. This is the
"do expensive work on the cold path" principle — and it's *why* the read path can be
99% cache-served.

> Interview line: "I pushed the derived-data computation to the write path so the
> read path is O(1) and cacheable. The cost is bounded staleness — 15 minutes — which
> I made an explicit product SLA and surface as a 'last updated' timestamp."

---

## 4. Why it's a pure function (testability)

`scoring.ts` takes `(snapshots, cohortStats)` and returns a number — **no I/O, no
clock, no globals.** This makes it:

- **Deterministic** → trivially unit-testable with table-driven cases.
- **Property-testable** → e.g. "monotonic: more recent stars ⇒ higher score",
  "decay: same total gain spread later ⇒ higher than spread earlier".

```ts
describe('momentumScore', () => {
  it('rewards recent gains over old gains', () => {
    expect(score(recentlyRising)).toBeGreaterThan(score(earlyRising));
  });
  it('applies corroboration bonus only when both sources positive', () => {
    expect(score(bothRising)).toBeGreaterThan(score(onlyStars) * 1.1);
  });
  it('is bounded and never NaN on empty/single snapshot', () => {
    expect(score([])).toBe(0);
    expect(Number.isFinite(score([oneSnap]))).toBe(true);
  });
});
```

---

## 5. Edge cases to handle (and mention in interview)

- **Cold start** (entity with 1 snapshot) → velocity undefined → return 0, don't crash.
- **Snapshot gaps** (ingest failed a cycle) → uneven spacing breaks the "evenly spaced"
  assumption → normalize delta by actual elapsed time, not bucket index.
- **Negative deltas** (repo lost stars / deleted) → clamp at 0 for velocity, don't let
  it produce negative momentum.
- **Gaming** → stars can be bought; corroboration with organic HN discussion is the
  cheap anti-gaming heuristic. Real fix at scale = anomaly detection on the write path.

---

## 6. Tuning the weights

The constants (`W_STAR`, `W_HN`, `LAMBDA`) are config, not magic numbers — store in
one place, justify each. In interview, frame as: "These are product parameters I'd
A/B test against an engagement metric, not engineering constants. I picked sensible
defaults and made them tunable."
