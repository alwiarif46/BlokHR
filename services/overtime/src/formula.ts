/**
 * Overtime (India) — pure formula.
 *
 * Ported from backend/src/formula/engine.ts (Factories Act §59):
 *   OT Pay = multiplier × [(Basic + DA) ÷ (workingDays × hoursPerDay)] × OT hours
 *
 * Standard: 9 hrs/day, 48 hrs/week, 2× rate (weekday) / 3× (holiday) mandatory.
 * Max: 125 hours per quarter (most states).
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface OvertimeIndiaInput {
  basicSalary: number;
  dearnessAllowance: number;
  workingDaysPerMonth: number;
  hoursPerDay: number;
  overtimeHours: number;
  isHoliday?: boolean;
  holidayMultiplier?: number;
}

export interface OvertimeResult {
  hourlyRate: number;
  otRate: number;
  otPay: number;
  totalOtHours: number;
  multiplier: number;
}

export function calculateOvertimeIndia(input: OvertimeIndiaInput): OvertimeResult {
  const base = input.basicSalary + input.dearnessAllowance;
  const hourlyRate = round2(base / (input.workingDaysPerMonth * input.hoursPerDay));
  const multiplier = input.isHoliday ? (input.holidayMultiplier ?? 3) : 2;
  const otRate = round2(hourlyRate * multiplier);
  const otPay = round2(otRate * input.overtimeHours);

  return {
    hourlyRate,
    otRate,
    otPay,
    totalOtHours: input.overtimeHours,
    multiplier,
  };
}
