/**
 * Formula Engine — 10 pre-built HR calculation formulas.
 *
 * Every function is pure: input → output. No DB, no side effects.
 * Services call these with data they've already fetched.
 *
 * Pre-built formulas (sourced from Indian labor law + international HR standards):
 *
 *  1. Tenure Calculator         — months/years from joining date
 *  2. Overtime (India)          — Factories Act §59: 2× (Basic+DA) ÷ (26×8) × OT hours
 *  3. Overtime (US FLSA)        — 1.5× hourly rate for hours over 40/week
 *  4. EPF / Provident Fund      — 12% of (Basic+DA), employer split 3.67% EPF + 8.33% EPS
 *  5. ESI                       — 0.75% employee + 3.25% employer (if gross ≤ ₹21,000)
 *  6. Gratuity                  — (15 × last drawn Basic+DA × years) ÷ 26 (or ÷30)
 *  7. Late Deduction            — excess lates × deduction rate per late
 *  8. LWP (Loss of Pay)        — gross ÷ paid days × LWP days
 *  9. Bonus (Payment of Bonus)  — 8.33%–20% of salary, salary capped at ₹21,000
 * 10. CTC to Net Salary         — CTC → Gross → deductions → Net take-home
 */

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════
//  1. TENURE CALCULATOR
// ═══════════════════════════════════════════════════════════════

/** Complete months from joining date to reference date. */
export function tenureMonths(joiningDate: string, referenceDate?: string): number {
  if (!joiningDate) return 0;
  const joined = new Date(joiningDate + 'T00:00:00');
  const ref = referenceDate ? new Date(referenceDate + 'T00:00:00') : new Date();
  if (isNaN(joined.getTime()) || isNaN(ref.getTime()) || ref < joined) return 0;
  const months =
    (ref.getFullYear() - joined.getFullYear()) * 12 + (ref.getMonth() - joined.getMonth());
  if (ref.getDate() < joined.getDate()) return Math.max(0, months - 1);
  return Math.max(0, months);
}

/** Fractional years (for display). */
export function tenureYears(joiningDate: string, referenceDate?: string): number {
  return round2(tenureMonths(joiningDate, referenceDate) / 12);
}

/** Whether an employee is in probation. */
export function isInProbation(
  joiningDate: string,
  probationMonths: number,
  referenceDate?: string,
): boolean {
  if (probationMonths <= 0) return false;
  return tenureMonths(joiningDate, referenceDate) < probationMonths;
}

// ═══════════════════════════════════════════════════════════════
//  2. OVERTIME — INDIA (Factories Act §59 + Shops & Establishment)
//
//  Formula: OT Pay = 2 × [(Basic + DA) ÷ (workingDays × hoursPerDay)] × OT Hours
//  Source: Section 59 Factories Act 1948; state S&E Acts
//  Standard: 9 hrs/day, 48 hrs/week, 2× rate mandatory
//  Max: 125 hours per quarter (most states)
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
//  3. OVERTIME — US FLSA
//
//  Formula: OT Pay = 1.5 × hourlyRate × hours over 40/week
//  Source: Fair Labor Standards Act (FLSA)
//  Standard: 40 hrs/week; 1.5× (time and a half)
//  Some states (CA): daily OT after 8 hrs; double-time after 12 hrs
// ═══════════════════════════════════════════════════════════════

export interface OvertimeFLSAInput {
  hourlyRate: number;
  weeklyHoursWorked: number;
  weeklyThreshold?: number;
  dailyHours?: number;
  dailyThreshold?: number;
  dailyDoubleThreshold?: number;
}

export interface OvertimeFLSAResult {
  regularHours: number;
  otHours: number;
  doubleTimeHours: number;
  regularPay: number;
  otPay: number;
  doubleTimePay: number;
  totalPay: number;
}

