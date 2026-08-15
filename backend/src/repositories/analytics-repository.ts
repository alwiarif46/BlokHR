import type { DatabaseEngine } from '../db/engine';

// ── Row types for each report ──

export interface AttendanceOverviewRow {
  [key: string]: unknown;
  email: string;
  name: string;
  group_id: string;
  group_name: string;
  total_days: number;
  present_days: number;
  absent_days: number;
  leave_days: number;
  holiday_days: number;
  late_days: number;
  total_worked_minutes: number;
  total_break_minutes: number;
}

export interface LeaveReportRow {
  [key: string]: unknown;
  leave_type: string;
  status: string;
  request_count: number;
  total_days: number;
}

export interface LeaveByEmployeeRow {
  [key: string]: unknown;
  email: string;
  name: string;
  leave_type: string;
  total_days: number;
  request_count: number;
}

export interface OvertimeReportRow {
  [key: string]: unknown;
  email: string;
  name: string;
  group_id: string;
  ot_type: string;
  total_ot_minutes: number;
  total_ot_pay: number;
  record_count: number;
}

export interface DepartmentDashboardRow {
  [key: string]: unknown;
  group_id: string;
  group_name: string;
  headcount: number;
  present_today: number;
  absent_today: number;
  on_leave_today: number;
  attendance_rate: number;
}

export interface UtilizationRow {
  [key: string]: unknown;
  email: string;
  name: string;
  total_hours: number;
  billable_hours: number;
  non_billable_hours: number;
  utilization_pct: number;
}

export interface TrendRow {
  [key: string]: unknown;
  date: string;
  present_count: number;
  absent_count: number;
  leave_count: number;
  total_members: number;
}

export interface TrendAggRow {
  [key: string]: unknown;
  period: string;
  avg_present: number;
  avg_absent: number;
  avg_leave: number;
  avg_total: number;
}

export class AnalyticsRepository {
  constructor(private readonly db: DatabaseEngine) {}

