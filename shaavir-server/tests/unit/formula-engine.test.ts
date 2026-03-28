import { describe, it, expect } from 'vitest';
import {
  tenureMonths,
  tenureYears,
  isInProbation,
  calculateOvertimeIndia,
  calculateOvertimeFLSA,
  calculateEPF,
  calculateESI,
  calculateGratuity,
  calculateLateDeduction,
  calculateLWP,
  calculateBonus,
  calculateCTCBreakdown,
  FORMULA_REGISTRY,
} from '../../src/formula';

describe('Formula Engine — 10 Pre-built Formulas', () => {
  // ── 1. Tenure Calculator ──

  describe('1. Tenure Calculator', () => {
    it('calculates months between dates', () => {
      expect(tenureMonths('2022-01-15', '2024-01-15')).toBe(24);
    });

    it('handles partial month (day not reached)', () => {
      expect(tenureMonths('2022-01-20', '2024-01-15')).toBe(23);
    });

    it('returns 0 for future joining date', () => {
      expect(tenureMonths('2030-01-01', '2024-01-01')).toBe(0);
    });

    it('returns 0 for empty input', () => {
      expect(tenureMonths('')).toBe(0);
    });

    it('converts to fractional years', () => {
      expect(tenureYears('2022-01-15', '2024-01-15')).toBe(2);
    });

    it('detects probation', () => {
      expect(isInProbation('2024-01-01', 6, '2024-04-01')).toBe(true);
      expect(isInProbation('2024-01-01', 6, '2024-08-01')).toBe(false);
    });
  });

  // ── 2. Overtime India ──

  describe('2. Overtime India (Factories Act)', () => {
    it('calculates 2× rate for standard OT', () => {
      // Example from PeopleStrong: ₹1,00,000 basic, 26 days, 8 hrs, 4 OT hours
      const r = calculateOvertimeIndia({
        basicSalary: 100000,
        dearnessAllowance: 0,
        workingDaysPerMonth: 26,
        hoursPerDay: 8,
        overtimeHours: 4,
      });
      expect(r.hourlyRate).toBeCloseTo(480.77, 0);
      expect(r.multiplier).toBe(2);
      expect(r.otPay).toBeCloseTo(3846.16, 0);
    });

    it('calculates with DA included', () => {
      // ₹30,000 basic + ₹10,000 DA, 26 days, 8 hrs, 2 OT hours
      const r = calculateOvertimeIndia({
        basicSalary: 30000,
        dearnessAllowance: 10000,
        workingDaysPerMonth: 26,
        hoursPerDay: 8,
        overtimeHours: 2,
      });
      expect(r.hourlyRate).toBeCloseTo(192.31, 0);
      expect(r.otPay).toBeCloseTo(769.24, 0);
    });

    it('applies holiday multiplier (3× for some states)', () => {
      const r = calculateOvertimeIndia({
        basicSalary: 30000,
        dearnessAllowance: 0,
        workingDaysPerMonth: 26,
        hoursPerDay: 8,
        overtimeHours: 4,
        isHoliday: true,
        holidayMultiplier: 3,
      });
      expect(r.multiplier).toBe(3);
      expect(r.otRate).toBeCloseTo(432.69, 0);
    });
  });

  // ── 3. Overtime US FLSA ──

  describe('3. Overtime US (FLSA)', () => {
    it('calculates 1.5× for weekly hours over 40', () => {
      const r = calculateOvertimeFLSA({ hourlyRate: 25, weeklyHoursWorked: 45 });
      expect(r.regularHours).toBe(40);
      expect(r.otHours).toBe(5);
      expect(r.regularPay).toBe(1000);
      expect(r.otPay).toBe(187.5);
      expect(r.totalPay).toBe(1187.5);
    });

    it('no OT when under 40 hours', () => {
      const r = calculateOvertimeFLSA({ hourlyRate: 20, weeklyHoursWorked: 38 });
      expect(r.otHours).toBe(0);
      expect(r.totalPay).toBe(760);
    });

    it('supports California daily double-time (12+ hrs)', () => {
      const r = calculateOvertimeFLSA({
        hourlyRate: 30,
        weeklyHoursWorked: 50,
        dailyHours: 14,
        dailyThreshold: 8,
        dailyDoubleThreshold: 12,
      });
      expect(r.doubleTimeHours).toBe(2);
      expect(r.doubleTimePay).toBe(120);
    });
  });

  // ── 4. EPF / Provident Fund ──

  describe('4. EPF / Provident Fund', () => {
    it('calculates standard 12% contributions', () => {
      const r = calculateEPF({ basicPlusDa: 15000 });
      expect(r.employeeEpf).toBe(1800);
      expect(r.employerEps).toBeCloseTo(1249.5, 0);
      expect(r.totalContribution).toBeGreaterThan(3500);
    });

    it('caps at ₹15,000 when configured', () => {
      const r = calculateEPF({ basicPlusDa: 50000, capAtLimit: true });
      expect(r.wageBase).toBe(15000);
      expect(r.employeeEpf).toBe(1800);
    });

    it('uses actual basic when not capped', () => {
      const r = calculateEPF({ basicPlusDa: 50000, capAtLimit: false });
      expect(r.wageBase).toBe(50000);
      expect(r.employeeEpf).toBe(6000);
    });

    it('EPS always capped at ₹15,000 base', () => {
      const rHigh = calculateEPF({ basicPlusDa: 50000 });
      const rLow = calculateEPF({ basicPlusDa: 15000 });
      expect(rHigh.employerEps).toBe(rLow.employerEps);
    });
  });

  // ── 5. ESI ──

  describe('5. ESI', () => {
    it('applies when gross ≤ ₹21,000', () => {
      const r = calculateESI({ grossSalary: 20000 });
      expect(r.applicable).toBe(true);
      expect(r.employeeEsi).toBe(150);
      expect(r.employerEsi).toBe(650);
    });

    it('not applicable when gross > ₹21,000', () => {
      const r = calculateESI({ grossSalary: 25000 });
      expect(r.applicable).toBe(false);
      expect(r.employeeEsi).toBe(0);
    });

    it('exact threshold boundary', () => {
      const r = calculateESI({ grossSalary: 21000 });
      expect(r.applicable).toBe(true);
    });
  });

  // ── 6. Gratuity ──

  describe('6. Gratuity (Payment of Gratuity Act)', () => {
    it('calculates with ÷26 for Act-covered employer', () => {
      // Standard example: ₹80,000 basic+DA, 10 years
      const r = calculateGratuity({
        lastDrawnBasicPlusDa: 80000,
        yearsOfService: 10,
        monthsInFinalYear: 4,
        coveredUnderAct: true,
      });
      // (15 × 80000 × 10) / 26 = 461538.46
      expect(r.eligibleYears).toBe(10);
      expect(r.gratuityAmount).toBeCloseTo(461538.46, 0);
    });

    it('rounds up when final year ≥ 6 months', () => {
      const r = calculateGratuity({
        lastDrawnBasicPlusDa: 30000,
        yearsOfService: 7,
        monthsInFinalYear: 7,
        coveredUnderAct: true,
      });
      expect(r.eligibleYears).toBe(8);
    });

    it('uses ÷30 for non-covered employer', () => {
      const r = calculateGratuity({
        lastDrawnBasicPlusDa: 30000,
        yearsOfService: 7,
        monthsInFinalYear: 0,
        coveredUnderAct: false,
      });
      // (15 × 30000 × 7) / 30 = 105000
      expect(r.gratuityAmount).toBe(105000);
    });

    it('calculates tax-exempt vs taxable split', () => {
      const r = calculateGratuity({
        lastDrawnBasicPlusDa: 200000,
        yearsOfService: 25,
        monthsInFinalYear: 0,
        coveredUnderAct: true,
      });
      // (15 × 200000 × 25) / 26 = 2884615.38 → exceeds ₹20L
      expect(r.taxExempt).toBe(2000000);
      expect(r.taxable).toBeGreaterThan(0);
    });
  });

  // ── 7. Late Deduction ──

  describe('7. Late Deduction', () => {
    const config = {
      latesToDeduction: 4,
      deductionDaysPerLate: 0.5,
      tier1Count: 2,
      tier2Count: 3,
      tier3Count: 4,
    };

    it('no deduction when under grace threshold', () => {
      const r = calculateLateDeduction(3, config);
      expect(r.deductionDays).toBe(0);
      expect(r.excessLates).toBe(0);
    });

    it('deducts for excess lates', () => {
      const r = calculateLateDeduction(6, config);
      expect(r.excessLates).toBe(2);
      expect(r.deductionDays).toBe(1);
    });

    it('escalation tier 1 at 2 lates', () => {
      expect(calculateLateDeduction(2, config).escalationTier).toBe(1);
    });

    it('escalation tier 3 at 4+ lates', () => {
      const r = calculateLateDeduction(5, config);
      expect(r.escalationTier).toBe(3);
      expect(r.escalationLabel).toMatch(/No Show/);
    });

    it('zero lates = no escalation', () => {
      expect(calculateLateDeduction(0, config).escalationTier).toBe(0);
    });
  });

  // ── 8. LWP ──

  describe('8. LWP (Loss of Pay)', () => {
    it('calculates daily rate and deduction', () => {
      const r = calculateLWP({ grossSalary: 50000, paidDaysInMonth: 26, lwpDays: 3 });
      expect(r.dailyRate).toBeCloseTo(1923.08, 0);
      expect(r.lwpDeduction).toBeCloseTo(5769.23, 0);
      expect(r.netGrossAfterLwp).toBeCloseTo(44230.77, 0);
    });

    it('zero LWP days = no deduction', () => {
      const r = calculateLWP({ grossSalary: 50000, paidDaysInMonth: 26, lwpDays: 0 });
      expect(r.lwpDeduction).toBe(0);
      expect(r.netGrossAfterLwp).toBe(50000);
    });
  });

  // ── 9. Bonus ──

  describe('9. Bonus (Payment of Bonus Act)', () => {
    it('calculates minimum 8.33% statutory bonus', () => {
      const r = calculateBonus({ monthlySalary: 15000 });
      expect(r.eligible).toBe(true);
      expect(r.actualBonus).toBeCloseTo(1249.5, 0);
      expect(r.annualBonus).toBeCloseTo(14994, 0);
    });

    it('caps salary at ₹21,000', () => {
      const r = calculateBonus({ monthlySalary: 30000 });
      expect(r.eligible).toBe(false);
      expect(r.salaryForBonus).toBe(21000);
    });

    it('supports custom allocable percentage', () => {
      const r = calculateBonus({ monthlySalary: 15000, allocablePercent: 15 });
      expect(r.actualBonus).toBeCloseTo(2250, 0);
    });

    it('clamps between min and max', () => {
      const r = calculateBonus({ monthlySalary: 15000, allocablePercent: 25 });
      // Clamped to 20%
      expect(r.actualBonus).toBeCloseTo(3000, 0);
    });
  });

  // ── 10. CTC to Net Salary ──

  describe('10. CTC to Net Salary Breakdown', () => {
    it('breaks down ₹6L CTC correctly', () => {
      const r = calculateCTCBreakdown({
        annualCtc: 600000,
        basicPercent: 50,
        isMetro: true,
      });
      expect(r.annual.ctc).toBe(600000);
      expect(r.annual.gross).toBeLessThan(600000);
      expect(r.annual.basic).toBeGreaterThan(0);
      expect(r.annual.employerPf).toBeGreaterThan(0);
      expect(r.monthly.netTakeHome).toBeGreaterThan(0);
      expect(r.monthly.netTakeHome).toBeLessThan(r.monthly.gross);
    });

    it('breaks down ₹12L CTC (no ESI)', () => {
      const r = calculateCTCBreakdown({
        annualCtc: 1200000,
        basicPercent: 50,
        pfOnActualBasic: false,
        isMetro: true,
      });
      expect(r.monthly.employeeEsi).toBe(0); // Gross > ₹21,000
      expect(r.monthly.employeePf).toBe(1800); // Capped at ₹15,000 base
    });

    it('applies PF on actual basic when configured', () => {
      const r = calculateCTCBreakdown({
        annualCtc: 1200000,
        basicPercent: 50,
        pfOnActualBasic: true,
        isMetro: false,
      });
      expect(r.monthly.employeePf).toBeGreaterThan(1800);
    });

    it('monthly × 12 ≈ annual net', () => {
      const r = calculateCTCBreakdown({ annualCtc: 800000 });
      expect(r.annual.netTakeHome).toBeCloseTo(r.monthly.netTakeHome * 12, 0);
    });
  });

  // ── Registry ──

  describe('Formula Registry', () => {
    it('contains all 10 formulas', () => {
      expect(Object.keys(FORMULA_REGISTRY)).toHaveLength(10);
    });

    it('each formula has name, fn, category', () => {
      for (const [, formula] of Object.entries(FORMULA_REGISTRY)) {
        expect(formula.name).toBeTruthy();
        expect(typeof formula.fn).toBe('function');
        expect(formula.category).toBeTruthy();
      }
    });

    it('covers all categories', () => {
      const categories = new Set(Object.values(FORMULA_REGISTRY).map((f) => f.category));
      expect(categories).toContain('general');
      expect(categories).toContain('overtime');
      expect(categories).toContain('statutory');
      expect(categories).toContain('deduction');
      expect(categories).toContain('salary');
    });
  });
});