export function calculateOvertimeFLSA(input: OvertimeFLSAInput): OvertimeFLSAResult {
  const threshold = input.weeklyThreshold ?? 40;
  const regularHours = Math.min(input.weeklyHoursWorked, threshold);
  let otHours = Math.max(0, input.weeklyHoursWorked - threshold);
  let doubleTimeHours = 0;

  // California-style daily OT
  if (input.dailyHours !== undefined && input.dailyThreshold !== undefined) {
    const dailyOt = Math.max(0, input.dailyHours - input.dailyThreshold);
    const dailyDoubleTh = input.dailyDoubleThreshold ?? 12;
    const dailyDouble = Math.max(0, input.dailyHours - dailyDoubleTh);
    otHours = Math.max(otHours, dailyOt - dailyDouble);
    doubleTimeHours = dailyDouble;
  }

  return {
    regularHours,
    otHours,
    doubleTimeHours,
    regularPay: round2(regularHours * input.hourlyRate),
    otPay: round2(otHours * input.hourlyRate * 1.5),
    doubleTimePay: round2(doubleTimeHours * input.hourlyRate * 2),
    totalPay: round2(
      regularHours * input.hourlyRate +
        otHours * input.hourlyRate * 1.5 +
        doubleTimeHours * input.hourlyRate * 2,
    ),
  };
}

// ═══════════════════════════════════════════════════════════════
//  4. EPF / PROVIDENT FUND (India)
//
//  Employee: 12% of (Basic + DA), optional cap at ₹15,000
//  Employer: 12% split → 3.67% to EPF + 8.33% to EPS (capped at ₹15,000 for EPS)
//  EDLI: 0.5% of (Basic + DA); Admin: 0.5%
//  Source: EPF & Misc Provisions Act, 1952
// ═══════════════════════════════════════════════════════════════

export interface EPFInput {
  basicPlusDa: number;
  capAtLimit?: boolean;
  wageLimit?: number;
}

export interface EPFResult {
  employeeEpf: number;
  employerEpf: number;
  employerEps: number;
  employerEdli: number;
  employerAdmin: number;
  totalEmployer: number;
  totalContribution: number;
  wageBase: number;
}

export function calculateEPF(input: EPFInput): EPFResult {
  const limit = input.wageLimit ?? 15000;
  const wageBase = input.capAtLimit ? Math.min(input.basicPlusDa, limit) : input.basicPlusDa;
  const epsBase = Math.min(input.basicPlusDa, limit);

  const employeeEpf = round2(wageBase * 0.12);
  const employerEps = round2(epsBase * 0.0833);
  const employerEpf = round2(wageBase * 0.12 - employerEps);
  const employerEdli = round2(epsBase * 0.005);
  const employerAdmin = round2(epsBase * 0.005);
  const totalEmployer = round2(employerEpf + employerEps + employerEdli + employerAdmin);

  return {
    employeeEpf,
    employerEpf: Math.max(0, employerEpf),
    employerEps,
    employerEdli,
    employerAdmin,
    totalEmployer,
    totalContribution: round2(employeeEpf + totalEmployer),
    wageBase,
  };
}

// ═══════════════════════════════════════════════════════════════
//  5. ESI — EMPLOYEES' STATE INSURANCE (India)
//
//  Applicable if gross salary ≤ ₹21,000/month
//  Employee: 0.75% of gross
//  Employer: 3.25% of gross
//  Source: ESI Act, 1948
// ═══════════════════════════════════════════════════════════════

export interface ESIInput {
  grossSalary: number;
  esiThreshold?: number;
}

export interface ESIResult {
  applicable: boolean;
  employeeEsi: number;
  employerEsi: number;
  totalEsi: number;
}

export function calculateESI(input: ESIInput): ESIResult {
  const threshold = input.esiThreshold ?? 21000;
  if (input.grossSalary > threshold) {
    return { applicable: false, employeeEsi: 0, employerEsi: 0, totalEsi: 0 };
  }
  const employeeEsi = round2(input.grossSalary * 0.0075);
  const employerEsi = round2(input.grossSalary * 0.0325);
  return {
    applicable: true,
    employeeEsi,
    employerEsi,
    totalEsi: round2(employeeEsi + employerEsi),
  };
}

