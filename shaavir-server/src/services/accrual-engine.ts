/**
 * Leave Accrual Engine — pure functions for leave balance computation.
 * 9 accrual methods + balance + carry-forward.
 */

export interface AccrualContext {
  tenureMonths: number;
  monthsInYear: number;
  hoursWorked: number;
  daysWorked: number;
  payPeriodsElapsed: number;
  joinDayOfYear: number;
  totalDaysInYear: number;
  inProbation: boolean;
  probationMode: string;
  probationAccrual: number;
}

export interface AccrualResult {
  accruedDays: number;
  monthlyRate: number;
  tier?: string;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeAccrual(
  method: string,
  config: Record<string, unknown>,
  ctx: AccrualContext,
): AccrualResult {
  if (ctx.inProbation) {
    if (ctx.probationMode === 'no_accrual') {
      return { accruedDays: 0, monthlyRate: 0, tier: 'probation:no_accrual' };
    }
    if (ctx.probationMode === 'reduced_rate') {
      const days = ctx.probationAccrual * ctx.monthsInYear;
      return {
        accruedDays: round2(days),
        monthlyRate: ctx.probationAccrual,
        tier: 'probation:reduced',
      };
    }
  }

  switch (method) {
    case 'flat': {
      const rate = (config.accrualPerMonth as number) ?? 0;
      return { accruedDays: round2(rate * ctx.monthsInYear), monthlyRate: rate };
    }
    case 'tenure_bucket': {
      const buckets = (config.buckets ?? []) as Array<{
        minMonths: number;
        maxMonths: number | null;
        accrualPerMonth: number;
      }>;
      let rate = 0;
      let tier = 'default';
      for (const b of buckets) {
        if (
          ctx.tenureMonths >= b.minMonths &&
          (b.maxMonths === null || ctx.tenureMonths < b.maxMonths)
        ) {
          rate = b.accrualPerMonth;
          tier = b.maxMonths === null ? `${b.minMonths}+mo` : `${b.minMonths}-${b.maxMonths}mo`;
          break;
        }
      }
      return { accruedDays: round2(rate * ctx.monthsInYear), monthlyRate: rate, tier };
    }
    case 'annual_lump': {
      const annualDays = (config.annualDays as number) ?? 0;
      return {
        accruedDays: annualDays,
        monthlyRate: round2(annualDays / 12),
        tier: `lump:${(config.grantDate as string) ?? 'jan1'}`,
      };
    }
    case 'per_hours_worked': {
      const ratio = (config.hoursPerLeaveHour as number) ?? 30;
      if (ratio <= 0) return { accruedDays: 0, monthlyRate: 0 };
      const leaveDays = ctx.hoursWorked / ratio / 8;
      return {
        accruedDays: round2(leaveDays),
        monthlyRate: round2(leaveDays / Math.max(1, ctx.monthsInYear)),
      };
    }
    case 'per_days_worked': {
      const ratio = (config.daysPerLeaveDay as number) ?? 20;
      if (ratio <= 0) return { accruedDays: 0, monthlyRate: 0 };
      const days = ctx.daysWorked / ratio;
      return {
        accruedDays: round2(days),
        monthlyRate: round2(days / Math.max(1, ctx.monthsInYear)),
      };
    }
    case 'tenure_linear': {
      const base = (config.basePerMonth as number) ?? 0;
      const increment = (config.incrementPerYear as number) ?? 0;
      const max = (config.maxPerMonth as number) ?? Infinity;
      const years = Math.floor(ctx.tenureMonths / 12);
      const rate = Math.min(base + increment * years, max);
      return {
        accruedDays: round2(rate * ctx.monthsInYear),
        monthlyRate: round2(rate),
        tier: `${years}yr`,
      };
    }
    case 'per_pay_period': {
      const dpp = (config.daysPerPeriod as number) ?? 0;
      const days = dpp * ctx.payPeriodsElapsed;
      return {
        accruedDays: round2(days),
        monthlyRate: round2(days / Math.max(1, ctx.monthsInYear)),
        tier: (config.periodType as string) ?? 'monthly',
      };
    }
    case 'prorata': {
      const annualDays = (config.annualDays as number) ?? 0;
      const remaining = ctx.totalDaysInYear - ctx.joinDayOfYear + 1;
      const ratio = Math.max(0, Math.min(1, remaining / ctx.totalDaysInYear));
      return {
        accruedDays: round2(annualDays * ratio),
        monthlyRate: round2(annualDays / 12),
        tier: `prorata:${Math.round(ratio * 100)}%`,
      };
    }
    case 'unlimited':
      return { accruedDays: Infinity, monthlyRate: 0, tier: 'unlimited' };
    default:
      return { accruedDays: 0, monthlyRate: 0, tier: `unknown:${method}` };
  }
}

export function computeBalance(params: {
  accrued: number;
  used: number;
  carryForward: number;
  maxAccumulation: number;
  allowNegative: boolean;
  negativeAction: string;
}): { balance: number; effectiveBalance: number; lwpDays: number; capped: boolean } {
  const total = params.accrued + params.carryForward;
  const capped = total > params.maxAccumulation;
  const cappedTotal = Math.min(total, params.maxAccumulation);
  const rawBalance = cappedTotal - params.used;

  let effectiveBalance = rawBalance;
  let lwpDays = 0;

  if (rawBalance < 0) {
    if (!params.allowNegative || params.negativeAction === 'block') {
      effectiveBalance = 0;
      lwpDays = Math.abs(rawBalance);
    } else if (params.negativeAction === 'lwp') {
      effectiveBalance = 0;
      lwpDays = Math.abs(rawBalance);
    } else if (params.negativeAction === 'deduct_salary') {
      effectiveBalance = rawBalance;
    } else if (params.negativeAction === 'adjust_next_month') {
      effectiveBalance = rawBalance;
    }
  }

  return {
    balance: round2(rawBalance),
    effectiveBalance: round2(effectiveBalance),
    lwpDays: round2(lwpDays),
    capped,
  };
}

export function computeCarryForward(remainingBalance: number, maxCarryForward: number): number {
  if (maxCarryForward <= 0) return 0;
  return round2(Math.min(Math.max(0, remainingBalance), maxCarryForward));
}
