import { describe, it, expect } from 'vitest';
import {
  SCORING,
  starVelocity,
  hnActivity,
  corroboration,
  normalize,
  momentumScore,
  computeCohortStats,
  type ScoringSnapshot,
  type CohortStats,
} from '@/lib/scoring';

const I = SCORING.INTERVAL_MS;
const base = 1_700_000_000_000; // fixed epoch — keep tests deterministic (no Date.now)

/** Build a series of snapshots `intervals` apart with the given star counts. */
function series(stars: number[], hn?: { points?: number; comments?: number }): ScoringSnapshot[] {
  return stars.map((s, i) => ({
    stars: s,
    hnPoints: i === stars.length - 1 ? (hn?.points ?? 0) : 0,
    hnComments: i === stars.length - 1 ? (hn?.comments ?? 0) : 0,
    capturedAt: base + i * I,
  }));
}

const UNIT_COHORT: CohortStats = {
  starVelocity: { min: 0, max: 100 },
  hnActivity: { min: 0, max: 10 },
};

describe('starVelocity', () => {
  it('returns 0 for fewer than two snapshots', () => {
    expect(starVelocity([])).toBe(0);
    expect(starVelocity(series([10]))).toBe(0);
  });

  it('computes a positive velocity for a rising series', () => {
    expect(starVelocity(series([100, 110, 130]))).toBeGreaterThan(0);
  });

  it('clamps negative deltas (lost stars) to zero, never negative', () => {
    expect(starVelocity(series([100, 80, 60]))).toBe(0);
  });

  it('weights recent gains more than older gains (decay)', () => {
    // Same total gain (40), but concentrated late vs early.
    const lateGain = starVelocity(series([100, 100, 140])); // gain in last interval
    const earlyGain = starVelocity(series([100, 140, 140])); // gain in first interval
    expect(lateGain).toBeGreaterThan(earlyGain);
  });

  it('normalizes for uneven spacing (gaps) via per-interval rate', () => {
    // 20 stars over one interval vs 20 stars over two intervals -> first has higher rate.
    const tight: ScoringSnapshot[] = [
      { stars: 100, hnPoints: 0, hnComments: 0, capturedAt: base },
      { stars: 120, hnPoints: 0, hnComments: 0, capturedAt: base + I },
    ];
    const spread: ScoringSnapshot[] = [
      { stars: 100, hnPoints: 0, hnComments: 0, capturedAt: base },
      { stars: 120, hnPoints: 0, hnComments: 0, capturedAt: base + 2 * I },
    ];
    expect(starVelocity(tight)).toBeGreaterThan(starVelocity(spread));
  });

  it('ignores duplicate / out-of-order timestamps without crashing', () => {
    const dup: ScoringSnapshot[] = [
      { stars: 100, hnPoints: 0, hnComments: 0, capturedAt: base },
      { stars: 110, hnPoints: 0, hnComments: 0, capturedAt: base }, // same ts
      { stars: 130, hnPoints: 0, hnComments: 0, capturedAt: base + I },
    ];
    expect(Number.isFinite(starVelocity(dup))).toBe(true);
    expect(starVelocity(dup)).toBeGreaterThan(0);
  });

  it('treats null star counts as zero', () => {
    const s: ScoringSnapshot[] = [
      { stars: null, hnPoints: 0, hnComments: 0, capturedAt: base },
      { stars: 10, hnPoints: 0, hnComments: 0, capturedAt: base + I },
    ];
    expect(starVelocity(s)).toBe(10);
  });
});

describe('hnActivity', () => {
  it('is zero with no HN signal', () => {
    expect(hnActivity(series([1, 2]))).toBe(0);
  });

  it('uses the latest snapshot and compresses outliers (log scale)', () => {
    const small = hnActivity(series([1, 2], { points: 10 }));
    const big = hnActivity(series([1, 2], { points: 1000 }));
    expect(big).toBeGreaterThan(small);
    // log compression: 100x points is far less than 100x activity
    expect(big).toBeLessThan(small * 5);
  });

  it('weights comments lower than points', () => {
    const points = hnActivity(series([1, 2], { points: 100 }));
    const comments = hnActivity(series([1, 2], { comments: 100 }));
    expect(points).toBeGreaterThan(comments);
  });

  it('handles null HN fields as zero', () => {
    const s: ScoringSnapshot[] = [{ stars: 1, hnPoints: null, hnComments: null, capturedAt: base }];
    expect(hnActivity(s)).toBe(0);
  });
});

describe('corroboration', () => {
  it('applies the bonus only when both signals are positive', () => {
    expect(corroboration(1, 1)).toBe(SCORING.CORROBORATION_BONUS);
    expect(corroboration(1, 0)).toBe(1);
    expect(corroboration(0, 1)).toBe(1);
    expect(corroboration(0, 0)).toBe(1);
  });
});

describe('normalize', () => {
  it('maps within range to [0,1]', () => {
    expect(normalize(50, { min: 0, max: 100 })).toBe(0.5);
  });
  it('clamps out-of-range values', () => {
    expect(normalize(-10, { min: 0, max: 100 })).toBe(0);
    expect(normalize(200, { min: 0, max: 100 })).toBe(1);
  });
  it('returns 0 for a degenerate (zero-width) range', () => {
    expect(normalize(5, { min: 5, max: 5 })).toBe(0);
    expect(normalize(5, { min: 10, max: 0 })).toBe(0);
  });
});

describe('momentumScore', () => {
  it('is 0 for an empty series and finite for a single snapshot', () => {
    expect(momentumScore([], UNIT_COHORT)).toBe(0);
    expect(Number.isFinite(momentumScore(series([10]), UNIT_COHORT))).toBe(true);
  });

  it('rewards recent gains over old gains (monotonic in recency)', () => {
    const recent = momentumScore(series([100, 100, 200]), UNIT_COHORT);
    const old = momentumScore(series([100, 200, 200]), UNIT_COHORT);
    expect(recent).toBeGreaterThan(old);
  });

  it('applies the corroboration bonus when both sources are active', () => {
    const cohort: CohortStats = {
      starVelocity: { min: 0, max: 50 },
      hnActivity: { min: 0, max: 6 },
    };
    const both = momentumScore(series([100, 150], { points: 200 }), cohort);
    const starsOnly = momentumScore(series([100, 150]), cohort);
    // both-active score must exceed the bonus-free star-only contribution
    expect(both).toBeGreaterThan(starsOnly);
  });

  it('never produces NaN or negative values on degenerate input', () => {
    const degenerate: CohortStats = {
      starVelocity: { min: 0, max: 0 },
      hnActivity: { min: 0, max: 0 },
    };
    const s = momentumScore(series([100, 80]), degenerate);
    expect(Number.isFinite(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
  });

  it('rounds to 3 decimal places', () => {
    const s = momentumScore(series([100, 137]), UNIT_COHORT);
    expect(s).toBe(Number(s.toFixed(3)));
  });
});

describe('computeCohortStats', () => {
  it('returns zero ranges for an empty cohort', () => {
    expect(computeCohortStats([])).toEqual({
      starVelocity: { min: 0, max: 0 },
      hnActivity: { min: 0, max: 0 },
    });
  });

  it('computes min/max across the cohort', () => {
    const stats = computeCohortStats([
      { starVelocity: 5, hnActivity: 1 },
      { starVelocity: 50, hnActivity: 8 },
      { starVelocity: 20, hnActivity: 3 },
    ]);
    expect(stats.starVelocity).toEqual({ min: 5, max: 50 });
    expect(stats.hnActivity).toEqual({ min: 1, max: 8 });
  });
});
