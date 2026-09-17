import { describe, it, expect } from 'vitest';
import { computeCohortRanks } from '../src/services/rank';

describe('computeCohortRanks', () => {
  it('assigns tie ranks with skip (1,1,3)', () => {
    const ranks = computeCohortRanks([
      { studentId: 'a', percentage: 90, exempt: false },
      { studentId: 'b', percentage: 90, exempt: false },
      { studentId: 'c', percentage: 70, exempt: false },
    ]);
    expect(ranks.find((r) => r.studentId === 'a')!.rank).toBe(1);
    expect(ranks.find((r) => r.studentId === 'b')!.rank).toBe(1);
    expect(ranks.find((r) => r.studentId === 'c')!.rank).toBe(3);
    expect(ranks[0]!.outOf).toBe(3);
  });

  it('excludes exempt from pool; null percentage unranked', () => {
    const ranks = computeCohortRanks([
      { studentId: 'a', percentage: 80, exempt: false },
      { studentId: 'b', percentage: null, exempt: true },
      { studentId: 'c', percentage: null, exempt: false },
    ]);
    expect(ranks.find((r) => r.studentId === 'a')!.rank).toBe(1);
    expect(ranks.find((r) => r.studentId === 'a')!.outOf).toBe(1);
    expect(ranks.find((r) => r.studentId === 'b')!.rank).toBeNull();
    expect(ranks.find((r) => r.studentId === 'c')!.rank).toBeNull();
  });
});
