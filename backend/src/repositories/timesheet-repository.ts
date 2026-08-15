import type { DatabaseEngine } from '../db/engine';

export interface TimesheetRow {
  [key: string]: unknown;
  id: string;
  email: string;
  name: string;
  period_type: string;
  start_date: string;
  end_date: string;
  total_worked_minutes: number;
  total_break_minutes: number;
  total_present_days: number;
  total_absent_days: number;
  total_leave_days: number;
  total_holiday_days: number;
  total_late_days: number;
  total_ot_minutes: number;
  total_ot_pay: number;
  total_billable_hours: number;
  total_non_billable_hours: number;
  status: string;
  submitted_at: string | null;
  approved_by: string;
  approved_at: string | null;
  rejected_by: string;
  rejected_at: string | null;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface TimesheetEntryRow {
  [key: string]: unknown;
  id: number;
  timesheet_id: string;
  date: string;
  day_type: string;
  attendance_status: string;
  worked_minutes: number;
  break_minutes: number;
  is_late: number;
  late_minutes: number;
  ot_minutes: number;
  ot_pay: number;
  leave_type: string;
  leave_days: number;
  billable_hours: number;
  non_billable_hours: number;
}

/** Raw attendance row for aggregation. */
export interface AttendanceDayRow {
  [key: string]: unknown;
  date: string;
  status: string;
  total_worked_minutes: number;
  total_break_minutes: number;
  is_late: number;
  late_minutes: number;
}

/** Raw leave row for aggregation. */
export interface LeaveAggRow {
  [key: string]: unknown;
  start_date: string;
  end_date: string;
  leave_type: string;
  kind: string;
  days_requested: number;
}

/** Raw OT row for aggregation. */
export interface OtAggRow {
  [key: string]: unknown;
  date: string;
  ot_minutes: number;
  ot_pay: number;
  ot_type: string;
}

/** Raw time entry row for aggregation. */
export interface TimeEntryAggRow {
  [key: string]: unknown;
  date: string;
  hours: number;
  billable: number;
}

/** Raw holiday row for aggregation. */
export interface HolidayAggRow {
  [key: string]: unknown;
  date: string;
  name: string;
  type: string;
}

export class TimesheetRepository {
  constructor(private readonly db: DatabaseEngine) {}

  // ── CRUD ──

