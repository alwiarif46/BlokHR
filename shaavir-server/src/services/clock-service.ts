import type { Logger } from 'pino';
import type { ClockRepository, MemberShiftInfo } from '../repositories/clock-repository';
import type { EventBus } from '../events';

export interface ClockActionResult {
  success: boolean;
  blocked?: boolean;
  duplicate?: boolean;
  error?: string;
  isLate?: boolean;
  lateMinutes?: number;
  monthlyLateCount?: number;
  status?: string;
}

interface ShiftTimes {
  start: string; // HH:MM
  end: string; // HH:MM
}

/**
 * Resolves the effective shift for a member.
 * Priority: individual > group > null (reject if no shift).
 */
function resolveShift(member: MemberShiftInfo): ShiftTimes | null {
  if (member.individual_shift_start && member.individual_shift_end) {
    return { start: member.individual_shift_start, end: member.individual_shift_end };
  }
  if (member.group_shift_start && member.group_shift_end) {
    return { start: member.group_shift_start, end: member.group_shift_end };
  }
  return null;
}

/** Parse HH:MM to minutes since midnight. */
function parseTimeToMinutes(hhmm: string): number {
  const parts = hhmm.split(':').map(Number);
  return parts[0] * 60 + (parts[1] || 0);
}

/** Get current IST minutes since midnight for a given timezone. */
function getNowMinutesInTz(timezone: string): number {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
  });
  return parseTimeToMinutes(timeStr);
}

/** Check if current time is within shift window (start - 1hr to end). */
function isInShiftWindow(shift: ShiftTimes, timezone: string): boolean {
  const nowMin = getNowMinutesInTz(timezone);
  const startMin = parseTimeToMinutes(shift.start);
  const endMin = parseTimeToMinutes(shift.end);
  const earlyMin = startMin - 60;

  if (endMin < startMin) {
    // Overnight shift
    return nowMin >= earlyMin || nowMin <= endMin;
  }
  if (earlyMin < 0) {
    // Early buffer wraps past midnight
    return nowMin >= earlyMin + 1440 || nowMin <= endMin;
  }
  return nowMin >= earlyMin && nowMin <= endMin;
}

