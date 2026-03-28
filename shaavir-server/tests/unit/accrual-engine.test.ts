import { describe, it, expect } from 'vitest';
import {
  computeAccrual,
  computeBalance,
  computeCarryForward,
} from '../../src/services/accrual-engine';
import type { AccrualContext } from '../../src/services/accrual-engine';

/** Default context — override what you need per test. */
function ctx(overrides: Partial<AccrualContext> = {}): AccrualContext {
  return {
    tenureMonths: 24,
    monthsInYear: 6,
    hoursWorked: 1040,
    daysWorked: 130,
    payPeriodsElapsed: 6,
    joinDayOfYear: 1,
    totalDaysInYear: 365,
    inProbation: false,
    probationMode: 'full',
    probationAccrual: 0,
    ...overrides,
  };
}

describe('Accrual Engine', () => {
  // ── 1. Flat ──

  describe('flat method', () => {
    it('accrues fixed days per month', () => {
      const r = computeAccrual('flat', { accrualPerMonth: 1.0 }, ctx({ monthsInYear: 6 }));
      expect(r.accruedDays).toBe(6);
      expect(r.monthlyRate).toBe(1.0);
    });

    it('handles fractional rates', () => {
      const r = computeAccrual('flat', { accrualPerMonth: 0.5 }, ctx({ monthsInYear: 12 }));
      expect(r.accruedDays).toBe(6);
    });

    it('handles zero rate', () => {
      const r = computeAccrual('flat', { accrualPerMonth: 0 }, ctx({ monthsInYear: 12 }));
      expect(r.accruedDays).toBe(0);
    });
  });

  // ── 2. Tenure Bucket ──

  describe('tenure_bucket method', () => {
    const config = {
      buckets: [
        { minMonths: 0, maxMonths: 12, accrualPerMonth: 1.0 },
        { minMonths: 12, maxMonths: 36, accrualPerMonth: 1.5 },
        { minMonths: 36, maxMonths: null, accrualPerMonth: 1.75 },
      ],
    };

    it('picks first bucket for new employee', () => {
      const r = computeAccrual('tenure_bucket', config, ctx({ tenureMonths: 6, monthsInYear: 6 }));
      expect(r.accruedDays).toBe(6);
      expect(r.monthlyRate).toBe(1.0);
    });

    it('picks second bucket for mid-tenure', () => {
      const r = computeAccrual(
        'tenure_bucket',
        config,
        ctx({ tenureMonths: 24, monthsInYear: 12 }),
      );
      expect(r.accruedDays).toBe(18);
      expect(r.monthlyRate).toBe(1.5);
    });

    it('picks open-ended bucket for senior employee', () => {
      const r = computeAccrual(
        'tenure_bucket',
        config,
        ctx({ tenureMonths: 60, monthsInYear: 12 }),
      );
      expect(r.accruedDays).toBe(21);
      expect(r.monthlyRate).toBe(1.75);
    });

    it('handles boundary exactly at minMonths', () => {
      const r = computeAccrual(
        'tenure_bucket',
        config,
        ctx({ tenureMonths: 12, monthsInYear: 12 }),
      );
      expect(r.monthlyRate).toBe(1.5);
    });
  });

  // ── 3. Annual Lump ──

  describe('annual_lump method', () => {
    it('grants full annual amount regardless of months', () => {
      const r = computeAccrual(
        'annual_lump',
        { annualDays: 15, grantDate: 'jan1' },
        ctx({ monthsInYear: 3 }),
      );
      expect(r.accruedDays).toBe(15);
    });
  });

  // ── 4. Per Hours Worked ──

  describe('per_hours_worked method', () => {
    it('calculates leave from hours ratio', () => {
      // 1040 hours worked / 30 = 34.67 leave hours / 8 = 4.33 days
      const r = computeAccrual(
        'per_hours_worked',
        { hoursPerLeaveHour: 30 },
        ctx({ hoursWorked: 1040 }),
      );
      expect(r.accruedDays).toBeCloseTo(4.33, 1);
    });

    it('returns 0 for 0 hours worked', () => {
      const r = computeAccrual(
        'per_hours_worked',
        { hoursPerLeaveHour: 30 },
        ctx({ hoursWorked: 0 }),
      );
      expect(r.accruedDays).toBe(0);
    });
  });

  // ── 5. Per Days Worked ──

  describe('per_days_worked method', () => {
    it('calculates leave from days ratio (Factories Act pattern)', () => {
      // 240 days worked / 20 = 12 leave days
      const r = computeAccrual(
        'per_days_worked',
        { daysPerLeaveDay: 20 },
        ctx({ daysWorked: 240 }),
      );
      expect(r.accruedDays).toBe(12);
    });

    it('handles partial days', () => {
      const r = computeAccrual(
        'per_days_worked',
        { daysPerLeaveDay: 20 },
        ctx({ daysWorked: 130 }),
      );
      expect(r.accruedDays).toBe(6.5);
    });
  });

  // ── 6. Tenure Linear ──

  describe('tenure_linear method', () => {
    it('adds increment per year of service', () => {
      // base 1.0 + 0.25 * 2 years = 1.5/month × 12 = 18
      const r = computeAccrual(
        'tenure_linear',
        { basePerMonth: 1.0, incrementPerYear: 0.25 },
        ctx({ tenureMonths: 24, monthsInYear: 12 }),
      );
      expect(r.accruedDays).toBe(18);
    });

    it('respects maxPerMonth cap', () => {
      // base 1.0 + 0.25 * 10 years = 3.5 → capped at 2.0
      const r = computeAccrual(
        'tenure_linear',
        { basePerMonth: 1.0, incrementPerYear: 0.25, maxPerMonth: 2.0 },
        ctx({ tenureMonths: 120, monthsInYear: 12 }),
      );
      expect(r.accruedDays).toBe(24);
    });
  });

  // ── 7. Per Pay Period ──

  describe('per_pay_period method', () => {
    it('accrues per elapsed pay period', () => {
      const r = computeAccrual(
        'per_pay_period',
        { daysPerPeriod: 1.25, periodType: 'biweekly' },
        ctx({ payPeriodsElapsed: 12 }),
      );
      expect(r.accruedDays).toBe(15);
    });
  });

  // ── 8. Pro-Rata ──

  describe('prorata method', () => {
    it('proportions annual entitlement from join date', () => {
      // 15 annual days, joined Jul 1 (day 182 of 365)
      // remaining = 365-182+1 = 184, ratio = 184/365 = 0.504
      const r = computeAccrual(
        'prorata',
        { annualDays: 15 },
        ctx({ joinDayOfYear: 182, totalDaysInYear: 365 }),
      );
      expect(r.accruedDays).toBeCloseTo(7.56, 1);
    });

    it('gives full entitlement for Jan 1 join', () => {
      const r = computeAccrual(
        'prorata',
        { annualDays: 15 },
        ctx({ joinDayOfYear: 1, totalDaysInYear: 365 }),
      );
      expect(r.accruedDays).toBe(15);
    });
  });

  // ── 9. Unlimited ──

  describe('unlimited method', () => {
    it('returns Infinity', () => {
      const r = computeAccrual('unlimited', {}, ctx());
      expect(r.accruedDays).toBe(Infinity);
    });
  });

  // ── Unknown method ──

  describe('unknown method', () => {
    it('returns 0 for unknown method', () => {
      const r = computeAccrual('banana', {}, ctx());
      expect(r.accruedDays).toBe(0);
    });
  });

  // ── Probation ──

  describe('probation logic', () => {
    it('no_accrual blocks all accrual during probation', () => {
      const r = computeAccrual(
        'flat',
        { accrualPerMonth: 1.0 },
        ctx({
          inProbation: true,
          probationMode: 'no_accrual',
          monthsInYear: 6,
        }),
      );
      expect(r.accruedDays).toBe(0);
    });

    it('reduced_rate uses probation accrual instead', () => {
      const r = computeAccrual(
        'flat',
        { accrualPerMonth: 1.0 },
        ctx({
          inProbation: true,
          probationMode: 'reduced_rate',
          probationAccrual: 0.5,
          monthsInYear: 6,
        }),
      );
      expect(r.accruedDays).toBe(3);
    });

    it('full mode accrues normally during probation', () => {
      const r = computeAccrual(
        'flat',
        { accrualPerMonth: 1.0 },
        ctx({
          inProbation: true,
          probationMode: 'full',
          monthsInYear: 6,
        }),
      );
      expect(r.accruedDays).toBe(6);
    });
  });

  // ── Balance computation ──

  describe('computeBalance', () => {
    it('calculates simple balance', () => {
      const r = computeBalance({
        accrued: 12,
        used: 3,
        carryForward: 2,
        maxAccumulation: 30,
        allowNegative: false,
        negativeAction: 'block',
      });
      expect(r.balance).toBe(11);
      expect(r.lwpDays).toBe(0);
    });

    it('converts negative to LWP when negativeAction is lwp', () => {
      const r = computeBalance({
        accrued: 5,
        used: 8,
        carryForward: 0,
        maxAccumulation: 30,
        allowNegative: true,
        negativeAction: 'lwp',
      });
      expect(r.balance).toBe(-3);
      expect(r.effectiveBalance).toBe(0);
      expect(r.lwpDays).toBe(3);
    });

    it('applies accumulation cap', () => {
      const r = computeBalance({
        accrued: 20,
        used: 0,
        carryForward: 15,
        maxAccumulation: 30,
        allowNegative: false,
        negativeAction: 'block',
      });
      expect(r.balance).toBe(30);
      expect(r.capped).toBe(true);
    });
  });

  // ── Carry-forward ──

  describe('computeCarryForward', () => {
    it('caps carry-forward at max', () => {
      expect(computeCarryForward(10, 5)).toBe(5);
    });

    it('carries full amount when under cap', () => {
      expect(computeCarryForward(3, 5)).toBe(3);
    });

    it('returns 0 when carry-forward is disabled', () => {
      expect(computeCarryForward(10, 0)).toBe(0);
    });

    it('ignores negative balance', () => {
      expect(computeCarryForward(-5, 5)).toBe(0);
    });
  });

  // ── Shaavir PTO preset ──

  describe('Shaavir PTO formula', () => {
    const shaavir = {
      buckets: [
        { minMonths: 0, maxMonths: 12, accrualPerMonth: 1.0 },
        { minMonths: 12, maxMonths: 36, accrualPerMonth: 1.5 },
        { minMonths: 36, maxMonths: null, accrualPerMonth: 1.75 },
      ],
    };

    it('new hire: 1 day/month × 12 months = 12 days/year', () => {
      const r = computeAccrual(
        'tenure_bucket',
        shaavir,
        ctx({ tenureMonths: 3, monthsInYear: 12 }),
      );
      expect(r.accruedDays).toBe(12);
    });

    it('2 year employee: 1.5 days/month × 12 = 18 days/year', () => {
      const r = computeAccrual(
        'tenure_bucket',
        shaavir,
        ctx({ tenureMonths: 24, monthsInYear: 12 }),
      );
      expect(r.accruedDays).toBe(18);
    });

    it('5 year veteran: 1.75 days/month × 12 = 21 days/year', () => {
      const r = computeAccrual(
        'tenure_bucket',
        shaavir,
        ctx({ tenureMonths: 60, monthsInYear: 12 }),
      );
      expect(r.accruedDays).toBe(21);
    });

    it('carry-forward capped at 5 days', () => {
      expect(computeCarryForward(8, 5)).toBe(5);
      expect(computeCarryForward(3, 5)).toBe(3);
    });

    it('negative balance → LWP conversion', () => {
      const r = computeBalance({
        accrued: 6,
        used: 9,
        carryForward: 0,
        maxAccumulation: 30,
        allowNegative: true,
        negativeAction: 'lwp',
      });
      expect(r.lwpDays).toBe(3);
      expect(r.effectiveBalance).toBe(0);
    });
  });
});