  async create(data: {
    id: string;
    email: string;
    name: string;
    periodType: string;
    startDate: string;
    endDate: string;
    totalWorkedMinutes: number;
    totalBreakMinutes: number;
    totalPresentDays: number;
    totalAbsentDays: number;
    totalLeaveDays: number;
    totalHolidayDays: number;
    totalLateDays: number;
    totalOtMinutes: number;
    totalOtPay: number;
    totalBillableHours: number;
    totalNonBillableHours: number;
  }): Promise<TimesheetRow> {
    await this.db.run(
      `INSERT INTO timesheets (
        id, email, name, period_type, start_date, end_date,
        total_worked_minutes, total_break_minutes, total_present_days,
        total_absent_days, total_leave_days, total_holiday_days,
        total_late_days, total_ot_minutes, total_ot_pay,
        total_billable_hours, total_non_billable_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        data.id,
        data.email,
        data.name,
        data.periodType,
        data.startDate,
        data.endDate,
        data.totalWorkedMinutes,
        data.totalBreakMinutes,
        data.totalPresentDays,
        data.totalAbsentDays,
        data.totalLeaveDays,
        data.totalHolidayDays,
        data.totalLateDays,
        data.totalOtMinutes,
        data.totalOtPay,
        data.totalBillableHours,
        data.totalNonBillableHours,
      ],
    );
    const row = await this.getById(data.id);
    if (!row) throw new Error('Failed to create timesheet');
    return row;
  }

  async getById(id: string): Promise<TimesheetRow | null> {
    return this.db.get<TimesheetRow>('SELECT * FROM timesheets WHERE id = ?', [id]);
  }

  async getByEmailPeriod(
    email: string,
    periodType: string,
    startDate: string,
  ): Promise<TimesheetRow | null> {
    return this.db.get<TimesheetRow>(
      'SELECT * FROM timesheets WHERE email = ? AND period_type = ? AND start_date = ?',
      [email, periodType, startDate],
    );
  }

  async list(filters: {
    email?: string;
    periodType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TimesheetRow[]> {
    const conditions: string[] = [];
    const params: unknown[] = [];
    if (filters.email) {
      conditions.push('email = ?');
      params.push(filters.email);
    }
    if (filters.periodType) {
      conditions.push('period_type = ?');
      params.push(filters.periodType);
    }
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    if (filters.startDate) {
      conditions.push('start_date >= ?');
      params.push(filters.startDate);
    }
    if (filters.endDate) {
      conditions.push('end_date <= ?');
      params.push(filters.endDate);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    return this.db.all<TimesheetRow>(
      `SELECT * FROM timesheets ${where} ORDER BY start_date DESC, email`,
      params,
    );
  }

  async updateStatus(
    id: string,
    status: string,
    extra: {
      submittedAt?: string;
      approvedBy?: string;
      approvedAt?: string;
      rejectedBy?: string;
      rejectedAt?: string;
      rejectionReason?: string;
    } = {},
  ): Promise<void> {
    const sets: string[] = ['status = ?', "updated_at = datetime('now')"];
    const vals: unknown[] = [status];
    if (extra.submittedAt !== undefined) {
      sets.push('submitted_at = ?');
      vals.push(extra.submittedAt);
    }
    if (extra.approvedBy !== undefined) {
      sets.push('approved_by = ?');
      vals.push(extra.approvedBy);
    }
    if (extra.approvedAt !== undefined) {
      sets.push('approved_at = ?');
      vals.push(extra.approvedAt);
    }
    if (extra.rejectedBy !== undefined) {
      sets.push('rejected_by = ?');
      vals.push(extra.rejectedBy);
    }
    if (extra.rejectedAt !== undefined) {
      sets.push('rejected_at = ?');
      vals.push(extra.rejectedAt);
    }
    if (extra.rejectionReason !== undefined) {
      sets.push('rejection_reason = ?');
      vals.push(extra.rejectionReason);
    }
    vals.push(id);
    await this.db.run(`UPDATE timesheets SET ${sets.join(', ')} WHERE id = ?`, vals);
  }

  async deleteTimesheet(id: string): Promise<void> {
    // CASCADE deletes entries automatically
    await this.db.run('DELETE FROM timesheets WHERE id = ?', [id]);
  }

  /** Replace all totals on a timesheet (used during regenerate). */
  async updateTotals(
    id: string,
    totals: {
      totalWorkedMinutes: number;
      totalBreakMinutes: number;
      totalPresentDays: number;
      totalAbsentDays: number;
      totalLeaveDays: number;
      totalHolidayDays: number;
      totalLateDays: number;
      totalOtMinutes: number;
      totalOtPay: number;
      totalBillableHours: number;
      totalNonBillableHours: number;
    },
  ): Promise<void> {
    await this.db.run(
      `UPDATE timesheets SET
        total_worked_minutes = ?, total_break_minutes = ?, total_present_days = ?,
        total_absent_days = ?, total_leave_days = ?, total_holiday_days = ?,
        total_late_days = ?, total_ot_minutes = ?, total_ot_pay = ?,
        total_billable_hours = ?, total_non_billable_hours = ?,
        updated_at = datetime('now')
      WHERE id = ?`,
      [
        totals.totalWorkedMinutes,
        totals.totalBreakMinutes,
        totals.totalPresentDays,
        totals.totalAbsentDays,
        totals.totalLeaveDays,
        totals.totalHolidayDays,
        totals.totalLateDays,
        totals.totalOtMinutes,
        totals.totalOtPay,
        totals.totalBillableHours,
        totals.totalNonBillableHours,
        id,
      ],
    );
  }

  // ── Timesheet Entries ──

  async insertEntries(
    entries: Array<{
      timesheetId: string;
      date: string;
      dayType: string;
      attendanceStatus: string;
      workedMinutes: number;
      breakMinutes: number;
      isLate: number;
      lateMinutes: number;
      otMinutes: number;
      otPay: number;
      leaveType: string;
      leaveDays: number;
      billableHours: number;
      nonBillableHours: number;
    }>,
  ): Promise<void> {
    if (entries.length === 0) return;
    for (const e of entries) {
      await this.db.run(
        `INSERT INTO timesheet_entries (
          timesheet_id, date, day_type, attendance_status,
          worked_minutes, break_minutes, is_late, late_minutes,
          ot_minutes, ot_pay, leave_type, leave_days,
          billable_hours, non_billable_hours
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          e.timesheetId,
          e.date,
          e.dayType,
          e.attendanceStatus,
          e.workedMinutes,
          e.breakMinutes,
          e.isLate,
          e.lateMinutes,
          e.otMinutes,
          e.otPay,
          e.leaveType,
          e.leaveDays,
          e.billableHours,
          e.nonBillableHours,
        ],
      );
    }
  }

