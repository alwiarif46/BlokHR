import type { Logger } from 'pino';
import type {
  AnalyticsRepository,
  LeaveReportRow,
  LeaveByEmployeeRow,
  TrendRow,
  TrendAggRow,
} from '../repositories/analytics-repository';

// ── Response types ──

export interface AttendanceOverviewReport {
  filters: { startDate: string; endDate: string; groupId?: string; email?: string };
  employees: AttendanceOverviewEntry[];
  summary: {
    totalEmployees: number;
    avgPresentDays: number;
    avgAbsentDays: number;
    avgLeaveDays: number;
    avgLateDays: number;
    avgWorkedHoursPerDay: number;
  };
}

export interface AttendanceOverviewEntry {
  email: string;
  name: string;
  groupId: string;
  groupName: string;
  totalDays: number;
  presentDays: number;
  absentDays: number;
  leaveDays: number;
  holidayDays: number;
  lateDays: number;
  totalWorkedMinutes: number;
  totalBreakMinutes: number;
  avgWorkedHoursPerDay: number;
  attendanceRate: number;
}

export interface LeaveReport {
  filters: { startDate: string; endDate: string; groupId?: string };
  byTypeAndStatus: LeaveReportRow[];
  byEmployee: LeaveByEmployeeRow[];
  summary: {
    totalRequests: number;
    totalDays: number;
    approvedDays: number;
  };
}

export interface OvertimeReport {
  filters: { startDate: string; endDate: string; groupId?: string; email?: string };
  employees: OvertimeReportEntry[];
  summary: {
    totalOtMinutes: number;
    totalOtHours: number;
    totalOtPay: number;
    totalRecords: number;
  };
}

export interface OvertimeReportEntry {
  email: string;
  name: string;
  groupId: string;
  otType: string;
  totalOtMinutes: number;
  totalOtHours: number;
  totalOtPay: number;
  recordCount: number;
}

export interface DepartmentDashboard {
  today: string;
  periodStart: string;
  periodEnd: string;
  departments: DepartmentEntry[];
  summary: {
    totalHeadcount: number;
    totalPresent: number;
    totalAbsent: number;
    totalOnLeave: number;
    overallAttendanceRate: number;
  };
}

export interface DepartmentEntry {
  groupId: string;
  groupName: string;
  headcount: number;
  presentToday: number;
  absentToday: number;
  onLeaveToday: number;
  attendanceRate: number;
}

export interface UtilizationReport {
  filters: { startDate: string; endDate: string; email?: string; projectId?: string; clientId?: string };
  employees: UtilizationEntry[];
  summary: {
    totalHours: number;
    billableHours: number;
    nonBillableHours: number;
    overallUtilization: number;
  };
}

export interface UtilizationEntry {
  email: string;
  name: string;
  totalHours: number;
  billableHours: number;
  nonBillableHours: number;
  utilizationPct: number;
}

export interface AttendanceTrendReport {
  filters: { startDate: string; endDate: string; groupId?: string; groupBy?: string };
  daily?: TrendRow[];
  aggregated?: TrendAggRow[];
}

/** Round to 1 decimal place. */
function r1(n: number): number {
  return Math.round(n * 10) / 10;
}

export class AnalyticsService {
  constructor(
    private readonly repo: AnalyticsRepository,
    private readonly logger: Logger,
  ) {}

