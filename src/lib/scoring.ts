/**
 * Momentum scoring — the core derived signal of DevPulse.
 *
 * Pure, deterministic, no I/O and no clock: everything is derived from the inputs,
 * so it's trivially unit- and property-testable. Computed on the WRITE path (ingest
 * worker) and persisted, keeping the read path O(1) and cacheable.
 *
 * momentum = (W_STAR · normStarVelocity + W_HN · normHnActivity) · corroboration · 100
 *
 * See docs/reference/01-trend-scoring-deep-dive.md for the full rationale.
 */

export const SCORING = {
  /** Weight of star velocity vs HN activity in the blend. */
  W_STAR: 0.6,
  W_HN: 0.4,
  /** Exponential time-decay rate per reference interval (~2-interval half-life). */
  LAMBDA: 0.35,
  /** Multiplicative bonus when BOTH sources show positive activity (independent confirmation). */
  CORROBORATION_BONUS: 1.15,
  /** Reference cadence used to normalize uneven snapshot spacing (15 min). */
  INTERVAL_MS: 15 * 60 * 1000,
} as const;

export interface ScoringSnapshot {
  stars: number | null;
  hnPoints: number | null;
  hnComments: number | null;
  /** Epoch ms or Date. Used to handle uneven spacing / ingest gaps. */
  capturedAt: number | Date;
}

export interface Range {
  min: number;
  max: number;
}

export interface CohortStats {
  starVelocity: Range;
  hnActivity: Range;
}

const toMs = (t: number | Date): number => (t instanceof Date ? t.getTime() : t);
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));
const round = (x: number, dp: number): number => {
  const f = 10 ** dp;
  return Math.round(x * f) / f;
};

/**
 * Exponentially-weighted average star gain per reference interval.
 * Negative deltas (lost stars / deletions) are clamped to 0. Gaps are handled by
 * normalizing each delta to a per-interval rate using actual elapsed time, and by
 * decaying each interval's weight by its age relative to the most recent snapshot.
 */
export function starVelocity(snaps: ScoringSnapshot[]): number {
  if (snaps.length < 2) return 0;
  const ordered = [...snaps].sort((a, b) => toMs(a.capturedAt) - toMs(b.capturedAt));
  const newest = toMs(ordered[ordered.length - 1].capturedAt);

  let weighted = 0;
  let weightSum = 0;
  for (let i = 1; i < ordered.length; i++) {
    const prev = ordered[i - 1];
    const cur = ordered[i];
    const elapsedMs = toMs(cur.capturedAt) - toMs(prev.capturedAt);
    if (elapsedMs <= 0) continue; // duplicate/out-of-order timestamp — skip
    const gain = Math.max(0, (cur.stars ?? 0) - (prev.stars ?? 0));
    const ratePerInterval = gain / (elapsedMs / SCORING.INTERVAL_MS);
    const ageIntervals = (newest - toMs(cur.capturedAt)) / SCORING.INTERVAL_MS;
    const w = Math.exp(-SCORING.LAMBDA * ageIntervals);
    weighted += ratePerInterval * w;
    weightSum += w;
  }
  return weightSum === 0 ? 0 : weighted / weightSum;
}

/**
 * HN activity from the most recent snapshot. log1p compresses outliers so a single
 * viral story doesn't dominate; comments are weighted lower (noisier than points).
 */
export function hnActivity(snaps: ScoringSnapshot[]): number {
  if (snaps.length === 0) return 0;
  const ordered = [...snaps].sort((a, b) => toMs(a.capturedAt) - toMs(b.capturedAt));
  const latest = ordered[ordered.length - 1];
  return Math.log1p(latest.hnPoints ?? 0) + 0.5 * Math.log1p(latest.hnComments ?? 0);
}

/** Bonus applied only when both sources show positive signal. */
export function corroboration(sv: number, hn: number): number {
  return sv > 0 && hn > 0 ? SCORING.CORROBORATION_BONUS : 1;
}

/** Min-max normalize into [0,1]; degenerate ranges map to 0. */
export function normalize(value: number, range: Range): number {
  const denom = range.max - range.min;
  if (denom <= 0) return 0;
  return clamp((value - range.min) / denom, 0, 1);
}

/**
 * Combine the components into the final 0–115 momentum score.
 * `cohortStats` are computed across the current cohort at ingest time so that a small
 * fast-rising entity can out-rank a large stagnant one.
 */
export function momentumScore(snaps: ScoringSnapshot[], cohortStats: CohortStats): number {
  if (snaps.length === 0) return 0;
  const sv = starVelocity(snaps);
  const hn = hnActivity(snaps);
  const nSv = normalize(sv, cohortStats.starVelocity);
  const nHn = normalize(hn, cohortStats.hnActivity);
  const base = SCORING.W_STAR * nSv + SCORING.W_HN * nHn;
  const score = base * corroboration(nSv, nHn) * 100;
  return round(score, 3);
}

/**
 * Compute cohort ranges from raw component values across all tracked entities.
 * Run once per ingest cycle; feed into `momentumScore` for each entity.
 */
export function computeCohortStats(
  components: Array<{ starVelocity: number; hnActivity: number }>,
): CohortStats {
  if (components.length === 0) {
    return { starVelocity: { min: 0, max: 0 }, hnActivity: { min: 0, max: 0 } };
  }
  const sv = components.map((c) => c.starVelocity);
  const hn = components.map((c) => c.hnActivity);
  return {
    starVelocity: { min: Math.min(...sv), max: Math.max(...sv) },
    hnActivity: { min: Math.min(...hn), max: Math.max(...hn) },
  };
}
