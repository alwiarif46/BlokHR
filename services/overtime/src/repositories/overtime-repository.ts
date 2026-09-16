import type { OvertimeDb } from '../db';

export interface OvertimeRow {
  [key: string]: unknown;
  id: number;
  tenant_id: string;
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

export interface OvertimeRequestRow {
  [key: string]: unknown;
  id: string;
  tenant_id: string;
  email: string;
  name: string;
  date: string;
  planned_hours: number;
  reason: string;
  status: string;
  approved_by: string;
  rejection_reason: string;
  created_at: string;
  updated_at: string;
}

export interface OtPolicyConfig {
  otEnabled: boolean;
  dailyThresholdMinutes: number;
  weeklyThresholdMinutes: number;
  multiplier: number;
  holidayMultiplier: number;
  requiresApproval: boolean;
  requiresPriorApproval: boolean;
  maxDailyMinutes: number;
  maxQuarterlyHours: number;
}

export interface CompensationRow {
  [key: string]: unknown;
  tenant_id: string;
  email: string;
  basic_salary: number;
  da: number;
  shift_start: string;
  shift_end: string;
  name: string;
}

const DEFAULT_POLICY: OtPolicyConfig = {
  otEnabled: true,
  dailyThresholdMinutes: 540,
  weeklyThresholdMinutes: 2880,
  multiplier: 2.0,
  holidayMultiplier: 3.0,
  requiresApproval: true,
  requiresPriorApproval: true,
  maxDailyMinutes: 240,
  maxQuarterlyHours: 125,
};

export class OvertimeRepository {
  constructor(private readonly db: OvertimeDb) {}

  // ─── policy ──────────────────────────────────────────────────────

  async getPolicy(tenantId: string): Promise<OtPolicyConfig> {
    const row = await this.db.get<{ [key: string]: unknown }>(
      'SELECT * FROM overtime_policy WHERE tenant_id = ?',
      [tenantId],
    );
    if (!row) return { ...DEFAULT_POLICY };
    return {
      otEnabled: Number(row.ot_enabled ?? 1) === 1,
      dailyThresholdMinutes: Number(row.daily_threshold_minutes ?? DEFAULT_POLICY.dailyThresholdMinutes),
      weeklyThresholdMinutes: Number(row.weekly_threshold_minutes ?? DEFAULT_POLICY.weeklyThresholdMinutes),
      multiplier: Number(row.multiplier ?? DEFAULT_POLICY.multiplier),
      holidayMultiplier: Number(row.holiday_multiplier ?? DEFAULT_POLICY.holidayMultiplier),
      requiresApproval: Number(row.requires_approval ?? 1) === 1,
      requiresPriorApproval: Number(row.requires_prior_approval ?? 1) === 1,
      maxDailyMinutes: Number(row.max_daily_minutes ?? DEFAULT_POLICY.maxDailyMinutes),
      maxQuarterlyHours: Number(row.max_quarterly_hours ?? DEFAULT_POLICY.maxQuarterlyHours),
    };
  }

  async upsertPolicy(tenantId: string, patch: Partial<OtPolicyConfig>): Promise<OtPolicyConfig> {
    const current = await this.getPolicy(tenantId);
    const next: OtPolicyConfig = { ...current, ...patch };
    await this.db.run(
      `INSERT INTO overtime_policy (
         tenant_id, ot_enabled, daily_threshold_minutes, weekly_threshold_minutes,
         multiplier, holiday_multiplier, requires_approval, requires_prior_approval,
         max_daily_minutes, max_quarterly_hours, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(tenant_id) DO UPDATE SET
         ot_enabled = excluded.ot_enabled,
         daily_threshold_minutes = excluded.daily_threshold_minutes,
         weekly_threshold_minutes = excluded.weekly_threshold_minutes,
         multiplier = excluded.multiplier,
         holiday_multiplier = excluded.holiday_multiplier,
         requires_approval = excluded.requires_approval,
         requires_prior_approval = excluded.requires_prior_approval,
         max_daily_minutes = excluded.max_daily_minutes,
         max_quarterly_hours = excluded.max_quarterly_hours,
         updated_at = datetime('now')`,
      [
        tenantId,
        next.otEnabled ? 1 : 0,
        next.dailyThresholdMinutes,
        next.weeklyThresholdMinutes,
        next.multiplier,
        next.holidayMultiplier,
        next.requiresApproval ? 1 : 0,
        next.requiresPriorApproval ? 1 : 0,
        next.maxDailyMinutes,
        next.maxQuarterlyHours,
      ],
    );
    return next;
  }