  /** Attendance overview report. */
  async getAttendanceOverview(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
    email?: string;
  }): Promise<AttendanceOverviewReport> {
    this.logger.debug({ filters }, 'Generating attendance overview');
    const rows = await this.repo.getAttendanceOverview(filters);

    const employees: AttendanceOverviewEntry[] = rows.map((row) => {
      const presentDays = row.present_days;
      const totalWorkRecords = row.present_days + row.absent_days + row.leave_days;
      return {
        email: row.email,
        name: row.name,
        groupId: row.group_id,
        groupName: row.group_name,
        totalDays: row.total_days,
        presentDays: row.present_days,
        absentDays: row.absent_days,
        leaveDays: row.leave_days,
        holidayDays: row.holiday_days,
        lateDays: row.late_days,
        totalWorkedMinutes: row.total_worked_minutes,
        totalBreakMinutes: row.total_break_minutes,
        avgWorkedHoursPerDay: presentDays > 0 ? r1(row.total_worked_minutes / presentDays / 60) : 0,
        attendanceRate: totalWorkRecords > 0 ? r1((presentDays / totalWorkRecords) * 100) : 0,
      };
    });

    const count = employees.length || 1; // avoid div/0
    const summary = {
      totalEmployees: employees.length,
      avgPresentDays: r1(employees.reduce((s, e) => s + e.presentDays, 0) / count),
      avgAbsentDays: r1(employees.reduce((s, e) => s + e.absentDays, 0) / count),
      avgLeaveDays: r1(employees.reduce((s, e) => s + e.leaveDays, 0) / count),
      avgLateDays: r1(employees.reduce((s, e) => s + e.lateDays, 0) / count),
      avgWorkedHoursPerDay: r1(
        employees.reduce((s, e) => s + e.avgWorkedHoursPerDay, 0) / count,
      ),
    };

    return { filters, employees, summary };
  }

  /** Leave report: by type/status + by employee. */
  async getLeaveReport(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
    email?: string;
  }): Promise<LeaveReport> {
    const [byTypeAndStatus, byEmployee] = await Promise.all([
      this.repo.getLeaveReport({
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupId: filters.groupId,
      }),
      this.repo.getLeavesByEmployee(filters),
    ]);

    const totalRequests = byTypeAndStatus.reduce((s, r) => s + r.request_count, 0);
    const totalDays = byTypeAndStatus.reduce((s, r) => s + r.total_days, 0);
    const approvedDays = byTypeAndStatus
      .filter((r) => r.status === 'Approved')
      .reduce((s, r) => s + r.total_days, 0);

    return {
      filters: { startDate: filters.startDate, endDate: filters.endDate, groupId: filters.groupId },
      byTypeAndStatus,
      byEmployee,
      summary: { totalRequests, totalDays, approvedDays },
    };
  }

  /** Overtime report. */
  async getOvertimeReport(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
    email?: string;
  }): Promise<OvertimeReport> {
    const rows = await this.repo.getOvertimeReport(filters);

    const employees: OvertimeReportEntry[] = rows.map((row) => ({
      email: row.email,
      name: row.name,
      groupId: row.group_id,
      otType: row.ot_type,
      totalOtMinutes: row.total_ot_minutes,
      totalOtHours: r1(row.total_ot_minutes / 60),
      totalOtPay: r1(row.total_ot_pay),
      recordCount: row.record_count,
    }));

    const summary = {
      totalOtMinutes: employees.reduce((s, e) => s + e.totalOtMinutes, 0),
      totalOtHours: r1(employees.reduce((s, e) => s + e.totalOtMinutes, 0) / 60),
      totalOtPay: r1(employees.reduce((s, e) => s + e.totalOtPay, 0)),
      totalRecords: employees.reduce((s, e) => s + e.recordCount, 0),
    };

    return { filters, employees, summary };
  }

  /** Department dashboard with today's snapshot + period attendance rate. */
  async getDepartmentDashboard(
    today: string,
    periodStartDate?: string,
    periodEndDate?: string,
  ): Promise<DepartmentDashboard> {
    // Default period: current month
    const start = periodStartDate ?? today.slice(0, 7) + '-01';
    const end = periodEndDate ?? today;

    const rows = await this.repo.getDepartmentDashboard(today, start, end);

    const departments: DepartmentEntry[] = rows.map((row) => ({
      groupId: row.group_id,
      groupName: row.group_name,
      headcount: row.headcount,
      presentToday: row.present_today,
      absentToday: row.absent_today,
      onLeaveToday: row.on_leave_today,
      attendanceRate: row.attendance_rate,
    }));

    const totalHeadcount = departments.reduce((s, d) => s + d.headcount, 0);
    const totalPresent = departments.reduce((s, d) => s + d.presentToday, 0);
    const totalAbsent = departments.reduce((s, d) => s + d.absentToday, 0);
    const totalOnLeave = departments.reduce((s, d) => s + d.onLeaveToday, 0);
    const totalRate = departments.length > 0
      ? r1(departments.reduce((s, d) => s + d.attendanceRate, 0) / departments.length)
      : 0;

    return {
      today,
      periodStart: start,
      periodEnd: end,
      departments,
      summary: {
        totalHeadcount,
        totalPresent,
        totalAbsent,
        totalOnLeave,
        overallAttendanceRate: totalRate,
      },
    };
  }

  /** Utilization report from time entries. */
  async getUtilization(filters: {
    startDate: string;
    endDate: string;
    email?: string;
    projectId?: string;
    clientId?: string;
  }): Promise<UtilizationReport> {
    const rows = await this.repo.getUtilization(filters);

    const employees: UtilizationEntry[] = rows.map((row) => ({
      email: row.email,
      name: row.name,
      totalHours: r1(row.total_hours),
      billableHours: r1(row.billable_hours),
      nonBillableHours: r1(row.non_billable_hours),
      utilizationPct: row.utilization_pct,
    }));

    const totalHours = employees.reduce((s, e) => s + e.totalHours, 0);
    const billableHours = employees.reduce((s, e) => s + e.billableHours, 0);
    const nonBillableHours = employees.reduce((s, e) => s + e.nonBillableHours, 0);

    return {
      filters,
      employees,
      summary: {
        totalHours: r1(totalHours),
        billableHours: r1(billableHours),
        nonBillableHours: r1(nonBillableHours),
        overallUtilization: totalHours > 0 ? r1((billableHours / totalHours) * 100) : 0,
      },
    };
  }

  /** Attendance trends: daily or aggregated by week/month. */
  async getAttendanceTrend(filters: {
    startDate: string;
    endDate: string;
    groupId?: string;
    groupBy?: 'day' | 'week' | 'month';
  }): Promise<AttendanceTrendReport> {
    const groupBy = filters.groupBy ?? 'day';

    if (groupBy === 'day') {
      const daily = await this.repo.getAttendanceTrend(filters);
      return { filters, daily };
    }

    const aggregated = await this.repo.getAttendanceTrendAggregated({
      startDate: filters.startDate,
      endDate: filters.endDate,
      groupId: filters.groupId,
      groupBy: groupBy as 'week' | 'month',
    });
    return { filters, aggregated };
  }
}