// ═══════════════════════════════════════════════════════════════
//  6. GRATUITY (India)
//
//  Covered under Act:   (15 × last drawn Basic+DA × years) ÷ 26
//  Not covered:         (15 × last drawn Basic+DA × years) ÷ 30
//  Max tax-exempt: ₹20,00,000 (private); unlimited (govt)
//  Eligibility: 5 years continuous service (1 year for fixed-term, new code)
//  Years: round up if ≥ 6 months in final year
//  Source: Payment of Gratuity Act, 1972; Social Security Code, 2020
// ═══════════════════════════════════════════════════════════════

export interface GratuityInput {
  lastDrawnBasicPlusDa: number;
  yearsOfService: number;
  monthsInFinalYear: number;
  coveredUnderAct: boolean;
  taxExemptLimit?: number;
}

export interface GratuityResult {
  eligibleYears: number;
  gratuityAmount: number;
  taxExempt: number;
  taxable: number;
  formula: string;
}

export function calculateGratuity(input: GratuityInput): GratuityResult {
  // Round up final year if ≥ 6 months
  const eligibleYears =
    input.monthsInFinalYear >= 6 ? input.yearsOfService + 1 : input.yearsOfService;

  const divisor = input.coveredUnderAct ? 26 : 30;
  const gratuityAmount = round2((15 * input.lastDrawnBasicPlusDa * eligibleYears) / divisor);

  const limit = input.taxExemptLimit ?? 2000000;
  const taxExempt = Math.min(gratuityAmount, limit);
  const taxable = Math.max(0, gratuityAmount - limit);

  return {
    eligibleYears,
    gratuityAmount,
    taxExempt,
    taxable,
    formula: `(15 × ₹${input.lastDrawnBasicPlusDa} × ${eligibleYears}) ÷ ${divisor}`,
  };
}

// ═══════════════════════════════════════════════════════════════
//  7. LATE DEDUCTION
//
//  Formula: excessLates = max(0, lateCount - graceThreshold)
//           deductionDays = excessLates × deductionRate
//  Escalation tiers for progressive disciplinary action.
// ═══════════════════════════════════════════════════════════════

export interface LateDeductionConfig {
  latesToDeduction: number;
  deductionDaysPerLate: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
}

export interface LateDeductionResult {
  lateCount: number;
  excessLates: number;
  deductionDays: number;
  escalationTier: number;
  escalationLabel: string;
}

export function calculateLateDeduction(
  lateCount: number,
  config: LateDeductionConfig,
): LateDeductionResult {
  const excessLates = Math.max(0, lateCount - config.latesToDeduction);
  const deductionDays = round2(excessLates * config.deductionDaysPerLate);

  let escalationTier = 0;
  let escalationLabel = 'None';
  if (lateCount >= config.tier3Count) {
    escalationTier = 3;
    escalationLabel = 'Tier 3 — No Show Alert';
  } else if (lateCount >= config.tier2Count) {
    escalationTier = 2;
    escalationLabel = 'Tier 2 — Salary Warning';
  } else if (lateCount >= config.tier1Count) {
    escalationTier = 1;
    escalationLabel = 'Tier 1 — Verbal Warning';
  }

  return { lateCount, excessLates, deductionDays, escalationTier, escalationLabel };
}

// ═══════════════════════════════════════════════════════════════
//  8. LWP — LOSS OF PAY
//
//  Formula: LWP deduction = (gross ÷ paidDaysInMonth) × lwpDays
//  Used when employee has exhausted all leave balances.
// ═══════════════════════════════════════════════════════════════

export interface LWPInput {
  grossSalary: number;
  paidDaysInMonth: number;
  lwpDays: number;
}

export interface LWPResult {
  dailyRate: number;
  lwpDeduction: number;
  netGrossAfterLwp: number;
}

export function calculateLWP(input: LWPInput): LWPResult {
  const dailyRate = round2(input.grossSalary / input.paidDaysInMonth);
  const lwpDeduction = round2(dailyRate * input.lwpDays);
  return {
    dailyRate,
    lwpDeduction,
    netGrossAfterLwp: round2(input.grossSalary - lwpDeduction),
  };
}

