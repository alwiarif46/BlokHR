import type { DatabaseEngine } from '../db/engine';

export interface AttendanceRecord {
  [key: string]: unknown;
  id: number;
  email: string;
  name: string;
  date: string;
  status: string;
  status_source: string;
  first_in: string | null;
  last_out: string | null;
  last_break_start: string | null;
  last_back_time: string | null;
  total_worked_minutes: number;
  total_break_minutes: number;
  is_late: number;
  late_minutes: number;
  split_warning: number;
  group_id: string;
}

export interface ClockEvent {
  [key: string]: unknown;
  id: number;
  email: string;
  date: string;
  event_type: string;
  event_time: string;
  source: string;
}

export interface MonthlyLateCount {
  [key: string]: unknown;
  email: string;
  year_month: string;
  late_count: number;
}

export interface MemberShiftInfo {
  [key: string]: unknown;
  email: string;
  name: string;
  group_id: string | null;
  individual_shift_start: string | null;
  individual_shift_end: string | null;
  group_shift_start: string | null;
  group_shift_end: string | null;
  timezone: string;
}

/**
 * Clock repository — all attendance database operations.
 * Every method is a single, testable unit. No business logic here.
 */
export class ClockRepository {
  constructor(private readonly db: DatabaseEngine) {}

  /** Get or create today's attendance record for an employee. */
  async getOrCreateDaily(
    email: string,
    name: string,
    date: string,
    groupId: string,
  ): Promise<AttendanceRecord> {
    const existing = await this.db.get<AttendanceRecord>(
      'SELECT * FROM attendance_daily WHERE email = ? AND date = ?',
      [email, date],
    );
    if (existing) return existing;

    await this.db.run(
      `INSERT INTO attendance_daily (email, name, date, group_id)
       VALUES (?, ?, ?, ?)`,
      [email, name, date, groupId],
    );
    const created = await this.db.get<AttendanceRecord>(
      'SELECT * FROM attendance_daily WHERE email = ? AND date = ?',
      [email, date],
    );
    if (!created) throw new Error(`Failed to create attendance record for ${email} on ${date}`);
    return created;
  }

  /** Get attendance record for a specific employee and date. */
  async getDaily(email: string, date: string): Promise<AttendanceRecord | null> {
    return this.db.get<AttendanceRecord>(
      'SELECT * FROM attendance_daily WHERE email = ? AND date = ?',
      [email, date],
    );
  }

  /** Get all attendance records for a date. */
  async getAllForDate(date: string): Promise<AttendanceRecord[]> {
    return this.db.all<AttendanceRecord>('SELECT * FROM attendance_daily WHERE date = ?', [date]);
  }

  /** Update attendance daily record fields. */
  async updateDaily(
    email: string,
    date: string,
    fields: Partial<
      Pick<
        AttendanceRecord,
        | 'status'
        | 'status_source'
        | 'first_in'
        | 'last_out'
        | 'last_break_start'
        | 'last_back_time'
        | 'total_worked_minutes'
        | 'total_break_minutes'
        | 'is_late'
        | 'late_minutes'
        | 'split_warning'
      >
    >,
  ): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];

    for (const [key, val] of Object.entries(fields)) {
      sets.push(`${key} = ?`);
      vals.push(val);
    }
    sets.push("updated_at = datetime('now')");
    vals.push(email, date);

    await this.db.run(
      `UPDATE attendance_daily SET ${sets.join(', ')} WHERE email = ? AND date = ?`,
      vals,
    );
  }

  /** Insert a clock event into the timeline. */
  async insertClockEvent(
    email: string,
    date: string,
    eventType: string,
    eventTime: string,
    source: string,
  ): Promise<void> {
    await this.db.run(
      'INSERT INTO clock_events (email, date, event_type, event_time, source) VALUES (?, ?, ?, ?, ?)',
      [email, date, eventType, eventTime, source],
    );
  }

  /** Get all clock events for an employee on a date, ordered by time. */
  async getClockEvents(email: string, date: string): Promise<ClockEvent[]> {
    return this.db.all<ClockEvent>(
      'SELECT * FROM clock_events WHERE email = ? AND date = ? ORDER BY event_time ASC',
      [email, date],
    );
  }

  /** Get or create monthly late count. */
  async getMonthlyLateCount(email: string, yearMonth: string): Promise<number> {
    const row = await this.db.get<MonthlyLateCount>(
      'SELECT late_count FROM monthly_late_counts WHERE email = ? AND year_month = ?',
      [email, yearMonth],
    );
    return row ? row.late_count : 0;
  }

  /** Increment monthly late count. Returns new count. */
  async incrementMonthlyLateCount(email: string, yearMonth: string): Promise<number> {
    await this.db.run(
      `INSERT INTO monthly_late_counts (email, year_month, late_count) VALUES (?, ?, 1)
       ON CONFLICT(email, year_month) DO UPDATE SET late_count = late_count + 1`,
      [email, yearMonth],
    );
    return this.getMonthlyLateCount(email, yearMonth);
  }

  /** Get member shift info (individual override + group fallback). */
  async getMemberShiftInfo(email: string): Promise<MemberShiftInfo | null> {
    return this.db.get<MemberShiftInfo>(
      `SELECT m.email, m.name, m.group_id,
              m.individual_shift_start, m.individual_shift_end,
              g.shift_start as group_shift_start, g.shift_end as group_shift_end,
              COALESCE(m.timezone, g.timezone, 'Asia/Kolkata') as timezone
       FROM members m
       LEFT JOIN groups g ON m.group_id = g.id
       WHERE m.email = ? AND m.active = 1`,
      [email],
    );
  }

  /** Get the last clock event for an employee on a date. */
  async getLastClockEvent(email: string, date: string): Promise<ClockEvent | null> {
    return this.db.get<ClockEvent>(
      'SELECT * FROM clock_events WHERE email = ? AND date = ? ORDER BY event_time DESC LIMIT 1',
      [email, date],
    );
  }

  /** Get late rules configuration. */
  async getLateRules(): Promise<{
    grace_minutes: number;
    lates_to_deduction: number;
    deduction_days: number;
    tier1_count: number;
    tier2_count: number;
    tier3_count: number;
  }> {
    const row = await this.db.get<{
      grace_minutes: number;
      lates_to_deduction: number;
      deduction_days: number;
      tier1_count: number;
      tier2_count: number;
      tier3_count: number;
    }>('SELECT * FROM late_rules WHERE id = 1');
    return (
      row ?? {
        grace_minutes: 15,
        lates_to_deduction: 4,
        deduction_days: 0.5,
        tier1_count: 2,
        tier2_count: 3,
        tier3_count: 4,
      }
    );
  }

  /** Get logical day change time from system settings. */
  async getDayChangeTime(): Promise<string> {
    const row = await this.db.get<{ logical_day_change_time: string }>(
      'SELECT logical_day_change_time FROM system_settings WHERE id = 1',
    );
    return row?.logical_day_change_time ?? '06:00';
  }

  /** Get all active members with their shift info for bulk operations (auto-cutoff, absence marking). */
  async getAllActiveMembersWithShifts(): Promise<MemberShiftInfo[]> {
    return this.db.all<MemberShiftInfo>(
      `SELECT m.email, m.name, m.group_id,
              m.individual_shift_start, m.individual_shift_end,
              g.shift_start as group_shift_start, g.shift_end as group_shift_end,
              COALESCE(m.timezone, g.timezone, 'Asia/Kolkata') as timezone
       FROM members m
       LEFT JOIN groups g ON m.group_id = g.id
       WHERE m.active = 1`,
    );
  }
}
