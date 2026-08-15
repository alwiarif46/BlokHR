import { describe, it, expect } from 'vitest';
import {
  computeVariance,
  isoWeekNumber,
  type VarianceDeliveryInput,
  type VarianceInstanceInput,
  type VarianceTopicInput,
  type VarianceUnitInput,
} from '../src/services/variance';

describe('isoWeekNumber', () => {
  it('returns ISO week for known dates', () => {
    expect(isoWeekNumber('2025-01-02')).toBe(1);
    expect(isoWeekNumber('2025-03-10')).toBe(11);
  });
});

describe('computeVariance (P3-05 table-driven)', () => {
  const w1 = isoWeekNumber('2025-01-06'); // Mon week 2 of 2025? Let's pin dates:
  // Use dates we control via isoWeekNumber itself.

  type Case = {
    name: string;
    units: VarianceUnitInput[];
    topics: VarianceTopicInput[];
    deliveries: VarianceDeliveryInput[];
    instances: VarianceInstanceInput[];
    targetDate?: string;
    asOfDate?: string;
    assert: (r: ReturnType<typeof computeVariance>) => void;
  };

  const dA = '2025-03-03'; // week Wa
  const dB = '2025-03-10'; // week Wb
  const dC = '2025-03-17';
  const dD = '2025-03-24';
  const Wa = isoWeekNumber(dA);
  const Wb = isoWeekNumber(dB);
  const Wc = isoWeekNumber(dC);
  const Wd = isoWeekNumber(dD);

  const cases: Case[] = [
    {
      name: 'on-track: deliveries finish in planned window',
      units: [
        {
          id: 'u1',
          label: 'U1',
          plannedWeeks: 2,
          plannedStartWeek: Wa,
          sequence: 1,
        },
      ],
      topics: [
        { id: 't1', unitId: 'u1', sequence: 1 },
        { id: 't2', unitId: 'u1', sequence: 2 },
      ],
      deliveries: [
        { topicId: 't1', date: dA },
        { topicId: 't2', date: dB },
      ],
      instances: [],
      assert: (r) => {
        expect(r.units[0].plannedWindow.endWeek).toBe(Wa + 1);
        expect(r.units[0].slippageWeeks).toBe(Wb - (Wa + 1));
        // Wa+1 should equal Wb for consecutive ISO weeks
        expect(r.units[0].slippageWeeks).toBe(0);
        expect(r.remainingTopics).toBe(0);
        expect(r.stalled).toBe(false);
      },
    },
    {
      name: 'behind with lost-period attribution',
      units: [
        {
          id: 'u1',
          label: 'U1',
          plannedWeeks: 2,
          plannedStartWeek: Wa,
          sequence: 1,
        },
      ],
      topics: [
        { id: 't1', unitId: 'u1', sequence: 1 },
        { id: 't2', unitId: 'u1', sequence: 2 },
      ],
      deliveries: [
        { topicId: 't1', date: dA },
        { topicId: 't2', date: dD },
      ],
      instances: [
        { id: 'i1', week: Wb, status: 'lost', lostReason: 'holiday' },
        { id: 'i2', week: Wc, status: 'lost', lostReason: 'holiday' },
        { id: 'i3', week: Wc, status: 'lost', lostReason: 'strike' },
        { id: 'i4', week: Wd + 1, status: 'lost', lostReason: 'holiday' },
      ],
      assert: (r) => {
        expect(r.units[0].slippageWeeks).toBe(Wd - (Wa + 1));
        expect(r.units[0].lostPeriods).toEqual([
          { reason: 'holiday', count: 2 },
          { reason: 'strike', count: 1 },
        ]);
      },
    },
    {
      name: 'stalled: remaining topics but zero trailing rate',
      units: [
        {
          id: 'u1',
          label: 'U1',
          plannedWeeks: 4,
          plannedStartWeek: Wa,
          sequence: 1,
        },
      ],
      topics: [
        { id: 't1', unitId: 'u1', sequence: 1 },
        { id: 't2', unitId: 'u1', sequence: 2 },
        { id: 't3', unitId: 'u1', sequence: 3 },
      ],
      deliveries: [{ topicId: 't1', date: dA }],
      instances: [],
      asOfDate: '2025-08-01',
      assert: (r) => {
        expect(r.remainingTopics).toBe(2);
        expect(r.trailingFourWeekRate).toBe(0);
        expect(r.stalled).toBe(true);
        expect(r.projectedCompletionDate).toBeNull();
      },
    },
    {
      name: 'ahead of plan',
      units: [
        {
          id: 'u1',
          label: 'U1',
          plannedWeeks: 4,
          plannedStartWeek: Wa,
          sequence: 1,
        },
      ],
      topics: [
        { id: 't1', unitId: 'u1', sequence: 1 },
        { id: 't2', unitId: 'u1', sequence: 2 },
        { id: 't3', unitId: 'u1', sequence: 3 },
        { id: 't4', unitId: 'u1', sequence: 4 },
      ],
      deliveries: [
        { topicId: 't1', date: dA },
        { topicId: 't2', date: dA },
        { topicId: 't3', date: dB },
        { topicId: 't4', date: dB },
      ],
      instances: [],
      assert: (r) => {
        expect(r.units[0].slippageWeeks!).toBeLessThan(0);
        expect(r.remainingTopics).toBe(0);
      },
    },
    {
      name: 'empty delivery',
      units: [
        {
          id: 'u1',
          label: 'U1',
          plannedWeeks: 3,
          plannedStartWeek: Wa,
          sequence: 1,
        },
      ],
      topics: [
        { id: 't1', unitId: 'u1', sequence: 1 },
        { id: 't2', unitId: 'u1', sequence: 2 },
      ],
      deliveries: [],
      instances: [],
      assert: (r) => {
        expect(r.actualCurve.every((p) => p.cumulativeTopics === 0)).toBe(true);
        expect(r.remainingTopics).toBe(2);
        expect(r.stalled).toBe(true);
        expect(r.units[0].slippageWeeks).toBeNull();
        expect(r.units[0].lostPeriods).toEqual([]);
      },
    },
    {
      name: 'target comparison finishes 18 days after pre-board',
      units: [
        {
          id: 'u1',
          label: 'U1',
          plannedWeeks: 8,
          plannedStartWeek: Wa,
          sequence: 1,
        },
      ],
      topics: Array.from({ length: 10 }, (_, i) => ({
        id: `t${i + 1}`,
        unitId: 'u1',
        sequence: i + 1,
      })),
      deliveries: [
        { topicId: 't1', date: dA },
        { topicId: 't2', date: dB },
        { topicId: 't3', date: dC },
        { topicId: 't4', date: dD },
      ],
      instances: [],
      asOfDate: dD,
      targetDate: (() => {
        // rate = 4 topics / 4 weeks = 1; remaining 6 → +42 days from dD
        const projected = new Date(`${dD}T00:00:00.000Z`);
        projected.setUTCDate(projected.getUTCDate() + 42);
        const target = new Date(projected);
        target.setUTCDate(target.getUTCDate() - 18);
        return target.toISOString().slice(0, 10);
      })(),
      assert: (r) => {
        expect(r.trailingFourWeekRate).toBe(1);
        expect(r.daysPastTarget).toBe(18);
        expect(r.stalled).toBe(false);
      },
    },
    {
      name: 'single-week course',
      units: [
        {
          id: 'u1',
          label: 'U1',
          plannedWeeks: 1,
          plannedStartWeek: Wa,
          sequence: 1,
        },
      ],
      topics: [{ id: 't1', unitId: 'u1', sequence: 1 }],
      deliveries: [{ topicId: 't1', date: dA }],
      instances: [],
      assert: (r) => {
        expect(r.units[0].plannedWindow).toEqual({ startWeek: Wa, endWeek: Wa });
        expect(r.units[0].slippageWeeks).toBe(0);
        expect(
          r.plannedCurve.some((p) => p.week === Wa && p.cumulativeTopics === 1),
        ).toBe(true);
      },
    },
    {
      name: 'rate window shorter than 4 weeks',
      units: [
        {
          id: 'u1',
          label: 'U1',
          plannedWeeks: 2,
          plannedStartWeek: Wa,
          sequence: 1,
        },
      ],
      topics: [
        { id: 't1', unitId: 'u1', sequence: 1 },
        { id: 't2', unitId: 'u1', sequence: 2 },
        { id: 't3', unitId: 'u1', sequence: 3 },
      ],
      deliveries: [
        { topicId: 't1', date: dA },
        { topicId: 't2', date: dB },
      ],
      instances: [],
      asOfDate: dB,
      assert: (r) => {
        // window = min(4, Wb-Wa+1). Consecutive weeks → 2; rate = 2/2 = 1
        expect(Wb - Wa + 1).toBe(2);
        expect(r.trailingFourWeekRate).toBe(1);
        expect(r.remainingTopics).toBe(1);
        expect(r.stalled).toBe(false);
        const expected = new Date(`${dB}T00:00:00.000Z`);
        expected.setUTCDate(expected.getUTCDate() + 7);
        expect(r.projectedCompletionDate).toBe(expected.toISOString().slice(0, 10));
      },
    },
  ];

  it.each(cases.map((c) => [c.name, c] as const))('%s', (_name, c) => {
    const report = computeVariance(c.units, c.topics, c.deliveries, c.instances, {
      targetDate: c.targetDate,
      asOfDate: c.asOfDate,
    });
    c.assert(report);
  });
});
