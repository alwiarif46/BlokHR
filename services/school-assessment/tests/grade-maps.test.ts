import { describe, it, expect } from 'vitest';
import { mapCbse9Point, mapMsbshseSsc } from '../src/services/grade-maps';

describe('grade maps (P4-05)', () => {
  it.each([
    [100, 'A1', true],
    [91, 'A1', true],
    [90.9, 'A2', true],
    [81, 'A2', true],
    [71, 'B1', true],
    [61, 'B2', true],
    [51, 'C1', true],
    [41, 'C2', true],
    [33, 'D', true],
    [32.9, 'E', false],
    [0, 'E', false],
  ] as const)('CBSE 9pt %s → %s pass=%s', (pct, grade, pass) => {
    expect(mapCbse9Point(pct)).toEqual({ grade, pass });
  });

  it.each([
    [100, 'A', true],
    [75, 'A', true],
    [74.9, 'B', true],
    [60, 'B', true],
    [45, 'C', true],
    [35, 'D', true],
    [20, 'E', true],
    [19.9, 'F', false],
    [0, 'F', false],
  ] as const)('MSBSHSE SSC %s → %s pass=%s', (pct, grade, pass) => {
    expect(mapMsbshseSsc(pct)).toEqual({ grade, pass });
  });
});
