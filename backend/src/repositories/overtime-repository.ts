import type { DatabaseEngine } from '../db/engine';

export interface OvertimeRow {
  [key: string]: unknown;
  id: number;
  email: string;
  date: string;
  shift_start: string;
  shift_end: string;
  actual_worked_minutes: number;
  standard_minutes: number;
  ot_minutes: number;
  ot_type: string;
  hourly_rate: number;
  multiplier: number;
  ot_pay: number;
  source: string;
  status: string;
  approved_by: string;
  rejection_reason: string;
}

export interface OtPolicyConfig {
  otEnabled: boolean;
  dailyThresholdMinutes: number;
  weeklyThresholdMinutes: number;
  multiplier: number;
  holidayMultiplier: number;
  requiresApproval: boolean;
  maxDailyMinutes: number;
  maxQuarterlyHours: number;
}

export class OvertimeRepository {
  constructor(private readonly db: DatabaseEngine) {}

  async getPolicy(): Promise<OtPolicyConfig> {
    const row = await this.db.get<{ [key: string]: unknown }>(
      'SELECT * FROM system_settings WHERE id = 1',
    );
    return {
      otEnabled: (row?.ot_enabled as number) === 1,
      dailyThresholdMinutes: (row?.ot_daily_threshold_minutes as number) ?? 540,
      weeklyThresholdMinutes: (row?.ot_weekly_threshold_minutes as number) ?? 2880,
      multiplier: (row?.ot_multiplier as number) ?? 2.0,
      holidayMultiplier: (row?.ot_holiday_multiplier as number) ?? 3.0,
      requiresApproval: (row?.ot_requires_approval as number) === 1,
      maxDailyMinutes: (row?.ot_max_daily_minutes as number) ?? 240,
      maxQuarterlyHours: (row?.ot_max_quarterly_hours as number) ?? 125,
    };
  }

  async getByEmail(email: string, startDate?: string, endDate?: string): Promise<OvertimeRow[]> {
    const conditions = ['email = ?'];
    const params: unknown[] = [email];
    if (startDate) {
      conditions.push('date >= ?');
      params.push(startDate);
    }
    if (endDate) {
      conditions.push('date <= ?');
      params.push(endDate);
    }
    return this.db.all<OvertimeRow>(
      `SELECT * FROM overtime_records WHERE ${conditions.join(' AND ')} ORDER BY date DESC`,
      params,
    );
  }

  async getByDate(date: string): Promise<OvertimeRow[]> {
    return this.db.all<OvertimeRow>(
      'SELECT * FROM overtime_records WHERE date = ? ORDER BY email',
      [date],
    );
  }

  async getPending(): Promise<OvertimeRow[]> {
    return this.db.all<OvertimeRow>(
      "SELECT * FROM overtime_records WHERE status = 'pending' ORDER BY date DESC",
    );
  }

  async getById(id: number): Promise<OvertimeRow | null> {
    return this.db.get<OvertimeRow>('SELECT * FROM overtime_records WHERE id = ?', [id]);
  }

  async upsert(data: {
    email: string;
    date: string;
    shiftStart: string;
    shiftEnd: string;
    actualWorkedMinutes: number;
    standardMinutes: number;
    otMinutes: number;
    otType: string;
    hourlyRate: number;
    multiplier: number;
    otPay: number;
    source: string;
  }): Promise<OvertimeRow> {
    await this.db.run(
      `INSERT INTO overtime_records
         (email, date, shift_start, shift_end, actual_worked_minutes, standard_minutes,
          ot_minutes, ot_type, hourly_rate, multiplier, ot_pay, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(email, date, ot_type) DO UPDATE SET
         actual_worked_minutes = excluded.actual_worked_minutes,
         standard_minutes = excluded.standard_minutes,
         ot_minutes = excluded.ot_minutes,
         hourly_rate = excluded.hourly_rate,
         multiplier = excluded.multiplier,
         ot_pay = excluded.ot_pay,
         updated_at = datetime('now')`,
      [
        data.email,
        data.date,
        data.shiftStart,
        data.shiftEnd,
        data.actualWorkedMinutes,
        data.standardMinutes,
        data.otMinutes,
        data.otType,
        data.hourlyRate,
        data.multiplier,
        data.otPay,
        data.source,
      ],
    );
    const row = await this.db.get<OvertimeRow>(
      'SELECT * FROM overtime_records WHERE email = ? AND date = ? AND ot_type = ?',
      [data.email, data.date, data.otType],
    );
    if (!row) throw new Error('Failed to upsert overtime record');
    return row;
  }

  async approve(id: number, approverEmail: string): Promise<void> {
    await this.db.run(
      "UPDATE overtime_records SET status = 'approved', approved_by = ?, updated_at = datetime('now') WHERE id = ?",
      [approverEmail, id],
    );
  }

  async reject(id: number, approverEmail: string, reason: string): Promise<void> {
    await this.db.run(
      "UPDATE overtime_records SET status = 'rejected', approved_by = ?, rejection_reason = ?, updated_at = datetime('now') WHERE id = ?",
      [approverEmail, reason, id],
    );
  }

  async getSummary(
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    totalOtMinutes: number;
    totalOtPay: number;
    approvedOtMinutes: number;
    approvedOtPay: number;
    pendingCount: number;
  }> {
    const row = await this.db.get<{
      total_ot: number;
      total_pay: number;
      approved_ot: number;
      approved_pay: number;
      pending_cnt: number;
      [key: string]: unknown;
    }>(
      `SELECT
         COALESCE(SUM(ot_minutes), 0) as total_ot,
         COALESCE(SUM(ot_pay), 0) as total_pay,
         COALESCE(SUM(CASE WHEN status = 'approved' THEN ot_minutes ELSE 0 END), 0) as approved_ot,
         COALESCE(SUM(CASE WHEN status = 'approved' THEN ot_pay ELSE 0 END), 0) as approved_pay,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) as pending_cnt
       FROM overtime_records
       WHERE email = ? AND date >= ? AND date <= ?`,
      [email, startDate, endDate],
    );
    return {
      totalOtMinutes: row?.total_ot ?? 0,
      totalOtPay: row?.total_pay ?? 0,
      approvedOtMinutes: row?.approved_ot ?? 0,
      approvedOtPay: row?.approved_pay ?? 0,
      pendingCount: row?.pending_cnt ?? 0,
    };
  }

  /** Get total OT hours for an employee in a quarter (for quarterly cap enforcement). */
  async getQuarterlyTotalMinutes(email: string, date: string): Promise<number> {
    const d = new Date(date + 'T00:00:00');
    const quarter = Math.floor(d.getMonth() / 3);
    const qStart = new Date(d.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
    const qEnd = new Date(d.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0];
    const row = await this.db.get<{ total: number; [key: string]: unknown }>(
      'SELECT COALESCE(SUM(ot_minutes), 0) as total FROM overtime_records WHERE email = ? AND date >= ? AND date <= ?',
      [email, qStart, qEnd],
    );
    return row?.total ?? 0;
  }
}