/** Get logical date string for a timezone and day-change-time. */
function getLogicalDate(timezone: string, dayChangeTime: string): string {
  const now = new Date();
  const dctMin = parseTimeToMinutes(dayChangeTime);
  const tzStr = now.toLocaleString('en-CA', { timeZone: timezone, hour12: false });
  // en-CA gives YYYY-MM-DD, HH:MM:SS format
  const parts = tzStr.split(',');
  const datePart = parts[0].trim();
  const timePart = parts[1].trim();
  const nowMin = parseTimeToMinutes(timePart);

  if (nowMin < dctMin) {
    // Before day-change: still "yesterday"
    const d = new Date(datePart + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
  }
  return datePart;
}

/** Get year-month string for a date. */
function getYearMonth(dateStr: string): string {
  return dateStr.substring(0, 7); // YYYY-MM
}

/**
 * Clock service — all clock-in/out business logic.
 * Validates shift windows, detects lateness, prevents duplicates,
 * updates attendance records and clock event timelines.
 */
export class ClockService {
  constructor(
    private readonly repo: ClockRepository,
    private readonly logger: Logger,
    private readonly eventBus?: EventBus,
  ) {}

  /**
   * Execute a clock action.
   * @param action - 'in' | 'out' | 'break' | 'back'
   * @param email - employee email
   * @param name - employee name
   * @param source - 'manual' | 'admin' | 'geo' | 'face' | 'bot'
   */
  async clock(
    action: string,
    email: string,
    name: string,
    source: string = 'manual',
  ): Promise<ClockActionResult> {
    const validActions = new Set(['in', 'out', 'break', 'back']);
    if (!validActions.has(action)) {
      return { success: false, blocked: true, error: `Invalid action: ${action}` };
    }

    // Resolve member and shift
    const member = await this.repo.getMemberShiftInfo(email);
    if (!member) {
      return { success: false, blocked: true, error: 'Employee not found or inactive' };
    }

    const shift = resolveShift(member);
    if (!shift) {
      return { success: false, blocked: true, error: 'No shift assigned. Contact admin.' };
    }

    const tz = member.timezone || 'Asia/Kolkata';
    const dayChangeTime = await this.repo.getDayChangeTime();
    const logicalDate = getLogicalDate(tz, dayChangeTime);
    const now = new Date().toISOString();

    // Get current attendance record
    const daily = await this.repo.getOrCreateDaily(email, name, logicalDate, member.group_id || '');
    const currentStatus = (daily.status || 'off').toLowerCase();

    // ── Action validation ──

    if (action === 'in') {
      // Check shift window (unless admin/bot override)
      if (source === 'manual' && !isInShiftWindow(shift, tz)) {
        return { success: false, blocked: true, error: 'Outside shift window' };
      }
      // Duplicate: already clocked in
      if (currentStatus === 'in') {
        return { success: false, duplicate: true, error: 'Already clocked in' };
      }
    }

    if (action === 'break') {
      if (currentStatus !== 'in') {
        return { success: false, blocked: true, error: 'Must be clocked in to take a break' };
      }
    }

    if (action === 'back') {
      if (currentStatus !== 'break') {
        return { success: false, blocked: true, error: 'Must be on break to clock back in' };
      }
    }

    if (action === 'out') {
      if (currentStatus !== 'in' && currentStatus !== 'break') {
        return {
          success: false,
          blocked: true,
          error: 'Must be clocked in or on break to clock out',
        };
      }
    }

    // ── Execute action ──
    await this.repo.insertClockEvent(email, logicalDate, action, now, source);

    const result: ClockActionResult = { success: true, status: action === 'back' ? 'in' : action };

    if (action === 'in') {
      const isFirstIn = !daily.first_in;
      const updates: Record<string, unknown> = {
        status: 'in',
        status_source: source,
        last_back_time: now,
      };
      if (isFirstIn) {
        updates.first_in = now;
      }

      // Late detection (only on first clock-in of the day)
      if (isFirstIn) {
        const lateResult = await this.checkLate(email, shift, tz, logicalDate, now);
        if (lateResult.isLate) {
          updates.is_late = 1;
          updates.late_minutes = lateResult.lateMinutes;
          result.isLate = true;
          result.lateMinutes = lateResult.lateMinutes;
          result.monthlyLateCount = lateResult.monthlyLateCount;
        }
      }

      await this.repo.updateDaily(email, logicalDate, updates);
    }

    if (action === 'break') {
      // Calculate worked time since last in/back
      const workedSince = daily.last_back_time || daily.first_in || now;
      const additionalWorkedMin =
        (new Date(now).getTime() - new Date(workedSince).getTime()) / 60000;

      await this.repo.updateDaily(email, logicalDate, {
        status: 'break',
        status_source: source,
        last_break_start: now,
        total_worked_minutes: daily.total_worked_minutes + Math.max(0, additionalWorkedMin),
      });
    }

    if (action === 'back') {
      // Calculate break time since last break start
      const breakSince = daily.last_break_start || now;
      const additionalBreakMin = (new Date(now).getTime() - new Date(breakSince).getTime()) / 60000;

      await this.repo.updateDaily(email, logicalDate, {
        status: 'in',
        status_source: source,
        last_back_time: now,
        total_break_minutes: daily.total_break_minutes + Math.max(0, additionalBreakMin),
      });
    }

    if (action === 'out') {
      // Calculate final worked/break time
      const lastActiveTime = daily.last_back_time || daily.first_in || now;
      let additionalWorkedMin = 0;
      let additionalBreakMin = 0;

      if (currentStatus === 'in') {
        additionalWorkedMin =
          (new Date(now).getTime() - new Date(lastActiveTime).getTime()) / 60000;
      } else if (currentStatus === 'break') {
        const breakSince = daily.last_break_start || now;
        additionalBreakMin = (new Date(now).getTime() - new Date(breakSince).getTime()) / 60000;
      }

      await this.repo.updateDaily(email, logicalDate, {
        status: 'out',
        status_source: source,
        last_out: now,
        total_worked_minutes: daily.total_worked_minutes + Math.max(0, additionalWorkedMin),
        total_break_minutes: daily.total_break_minutes + Math.max(0, additionalBreakMin),
      });
    }

    this.logger.info(
      { action, email, logicalDate, source, isLate: result.isLate },
      'Clock action executed',
    );

    this.eventBus?.emit(`clock.${action}` as 'clock.in' | 'clock.out' | 'clock.break' | 'clock.back', {
      email, name, date: logicalDate, source,
      isLate: result.isLate, lateMinutes: result.lateMinutes,
    });

    return result;
  }

  /** Check if a clock-in is late and update monthly counter. */
  private async checkLate(
    email: string,
    shift: ShiftTimes,
    timezone: string,
    logicalDate: string,
    clockInTime: string,
  ): Promise<{ isLate: boolean; lateMinutes: number; monthlyLateCount: number }> {
    const lateRules = await this.repo.getLateRules();
    const shiftStartMin = parseTimeToMinutes(shift.start);

    // Get clock-in time in the member's timezone
    const clockInDate = new Date(clockInTime);
    const clockInStr = clockInDate.toLocaleTimeString('en-US', {
      timeZone: timezone,
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
    });
    const clockInMin = parseTimeToMinutes(clockInStr);

    const lateMinutes = clockInMin - shiftStartMin - lateRules.grace_minutes;

    if (lateMinutes > 0) {
      const yearMonth = getYearMonth(logicalDate);
      const monthlyLateCount = await this.repo.incrementMonthlyLateCount(email, yearMonth);
      return { isLate: true, lateMinutes: clockInMin - shiftStartMin, monthlyLateCount };
    }

    return { isLate: false, lateMinutes: 0, monthlyLateCount: 0 };
  }

  /** Get board data: all attendance records for a date, enriched with timeline. */
  async getBoard(date: string): Promise<{
    people: Array<Record<string, unknown>>;
    dayChangeTime: string;
  }> {
    const records = await this.repo.getAllForDate(date);
    const dayChangeTime = await this.repo.getDayChangeTime();

    const people = await Promise.all(
      records.map(async (r) => {
        const events = await this.repo.getClockEvents(r.email, date);
        const yearMonth = getYearMonth(date);
        const monthlyLateCount = await this.repo.getMonthlyLateCount(r.email, yearMonth);

        return {
          email: r.email,
          name: r.name,
          status: r.status,
          statusSource: r.status_source,
          firstIn: r.first_in,
          lastOut: r.last_out,
          lastBreakStart: r.last_break_start,
          lastBackTime: r.last_back_time,
          totalWorked: r.total_worked_minutes / 60,
          totalBreak: r.total_break_minutes / 60,
          isLate: r.is_late === 1,
          lateMinutes: r.late_minutes,
          splitWarning: r.split_warning === 1,
          monthlyLateCount,
          group: r.group_id,
          timeline: events.map((e) => ({
            type:
              e.event_type === 'in'
                ? 'In'
                : e.event_type === 'out'
                  ? 'Out'
                  : e.event_type === 'break'
                    ? 'Break'
                    : 'Back',
            time: e.event_time,
          })),
        };
      }),
    );

    return { people, dayChangeTime };
  }
}
