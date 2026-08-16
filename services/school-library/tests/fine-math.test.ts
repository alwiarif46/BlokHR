import { describe, it, expect } from 'vitest';
import { computeFine } from '../src/services/fine-math';

describe('fine-math (P10-03)', () => {
  const base = {
    dueOn: '2026-01-01',
    finePaisePerDay: 500,
    fineCapPaise: 20000,
    graceDays: 0,
  };

  it('zero when as_of on or before due', () => {
    expect(computeFine({ ...base, asOf: '2026-01-01' })).toEqual({
      daysOverdue: 0,
      amountPaise: 0,
    });
    expect(computeFine({ ...base, asOf: '2025-12-31' })).toEqual({
      daysOverdue: 0,
      amountPaise: 0,
    });
  });

  it('counts calendar days and applies rate', () => {
    expect(computeFine({ ...base, asOf: '2026-01-04' })).toEqual({
      daysOverdue: 3,
      amountPaise: 1500,
    });
  });

  it('subtracts grace days', () => {
    expect(
      computeFine({ ...base, asOf: '2026-01-05', graceDays: 2 }),
    ).toEqual({
      daysOverdue: 2,
      amountPaise: 1000,
    });
    expect(
      computeFine({ ...base, asOf: '2026-01-03', graceDays: 2 }),
    ).toEqual({
      daysOverdue: 0,
      amountPaise: 0,
    });
  });

  it('caps amount at fine_cap_paise', () => {
    expect(
      computeFine({
        ...base,
        asOf: '2026-03-01',
        fineCapPaise: 2000,
      }),
    ).toEqual({
      daysOverdue: 59,
      amountPaise: 2000,
    });
  });
});