// ═══════════════════════════════════════════════════════════════
//  9. BONUS — PAYMENT OF BONUS ACT (India)
//
//  Min: 8.33% of salary (statutory minimum)
//  Max: 20% of salary
//  Salary for bonus: capped at ₹21,000/month (or ₹7,000 min wage, whichever higher)
//  Eligibility: salary ≤ ₹21,000/month; worked ≥ 30 days in year
//  Source: Payment of Bonus Act, 1965 (amended 2015)
// ═══════════════════════════════════════════════════════════════

export interface BonusInput {
  monthlySalary: number;
  salaryCap?: number;
  minPercent?: number;
  maxPercent?: number;
  allocablePercent?: number;
}

export interface BonusResult {
  eligible: boolean;
  salaryForBonus: number;
  minBonus: number;
  maxBonus: number;
  actualBonus: number;
  annualBonus: number;
  formula: string;
}

export function calculateBonus(input: BonusInput): BonusResult {
  const cap = input.salaryCap ?? 21000;
  const minPct = input.minPercent ?? 8.33;
  const maxPct = input.maxPercent ?? 20;
  const allocable = input.allocablePercent ?? minPct;

  const eligible = input.monthlySalary <= cap;
  const salaryForBonus = Math.min(input.monthlySalary, cap);

  const minBonus = round2((salaryForBonus * minPct) / 100);
  const maxBonus = round2((salaryForBonus * maxPct) / 100);
  const actualBonus = round2(
    (salaryForBonus * Math.min(Math.max(allocable, minPct), maxPct)) / 100,
  );
  const annualBonus = round2(actualBonus * 12);

  return {
    eligible,
    salaryForBonus,
    minBonus,
    maxBonus,
    actualBonus,
    annualBonus,
    formula: `${Math.min(Math.max(allocable, minPct), maxPct)}% × ₹${salaryForBonus} × 12`,
  };
}

// ═══════════════════════════════════════════════════════════════
// 10. CTC TO NET SALARY (India)
//
//  CTC = Gross + Employer PF + Employer ESI + Gratuity provision + Bonus
//  Gross = Basic + HRA + Special Allowance + other allowances
//  Net = Gross - Employee PF - Employee ESI - PT - TDS
//  Source: Standard Indian salary structuring practice
// ═══════════════════════════════════════════════════════════════

export interface CTCBreakdownInput {
  annualCtc: number;
  basicPercent?: number;
  hraPercent?: number;
  pfOnActualBasic?: boolean;
  pfWageCeiling?: number;
  includeGratuity?: boolean;
  includeBonus?: boolean;
  professionalTaxMonthly?: number;
  monthlyTds?: number;
  isMetro?: boolean;
}

export interface CTCBreakdownResult {
  monthly: {
    basic: number;
    hra: number;
    specialAllowance: number;
    gross: number;
    employeePf: number;
    employeeEsi: number;
    professionalTax: number;
    tds: number;
    totalDeductions: number;
    netTakeHome: number;
  };
  annual: {
    ctc: number;
    gross: number;
    basic: number;
    hra: number;
    specialAllowance: number;
    employerPf: number;
    employerEsi: number;
    gratuityProvision: number;
    bonusProvision: number;
    netTakeHome: number;
  };
}

