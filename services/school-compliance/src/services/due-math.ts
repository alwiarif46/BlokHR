import type { DueRule } from '../types';

function daysBetweenUtc(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.floor((b - a) / 86_400_000);
}

function dateOnYear(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

/** Resolve the due calendar date (window_end for windows) for `today`'s year context. */
export function resolveDueDate(rule: DueRule, today: Date): Date {
  const year = today.getUTCFullYear();
  if ('month' in rule && 'day' in rule) {
    return dateOnYear(year, rule.month, rule.day);
  }
  return dateOnYear(year, rule.window_end.m, rule.window_end.d);
}

export function daysUntilDue(rule: DueRule, today: Date): number {
  const due = resolveDueDate(rule, today);
  return daysBetweenUtc(today, due);
}

export function dueDateIso(rule: DueRule, today: Date): string {
  return resolveDueDate(rule, today).toISOString().slice(0, 10);
}

export function parseDueRule(raw: string): DueRule {
  return JSON.parse(raw) as DueRule;
}