  async getEntries(timesheetId: string): Promise<TimesheetEntryRow[]> {
    return this.db.all<TimesheetEntryRow>(
      'SELECT * FROM timesheet_entries WHERE timesheet_id = ? ORDER BY date',
      [timesheetId],
    );
  }

  async deleteEntries(timesheetId: string): Promise<void> {
    await this.db.run('DELETE FROM timesheet_entries WHERE timesheet_id = ?', [timesheetId]);
  }

  // ── Aggregation: pull raw data for timesheet generation ──

  async getAttendanceForRange(
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<AttendanceDayRow[]> {
    return this.db.all<AttendanceDayRow>(
      `SELECT date, status, total_worked_minutes, total_break_minutes, is_late, late_minutes
       FROM attendance_daily
       WHERE email = ? AND date >= ? AND date <= ?
       ORDER BY date`,
      [email, startDate, endDate],
    );
  }

  async getApprovedLeavesForRange(
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<LeaveAggRow[]> {
    return this.db.all<LeaveAggRow>(
      `SELECT start_date, end_date, leave_type, kind, days_requested
       FROM leave_requests
       WHERE person_email = ? AND status = 'Approved'
         AND start_date <= ? AND end_date >= ?
       ORDER BY start_date`,
      [email, endDate, startDate],
    );
  }

  async getApprovedOtForRange(
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<OtAggRow[]> {
    return this.db.all<OtAggRow>(
      `SELECT date, ot_minutes, ot_pay, ot_type
       FROM overtime_records
       WHERE email = ? AND status = 'approved' AND date >= ? AND date <= ?
       ORDER BY date`,
      [email, startDate, endDate],
    );
  }

  async getTimeEntriesForRange(
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<TimeEntryAggRow[]> {
    return this.db.all<TimeEntryAggRow>(
      `SELECT date, hours, billable
       FROM time_entries
       WHERE email = ? AND date >= ? AND date <= ?
       ORDER BY date`,
      [email, startDate, endDate],
    );
  }

  async getMandatoryHolidaysForRange(
    startDate: string,
    endDate: string,
  ): Promise<HolidayAggRow[]> {
    return this.db.all<HolidayAggRow>(
      `SELECT date, name, type FROM holidays
       WHERE type = 'mandatory' AND active = 1 AND date >= ? AND date <= ?
       ORDER BY date`,
      [startDate, endDate],
    );
  }

  /** Get employee optional/restricted holidays they've selected for the range. */
  async getSelectedHolidaysForRange(
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<HolidayAggRow[]> {
    return this.db.all<HolidayAggRow>(
      `SELECT h.date, h.name, h.type FROM holidays h
       INNER JOIN employee_holiday_selections ehs ON ehs.holiday_id = h.id
       WHERE ehs.email = ? AND h.active = 1 AND h.date >= ? AND h.date <= ?
       ORDER BY h.date`,
      [email, startDate, endDate],
    );
  }

  /** Resolve employee name from members table. */
  async getMemberName(email: string): Promise<string> {
    const row = await this.db.get<{ name: string; [key: string]: unknown }>(
      'SELECT name FROM members WHERE email = ?',
      [email],
    );
    return row?.name ?? '';
  }
}