  /**
   * Attendance overview: per-employee attendance stats for a date range.
   * Uses attendance_daily for worked data plus leaves/holidays for the broader picture.
   */
  async getAttendanceOverview(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
    email?: string;
  }): Promise<AttendanceOverviewRow[]> {
    const conditions: string[] = ['m.active = 1'];
    const params: unknown[] = [];

    if (filters.groupId) {
      conditions.push('m.group_id = ?');
      params.push(filters.groupId);
    }
    if (filters.email) {
      conditions.push('m.email = ?');
      params.push(filters.email);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count calendar days in range for reference
    // We compute actual stats from attendance_daily
    return this.db.all<AttendanceOverviewRow>(
      `SELECT
        m.email,
        m.name,
        COALESCE(m.group_id, '') as group_id,
        COALESCE(g.name, '') as group_name,
        COALESCE(att.total_days, 0) as total_days,
        COALESCE(att.present_days, 0) as present_days,
        COALESCE(att.absent_days, 0) as absent_days,
        COALESCE(att.leave_days, 0) as leave_days,
        COALESCE(att.holiday_days, 0) as holiday_days,
        COALESCE(att.late_days, 0) as late_days,
        COALESCE(att.total_worked_minutes, 0) as total_worked_minutes,
        COALESCE(att.total_break_minutes, 0) as total_break_minutes
      FROM members m
      LEFT JOIN groups g ON m.group_id = g.id
      LEFT JOIN (
        SELECT
          email,
          COUNT(*) as total_days,
          SUM(CASE WHEN status IN ('in', 'out', 'break') THEN 1 ELSE 0 END) as present_days,
          SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END) as absent_days,
          SUM(CASE WHEN status = 'leave' THEN 1 ELSE 0 END) as leave_days,
          0 as holiday_days,
          SUM(CASE WHEN is_late = 1 THEN 1 ELSE 0 END) as late_days,
          SUM(total_worked_minutes) as total_worked_minutes,
          SUM(total_break_minutes) as total_break_minutes
        FROM attendance_daily
        WHERE date >= ? AND date <= ?
        GROUP BY email
      ) att ON att.email = m.email
      ${where}
      ORDER BY g.name, m.name`,
      [filters.startDate, filters.endDate, ...params],
    );
  }

  /**
   * Leave report: leave counts by type and status.
   */
  async getLeaveReport(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
  }): Promise<LeaveReportRow[]> {
    const conditions: string[] = [
      'lr.start_date <= ?',
      'lr.end_date >= ?',
    ];
    const params: unknown[] = [filters.endDate, filters.startDate];

    if (filters.groupId) {
      conditions.push('m.group_id = ?');
      params.push(filters.groupId);
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    return this.db.all<LeaveReportRow>(
      `SELECT
        lr.leave_type,
        lr.status,
        COUNT(*) as request_count,
        SUM(lr.days_requested) as total_days
      FROM leave_requests lr
      LEFT JOIN members m ON lr.person_email = m.email
      ${where}
      GROUP BY lr.leave_type, lr.status
      ORDER BY lr.leave_type, lr.status`,
      params,
    );
  }

  /**
   * Leave breakdown by employee for a date range.
   */
  async getLeavesByEmployee(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
    email?: string;
  }): Promise<LeaveByEmployeeRow[]> {
    const conditions: string[] = [
      'lr.start_date <= ?',
      'lr.end_date >= ?',
      "lr.status = 'Approved'",
    ];
    const params: unknown[] = [filters.endDate, filters.startDate];

    if (filters.groupId) {
      conditions.push('m.group_id = ?');
      params.push(filters.groupId);
    }
    if (filters.email) {
      conditions.push('lr.person_email = ?');
      params.push(filters.email);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    return this.db.all<LeaveByEmployeeRow>(
      `SELECT
        lr.person_email as email,
        COALESCE(m.name, lr.person_name) as name,
        lr.leave_type,
        SUM(lr.days_requested) as total_days,
        COUNT(*) as request_count
      FROM leave_requests lr
      LEFT JOIN members m ON lr.person_email = m.email
      ${where}
      GROUP BY lr.person_email, lr.leave_type
      ORDER BY m.name, lr.leave_type`,
      params,
    );
  }

  /**
   * Overtime report: OT hours and pay by employee, split by type.
   */
  async getOvertimeReport(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
    email?: string;
    status?: string;
  }): Promise<OvertimeReportRow[]> {
    const conditions: string[] = [
      'ot.date >= ?',
      'ot.date <= ?',
    ];
    const params: unknown[] = [filters.startDate, filters.endDate];

    if (filters.groupId) {
      conditions.push('m.group_id = ?');
      params.push(filters.groupId);
    }
    if (filters.email) {
      conditions.push('ot.email = ?');
      params.push(filters.email);
    }
    if (filters.status) {
      conditions.push('ot.status = ?');
      params.push(filters.status);
    } else {
      // Default to approved only
      conditions.push("ot.status = 'approved'");
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    return this.db.all<OvertimeReportRow>(
      `SELECT
        ot.email,
        COALESCE(m.name, '') as name,
        COALESCE(m.group_id, '') as group_id,
        ot.ot_type,
        SUM(ot.ot_minutes) as total_ot_minutes,
        SUM(ot.ot_pay) as total_ot_pay,
        COUNT(*) as record_count
      FROM overtime_records ot
      LEFT JOIN members m ON ot.email = m.email
      ${where}
      GROUP BY ot.email, ot.ot_type
      ORDER BY m.name, ot.ot_type`,
      params,
    );
  }

  /**
   * Department dashboard: per-group snapshot with today's status + period attendance rate.
   */
  async getDepartmentDashboard(
    today: string,
    periodStartDate: string,
    periodEndDate: string,
  ): Promise<DepartmentDashboardRow[]> {
    return this.db.all<DepartmentDashboardRow>(
      `SELECT
        g.id as group_id,
        g.name as group_name,
        COALESCE(hc.cnt, 0) as headcount,
        COALESCE(td.present_today, 0) as present_today,
        COALESCE(td.absent_today, 0) as absent_today,
        COALESCE(td.on_leave_today, 0) as on_leave_today,
        CASE
          WHEN COALESCE(pr.total_records, 0) = 0 THEN 0
          ELSE ROUND(CAST(pr.present_records AS REAL) / pr.total_records * 100, 1)
        END as attendance_rate
      FROM groups g
      LEFT JOIN (
        SELECT group_id, COUNT(*) as cnt
        FROM members WHERE active = 1
        GROUP BY group_id
      ) hc ON hc.group_id = g.id
      LEFT JOIN (
        SELECT
          m.group_id,
          SUM(CASE WHEN ad.status IN ('in', 'out', 'break') THEN 1 ELSE 0 END) as present_today,
          SUM(CASE WHEN ad.status = 'absent' THEN 1 ELSE 0 END) as absent_today,
          SUM(CASE WHEN ad.status = 'leave' THEN 1 ELSE 0 END) as on_leave_today
        FROM attendance_daily ad
        JOIN members m ON ad.email = m.email
        WHERE ad.date = ?
        GROUP BY m.group_id
      ) td ON td.group_id = g.id
      LEFT JOIN (
        SELECT
          m.group_id,
          COUNT(*) as total_records,
          SUM(CASE WHEN ad.status IN ('in', 'out', 'break') THEN 1 ELSE 0 END) as present_records
        FROM attendance_daily ad
        JOIN members m ON ad.email = m.email
        WHERE ad.date >= ? AND ad.date <= ?
        GROUP BY m.group_id
      ) pr ON pr.group_id = g.id
      ORDER BY g.name`,
      [today, periodStartDate, periodEndDate],
    );
  }

  /**
   * Utilization report: billable vs non-billable from time entries.
   */
  async getUtilization(filters: {
    startDate: string;
    endDate: string;
    email?: string;
    projectId?: string;
    clientId?: string;
  }): Promise<UtilizationRow[]> {
    const conditions: string[] = [
      't.date >= ?',
      't.date <= ?',
    ];
    const params: unknown[] = [filters.startDate, filters.endDate];

    if (filters.email) {
      conditions.push('t.email = ?');
      params.push(filters.email);
    }
    if (filters.projectId) {
      conditions.push('t.project_id = ?');
      params.push(filters.projectId);
    }
    if (filters.clientId) {
      conditions.push('p.client_id = ?');
      params.push(filters.clientId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    return this.db.all<UtilizationRow>(
      `SELECT
        t.email,
        COALESCE(m.name, t.email) as name,
        SUM(t.hours) as total_hours,
        SUM(CASE WHEN t.billable = 1 THEN t.hours ELSE 0 END) as billable_hours,
        SUM(CASE WHEN t.billable = 0 THEN t.hours ELSE 0 END) as non_billable_hours,
        CASE
          WHEN SUM(t.hours) = 0 THEN 0
          ELSE ROUND(CAST(SUM(CASE WHEN t.billable = 1 THEN t.hours ELSE 0 END) AS REAL) / SUM(t.hours) * 100, 1)
        END as utilization_pct
      FROM time_entries t
      LEFT JOIN projects p ON t.project_id = p.id
      LEFT JOIN members m ON t.email = m.email
      ${where}
      GROUP BY t.email
      ORDER BY m.name`,
      params,
    );
  }

  /**
   * Daily attendance trend: per-day present/absent/leave counts.
   */
  async getAttendanceTrend(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
  }): Promise<TrendRow[]> {
    const conditions: string[] = [
      'ad.date >= ?',
      'ad.date <= ?',
    ];
    const params: unknown[] = [filters.startDate, filters.endDate];

    if (filters.groupId) {
      conditions.push('m.group_id = ?');
      params.push(filters.groupId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    return this.db.all<TrendRow>(
      `SELECT
        ad.date,
        SUM(CASE WHEN ad.status IN ('in', 'out', 'break') THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ad.status = 'absent' THEN 1 ELSE 0 END) as absent_count,
        SUM(CASE WHEN ad.status = 'leave' THEN 1 ELSE 0 END) as leave_count,
        COUNT(*) as total_members
      FROM attendance_daily ad
      LEFT JOIN members m ON ad.email = m.email
      ${where}
      GROUP BY ad.date
      ORDER BY ad.date`,
      params,
    );
  }

  /**
   * Aggregated trend (group daily rows into weekly or monthly buckets).
   */
  async getAttendanceTrendAggregated(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
    groupBy: 'week' | 'month';
  }): Promise<TrendAggRow[]> {
    const conditions: string[] = [
      'ad.date >= ?',
      'ad.date <= ?',
    ];
    const params: unknown[] = [filters.startDate, filters.endDate];

    if (filters.groupId) {
      conditions.push('m.group_id = ?');
      params.push(filters.groupId);
    }

    const where = `WHERE ${conditions.join(' AND ')}`;

    // SQLite: strftime('%W', date) for week number, strftime('%Y-%m', date) for month
    // Note: outer query references subquery column 'date' (not 'ad.date')
    const outerPeriodExpr =
      filters.groupBy === 'week'
        ? "strftime('%Y-W%W', date)"
        : "strftime('%Y-%m', date)";

    return this.db.all<TrendAggRow>(
      `SELECT
        ${outerPeriodExpr} as period,
        ROUND(AVG(day_present), 1) as avg_present,
        ROUND(AVG(day_absent), 1) as avg_absent,
        ROUND(AVG(day_leave), 1) as avg_leave,
        ROUND(AVG(day_total), 1) as avg_total
      FROM (
        SELECT
          ad.date as date,
          SUM(CASE WHEN ad.status IN ('in', 'out', 'break') THEN 1 ELSE 0 END) as day_present,
          SUM(CASE WHEN ad.status = 'absent' THEN 1 ELSE 0 END) as day_absent,
          SUM(CASE WHEN ad.status = 'leave' THEN 1 ELSE 0 END) as day_leave,
          COUNT(*) as day_total
        FROM attendance_daily ad
        LEFT JOIN members m ON ad.email = m.email
        ${where}
        GROUP BY ad.date
      )
      GROUP BY ${outerPeriodExpr}
      ORDER BY period`,
      params,
    );
  }

  /** Get active member count (for rate calculations). */
  async getActiveMemberCount(groupId?: string): Promise<number> {
    const conditions: string[] = ['active = 1'];
    const params: unknown[] = [];
    if (groupId) {
      conditions.push('group_id = ?');
      params.push(groupId);
    }
    const row = await this.db.get<{ cnt: number; [key: string]: unknown }>(
      `SELECT COUNT(*) as cnt FROM members WHERE ${conditions.join(' AND ')}`,
      params,
    );
    return row?.cnt ?? 0;
  }
}
