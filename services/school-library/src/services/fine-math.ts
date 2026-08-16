import { calendarDaysBetween } from './date-only';

export interface FineMathInput {
  dueOn: string;
  asOf: string;
  graceDays: number;
  finePaisePerDay: number;
  fineCapPaise: number;
}

export interface FineMathResult {
  daysOverdue: number;
  amountPaise: number;
}

/**
 * Overdue days = max(0, calendar days from due_on to as_of − grace_days).
 * Amount = min(days * fine_paise_per_day, fine_cap_paise). Integer paise only.
 */
export function computeFine(input: FineMathInput): FineMathResult {
  const rawDays = calendarDaysBetween(input.dueOn, input.asOf);
  const daysOverdue = Math.max(0, rawDays - Math.max(0, input.graceDays));
  if (daysOverdue === 0) {
    return { daysOverdue: 0, amountPaise: 0 };
  }
  const uncapped = daysOverdue * input.finePaisePerDay;
  const amountPaise = Math.min(uncapped, input.fineCapPaise);
  return { daysOverdue, amountPaise };
}