  // ─── records ─────────────────────────────────────────────────────

  async getByEmail(
    tenantId: string,
    email: string,
    startDate?: string,
    endDate?: string,
  ): Promise<OvertimeRow[]> {
    const conditions = ['tenant_id = ?', 'email = ?'];
    const params: unknown[] = [tenantId, email];
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

  async getPending(tenantId: string): Promise<OvertimeRow[]> {
    return this.db.all<OvertimeRow>(
      "SELECT * FROM overtime_records WHERE tenant_id = ? AND status = 'pending' ORDER BY date DESC",
      [tenantId],
    );
  }

  async getById(tenantId: string, id: number): Promise<OvertimeRow | undefined> {
    return this.db.get<OvertimeRow>(
      'SELECT * FROM overtime_records WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
  }

  async upsert(data: {
    tenantId: string;
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
         (tenant_id, email, date, shift_start, shift_end, actual_worked_minutes,
          standard_minutes, ot_minutes, ot_type, hourly_rate, multiplier, ot_pay, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, email, date, ot_type) DO UPDATE SET
         actual_worked_minutes = excluded.actual_worked_minutes,
         standard_minutes = excluded.standard_minutes,
         ot_minutes = excluded.ot_minutes,
         hourly_rate = excluded.hourly_rate,
         multiplier = excluded.multiplier,
         ot_pay = excluded.ot_pay,
         source = excluded.source,
         updated_at = datetime('now')`,
      [
        data.tenantId,
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
      'SELECT * FROM overtime_records WHERE tenant_id = ? AND email = ? AND date = ? AND ot_type = ?',
      [data.tenantId, data.email, data.date, data.otType],
    );
    if (!row) throw new Error('Failed to upsert overtime record');
    return row;
  }

  async approve(tenantId: string, id: number, approverEmail: string): Promise<void> {
    await this.db.run(
      "UPDATE overtime_records SET status = 'approved', approved_by = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
      [approverEmail, tenantId, id],
    );
  }

  async reject(
    tenantId: string,
    id: number,
    approverEmail: string,
    reason: string,
  ): Promise<void> {
    await this.db.run(
      "UPDATE overtime_records SET status = 'rejected', approved_by = ?, rejection_reason = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
      [approverEmail, reason, tenantId, id],
    );
  }

  async getSummary(
    tenantId: string,
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
       WHERE tenant_id = ? AND email = ? AND date >= ? AND date <= ?`,
      [tenantId, email, startDate, endDate],
    );
    return {
      totalOtMinutes: Number(row?.total_ot ?? 0),
      totalOtPay: Number(row?.total_pay ?? 0),
      approvedOtMinutes: Number(row?.approved_ot ?? 0),
      approvedOtPay: Number(row?.approved_pay ?? 0),
      pendingCount: Number(row?.pending_cnt ?? 0),
    };
  }

  async getQuarterlyTotalMinutes(
    tenantId: string,
    email: string,
    date: string,
  ): Promise<number> {
    const d = new Date(date + 'T00:00:00');
    const quarter = Math.floor(d.getMonth() / 3);
    const qStart = new Date(d.getFullYear(), quarter * 3, 1).toISOString().split('T')[0];
    const qEnd = new Date(d.getFullYear(), quarter * 3 + 3, 0).toISOString().split('T')[0];
    const row = await this.db.get<{ total: number; [key: string]: unknown }>(
      'SELECT COALESCE(SUM(ot_minutes), 0) as total FROM overtime_records WHERE tenant_id = ? AND email = ? AND date >= ? AND date <= ?',
      [tenantId, email, qStart, qEnd],
    );
    return Number(row?.total ?? 0);
  }

  // ─── requests ────────────────────────────────────────────────────

  async createRequest(data: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    date: string;
    plannedHours: number;
    reason: string;
  }): Promise<OvertimeRequestRow> {
    await this.db.run(
      `INSERT INTO overtime_requests
         (id, tenant_id, email, name, date, planned_hours, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, email, date) DO UPDATE SET
         planned_hours = excluded.planned_hours,
         reason = excluded.reason,
         status = 'pending',
         approved_by = '',
         rejection_reason = '',
         updated_at = datetime('now')`,
      [
        data.id,
        data.tenantId,
        data.email,
        data.name,
        data.date,
        data.plannedHours,
        data.reason,
      ],
    );
    const row = await this.db.get<OvertimeRequestRow>(
      'SELECT * FROM overtime_requests WHERE tenant_id = ? AND email = ? AND date = ?',
      [data.tenantId, data.email, data.date],
    );
    if (!row) throw new Error('Failed to insert overtime request');
    return row;
  }

  async getRequestById(
    tenantId: string,
    id: string,
  ): Promise<OvertimeRequestRow | undefined> {
    return this.db.get<OvertimeRequestRow>(
      'SELECT * FROM overtime_requests WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
  }

  async listRequests(
    tenantId: string,
    filters: { email?: string; status?: string } = {},
  ): Promise<OvertimeRequestRow[]> {
    const conditions = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.email) {
      conditions.push('email = ?');
      params.push(filters.email);
    }
    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }
    return this.db.all<OvertimeRequestRow>(
      `SELECT * FROM overtime_requests WHERE ${conditions.join(' AND ')} ORDER BY date DESC, created_at DESC`,
      params,
    );
  }

