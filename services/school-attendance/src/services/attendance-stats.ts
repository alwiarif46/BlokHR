import type { AttendanceRecord, AttendanceStatus, DayDerivation } from '../types';

export interface ComputeMonthOptions {
  tenantId: string;
  month: string;
  workingDayCount: number;
  records: AttendanceRecord[];
  dayDerivation: DayDerivation;
  halfDayMinMinutes: number;
}

export interface StudentMonthComputation {
  tenantId: string;
  studentId: string;
  month: string;
  workingDays: number;
  presentDays: number;
  absentDays: number;
  lateCount: number;
  pct: number;
}

/**
 * Day derivation rules (statutory calendar day from one or more marks):
 *
 * - any_absent: the day is absent if ANY mark that day is `absent`.
 * - majority: the day is absent when absent marks strictly outnumber non-absent
 *   marks (present|late|left_early). A tie counts as present.
 * - half_day_minutes: score presence minutes — each present/left_early mark
 *   contributes `halfDayMinMinutes / markCount` for that day; each late mark
 *   contributes max(0, that share − late_minutes); absent contributes 0.
 *   The day is present when total score ≥ halfDayMinMinutes / 2.
 */
export function deriveDayPresent(
  dayRecords: AttendanceRecord[],
  dayDerivation: DayDerivation,
  halfDayMinMinutes: number,
): boolean {
  if (dayRecords.length === 0) return false;

  switch (dayDerivation) {
    case 'any_absent':
      return !dayRecords.some((r) => r.status === 'absent');
    case 'majority': {
      let absent = 0;
      let nonAbsent = 0;
      for (const r of dayRecords) {
        if (r.status === 'absent') absent += 1;
        else nonAbsent += 1;
      }
      return absent <= nonAbsent;
    }
    case 'half_day_minutes': {
      const share = halfDayMinMinutes / dayRecords.length;
      let score = 0;
      for (const r of dayRecords) {
        switch (r.status) {
          case 'present':
          case 'left_early':
            score += share;
            break;
          case 'late':
            score += Math.max(0, share - (r.lateMinutes ?? 0));
            break;
          case 'absent':
            break;
          default: {
            const _exhaustive: never = r.status;
            void _exhaustive;
            break;
          }
        }
      }
      return score >= halfDayMinMinutes / 2;
    }
    default: {
      const _exhaustive: never = dayDerivation;
      void _exhaustive;
      return false;
    }
  }
}

function inMonth(date: string, month: string): boolean {
  return date.slice(0, 7) === month;
}

function isPresentLike(status: AttendanceStatus): boolean {
  return status === 'present' || status === 'late' || status === 'left_early';
}

/**
 * Pure monthly rollup: groups records by student/date, applies day derivation,
 * then fills unmarked working days as absent so present + absent = workingDays.
 */
export function computeMonth(options: ComputeMonthOptions): StudentMonthComputation[] {
  const {
    tenantId,
    month,
    workingDayCount,
    records,
    dayDerivation,
    halfDayMinMinutes,
  } = options;

  const workingDays = Math.max(0, Math.floor(workingDayCount));
  const byStudent = new Map<string, AttendanceRecord[]>();
  for (const r of records) {
    if (r.tenantId !== tenantId) continue;
    if (!inMonth(r.date, month)) continue;
    const list = byStudent.get(r.studentId) ?? [];
    list.push(r);
    byStudent.set(r.studentId, list);
  }

  const results: StudentMonthComputation[] = [];
  for (const [studentId, studentRecords] of byStudent) {
    const byDate = new Map<string, AttendanceRecord[]>();
    let lateCount = 0;
    for (const r of studentRecords) {
      if (r.status === 'late') lateCount += 1;
      const day = byDate.get(r.date) ?? [];
      day.push(r);
      byDate.set(r.date, day);
    }

    let presentDays = 0;
    for (const dayRecords of byDate.values()) {
      if (deriveDayPresent(dayRecords, dayDerivation, halfDayMinMinutes)) {
        presentDays += 1;
      }
    }
    presentDays = Math.min(presentDays, workingDays);
    const absentDays = Math.max(0, workingDays - presentDays);
    const pct = workingDays === 0 ? 0 : (presentDays / workingDays) * 100;

    results.push({
      tenantId,
      studentId,
      month,
      workingDays,
      presentDays,
      absentDays,
      lateCount,
      pct,
    });
  }

  results.sort((a, b) => a.studentId.localeCompare(b.studentId));
  return results;
}

export function computeEligibilityProjection(args: {
  presentDays: number;
  workingDays: number;
  remainingWorkingDays: number;
  threshold: number;
}): {
  pct: number;
  threshold: number;
  eligible: boolean;
  projected_pct_if_no_more_absences: number;
} {
  const workingDays = Math.max(0, args.workingDays);
  const presentDays = Math.max(0, args.presentDays);
  const remaining = Math.max(0, args.remainingWorkingDays);
  const pct = workingDays === 0 ? 0 : (presentDays / workingDays) * 100;
  const projectedPresent = Math.min(workingDays, presentDays + remaining);
  const projected =
    workingDays === 0 ? 0 : (projectedPresent / workingDays) * 100;
  return {
    pct,
    threshold: args.threshold,
    eligible: pct >= args.threshold,
    projected_pct_if_no_more_absences: projected,
  };
}

/** Count Mon–Fri dates inclusive between ISO dates (UTC). */
export function countWeekdaysInclusive(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00.000Z`);
  const end = Date.parse(`${to}T00:00:00.000Z`);
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return 0;
  let count = 0;
  for (let t = start; t <= end; t += 86_400_000) {
    const dow = new Date(t).getUTCDay();
    if (dow !== 0 && dow !== 6) count += 1;
  }
  return count;
}

/** Weekdays strictly after `after` through `to` inclusive (UTC). */
export function countWeekdaysAfter(after: string, to: string): number {
  const afterMs = Date.parse(`${after}T00:00:00.000Z`);
  if (Number.isNaN(afterMs)) return 0;
  const next = new Date(afterMs + 86_400_000).toISOString().slice(0, 10);
  if (next > to) return 0;
  return countWeekdaysInclusive(next, to);
}

export { isPresentLike };