export function calculateCTCBreakdown(input: CTCBreakdownInput): CTCBreakdownResult {
  const annualCtc = input.annualCtc;
  const basicPct = input.basicPercent ?? 50;
  const hraPct = input.hraPercent ?? (input.isMetro ? 50 : 40);
  const pfCeiling = input.pfWageCeiling ?? 15000;

  // Step 1: Estimate basic from CTC
  // CTC = Gross + Employer contributions
  // Start with basic = basicPct% of CTC, then iterate
  let annualBasic = round2((annualCtc * basicPct) / 100);
  const monthlyBasic = round2(annualBasic / 12);

  // Employer PF
  const pfBase = input.pfOnActualBasic ? monthlyBasic : Math.min(monthlyBasic, pfCeiling);
  const monthlyEmployerPf = round2(pfBase * 0.12);
  const annualEmployerPf = round2(monthlyEmployerPf * 12);

  // Gratuity provision: 4.81% of basic annually
  const annualGratuity = input.includeGratuity !== false ? round2(annualBasic * 0.0481) : 0;

  // Bonus provision: 8.33% of basic (or salary cap)
  const annualBonusProvision =
    input.includeBonus !== false ? round2(Math.min(monthlyBasic, 21000) * 0.0833 * 12) : 0;

  // Employer ESI
  const estimatedMonthlyGross = round2(
    annualCtc / 12 - monthlyEmployerPf - annualGratuity / 12 - annualBonusProvision / 12,
  );
  const esi = calculateESI({ grossSalary: estimatedMonthlyGross });
  const annualEmployerEsi = round2(esi.employerEsi * 12);

  // Gross = CTC - employer contributions
  const annualGross = round2(
    annualCtc - annualEmployerPf - annualEmployerEsi - annualGratuity - annualBonusProvision,
  );
  const monthlyGross = round2(annualGross / 12);

  // Recalculate basic from gross
  annualBasic = round2((annualGross * basicPct) / 100);
  const recalcMonthlyBasic = round2(annualBasic / 12);
  const recalcMonthlyHra = round2((recalcMonthlyBasic * hraPct) / 100);
  const monthlySpecial = round2(monthlyGross - recalcMonthlyBasic - recalcMonthlyHra);

  // Employee deductions
  const empPfBase = input.pfOnActualBasic
    ? recalcMonthlyBasic
    : Math.min(recalcMonthlyBasic, pfCeiling);
  const monthlyEmployeePf = round2(empPfBase * 0.12);
  const monthlyEmployeeEsi = esi.employeeEsi;
  const monthlyPt = input.professionalTaxMonthly ?? 200;
  const monthlyTds = input.monthlyTds ?? 0;

  const totalDeductions = round2(monthlyEmployeePf + monthlyEmployeeEsi + monthlyPt + monthlyTds);
  const monthlyNet = round2(monthlyGross - totalDeductions);

  return {
    monthly: {
      basic: recalcMonthlyBasic,
      hra: recalcMonthlyHra,
      specialAllowance: Math.max(0, monthlySpecial),
      gross: monthlyGross,
      employeePf: monthlyEmployeePf,
      employeeEsi: monthlyEmployeeEsi,
      professionalTax: monthlyPt,
      tds: monthlyTds,
      totalDeductions,
      netTakeHome: monthlyNet,
    },
    annual: {
      ctc: annualCtc,
      gross: annualGross,
      basic: annualBasic,
      hra: round2(recalcMonthlyHra * 12),
      specialAllowance: round2(Math.max(0, monthlySpecial) * 12),
      employerPf: annualEmployerPf,
      employerEsi: annualEmployerEsi,
      gratuityProvision: annualGratuity,
      bonusProvision: annualBonusProvision,
      netTakeHome: round2(monthlyNet * 12),
    },
  };
}

// ═══════════════════════════════════════════════════════════════
//  FORMULA REGISTRY — for programmatic access
// ═══════════════════════════════════════════════════════════════

export const FORMULA_REGISTRY = {
  tenure: { name: 'Tenure Calculator', fn: tenureMonths, category: 'general' },
  overtimeIndia: {
    name: 'Overtime (India Factories Act)',
    fn: calculateOvertimeIndia,
    category: 'overtime',
  },
  overtimeFLSA: { name: 'Overtime (US FLSA)', fn: calculateOvertimeFLSA, category: 'overtime' },
  epf: { name: 'EPF / Provident Fund', fn: calculateEPF, category: 'statutory' },
  esi: { name: 'ESI', fn: calculateESI, category: 'statutory' },
  gratuity: { name: 'Gratuity', fn: calculateGratuity, category: 'statutory' },
  lateDeduction: { name: 'Late Deduction', fn: calculateLateDeduction, category: 'deduction' },
  lwp: { name: 'Loss of Pay', fn: calculateLWP, category: 'deduction' },
  bonus: { name: 'Bonus (Payment of Bonus Act)', fn: calculateBonus, category: 'statutory' },
  ctcBreakdown: { name: 'CTC to Net Salary', fn: calculateCTCBreakdown, category: 'salary' },
} as const;

export type FormulaName = keyof typeof FORMULA_REGISTRY;