  async findApprovedRequest(
    tenantId: string,
    email: string,
    date: string,
  ): Promise<OvertimeRequestRow | undefined> {
    return this.db.get<OvertimeRequestRow>(
      "SELECT * FROM overtime_requests WHERE tenant_id = ? AND email = ? AND date = ? AND status = 'approved'",
      [tenantId, email, date],
    );
  }

  async approveRequest(
    tenantId: string,
    id: string,
    approverEmail: string,
  ): Promise<void> {
    await this.db.run(
      "UPDATE overtime_requests SET status = 'approved', approved_by = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
      [approverEmail, tenantId, id],
    );
  }

  async rejectRequest(
    tenantId: string,
    id: string,
    approverEmail: string,
    reason: string,
  ): Promise<void> {
    await this.db.run(
      "UPDATE overtime_requests SET status = 'rejected', approved_by = ?, rejection_reason = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?",
      [approverEmail, reason, tenantId, id],
    );
  }

  // ─── compensation cache ──────────────────────────────────────────

  async upsertCompensation(row: {
    tenantId: string;
    email: string;
    basicSalary: number;
    da: number;
    shiftStart: string;
    shiftEnd: string;
    name: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO member_compensation_cache
         (tenant_id, email, basic_salary, da, shift_start, shift_end, name)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, email) DO UPDATE SET
         basic_salary = excluded.basic_salary,
         da = excluded.da,
         shift_start = excluded.shift_start,
         shift_end = excluded.shift_end,
         name = excluded.name,
         updated_at = datetime('now')`,
      [
        row.tenantId,
        row.email,
        row.basicSalary,
        row.da,
        row.shiftStart,
        row.shiftEnd,
        row.name,
      ],
    );
  }

  async getCompensation(
    tenantId: string,
    email: string,
  ): Promise<CompensationRow | undefined> {
    return this.db.get<CompensationRow>(
      'SELECT * FROM member_compensation_cache WHERE tenant_id = ? AND email = ?',
      [tenantId, email],
    );
  }

  async listCompensation(tenantId: string): Promise<CompensationRow[]> {
    return this.db.all<CompensationRow>(
      'SELECT * FROM member_compensation_cache WHERE tenant_id = ?',
      [tenantId],
    );
  }
}
