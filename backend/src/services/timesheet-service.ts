import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import type {
  TimesheetRepository,
  TimesheetRow,
  TimesheetEntryRow,
  TimesheetAdjustmentRow,
  AttendanceDayRow,
  LeaveAggRow,
  HolidayAggRow,
} from '../repositories/timesheet-repository';
import type { EventBus } from '../events';
import type { NotificationDispatcher } from './notification/dispatcher';

export interface TimesheetDetail {
  timesheet: TimesheetRow;
  entries: TimesheetEntryRow[];
  adjustments: TimesheetAdjustmentRow[];
}

export interface TimesheetWithEntries extends TimesheetRow {
  entries: TimesheetEntryRow[];
}

export interface WeekView {
  startDate: string;
  endDate: string;
  timesheets: TimesheetWithEntries[];
}

export interface GenerateResult {
  success: boolean;
  timesheet?: TimesheetRow;
  error?: string;
  statusCode?: number;
}

export interface TeamGenerateResult {
  success: boolean;
  error?: string;
  statusCode?: number;
  generated: string[];
  skipped: Array<{ email: string; reason: string }>;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  statusCode?: number;
}

/** Build a YYYY-MM-DD string from a Date (UTC). */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Parse a YYYY-MM-DD string into a Date (UTC midnight). */
function parseDate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Get the last day of a month (YYYY-MM-DD). */
function lastDayOfMonth(year: number, month: number): string {
  // month is 1-based; Date.UTC(year, month, 0) gives last day of that month
  const d = new Date(Date.UTC(year, month, 0));
  return toDateStr(d);
}

/** Enumerate every date from start to end (inclusive) as YYYY-MM-DD strings. */
function enumerateDates(startDate: string, endDate: string): string[] {
  const dates: string[] = [];
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const cursor = new Date(start);
  while (cursor <= end) {
    dates.push(toDateStr(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

/** Check if a date falls on Saturday (6) or Sunday (0). */
function isWeekend(dateStr: string): boolean {
  const day = parseDate(dateStr).getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Check if dateStr is covered by a leave. Returns { covered: boolean; leaveType; leaveDays }.
 * Half-day leaves (FirstHalf / SecondHalf) count as 0.5 days.
 */
function checkLeaveCoverage(
  dateStr: string,
  leaves: LeaveAggRow[],
): { covered: boolean; leaveType: string; leaveDays: number } {
  for (const lv of leaves) {
    if (dateStr >= lv.start_date && dateStr <= lv.end_date) {
      const kind = lv.kind as string;
      const days = kind === 'FirstHalf' || kind === 'SecondHalf' ? 0.5 : 1;
      return { covered: true, leaveType: lv.leave_type, leaveDays: days };
    }
  }
  return { covered: false, leaveType: '', leaveDays: 0 };
}

/** Monday of the week containing dateStr, as YYYY-MM-DD. */
function mondayOf(dateStr: string): string {
  const d = parseDate(dateStr);
  const dow = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() - ((dow + 6) % 7));
  return toDateStr(d);
}

export class TimesheetService {
  constructor(
    private readonly repo: TimesheetRepository,
    private readonly logger: Logger,
    private readonly eventBus?: EventBus,
    private readonly dispatcher?: NotificationDispatcher | null,
  ) {}

  /**
   * Generate a new timesheet from raw attendance, leave, OT, and time entry data.
   * periodType: 'weekly' (startDate must be Monday) or 'monthly' (startDate must be 1st).
   */
  async generate(
    email: string,
    periodType: string,
    startDate: string,
  ): Promise<GenerateResult> {
    // ── Validate period type ──
    if (periodType !== 'weekly' && periodType !== 'monthly') {
      return { success: false, error: 'periodType must be weekly or monthly' };
    }

    // ── Validate & compute date range ──
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      return { success: false, error: 'startDate must be YYYY-MM-DD' };
    }

    let endDate: string;

    if (periodType === 'weekly') {
      const startD = parseDate(startDate);
      if (startD.getUTCDay() !== 1) {
        return { success: false, error: 'Weekly timesheet startDate must be a Monday' };
      }
      const endD = new Date(startD);
      endD.setUTCDate(endD.getUTCDate() + 6);
      endDate = toDateStr(endD);
    } else {
      // monthly — must be 1st of month
      if (!startDate.endsWith('-01')) {
        return { success: false, error: 'Monthly timesheet startDate must be the 1st (YYYY-MM-01)' };
      }
      const [y, m] = startDate.split('-').map(Number);
      endDate = lastDayOfMonth(y, m);
    }

    // ── Duplicate check ──
    const existing = await this.repo.getByEmailPeriod(email, periodType, startDate);
    if (existing) {
      return {
        success: false,
        error: `Timesheet already exists for ${email} (${periodType} starting ${startDate}) with id ${existing.id}. Use regenerate to refresh.`,
      };
    }

    // ── Resolve employee name ──
    const name = await this.repo.getMemberName(email);

    // ── Build the timesheet ──
    const id = uuidv4();
    const { totals, entries } = await this.buildEntries(id, email, startDate, endDate);

    const timesheet = await this.repo.create({
      id,
      email,
      name,
      periodType,
      startDate,
      endDate,
      ...totals,
    });

    await this.repo.insertEntries(entries);

    this.logger.info(
      { timesheetId: id, email, periodType, startDate, endDate },
      'Timesheet generated',
    );
    return { success: true, timesheet };
  }

  /**
   * Regenerate an existing timesheet. Only allowed for draft or rejected.
   * Deletes existing entries, re-pulls fresh data, rebuilds.
   */
  async regenerate(id: string): Promise<GenerateResult> {
    const ts = await this.repo.getById(id);
    if (!ts) return { success: false, error: 'Timesheet not found' };
    if (ts.status !== 'draft' && ts.status !== 'rejected') {
      return { success: false, error: `Cannot regenerate a timesheet in ${ts.status} status` };
    }

    // Admin overrides survive a refresh of the derived data
    const preserved = await this.repo.getAdjustedEntries(id);

    // Delete old entries and rebuild
    await this.repo.deleteEntries(id);

    const { totals, entries } = await this.buildEntries(id, ts.email, ts.start_date, ts.end_date);
    await this.repo.updateTotals(id, totals);
    // Reset status to draft on regenerate
    await this.repo.updateStatus(id, 'draft', {
      rejectedBy: '',
      rejectedAt: undefined,
      rejectionReason: '',
    });
    await this.repo.insertEntries(entries);

    for (const adj of preserved) {
      await this.repo.setAdjustment(id, adj.date, {
        adjustedMinutes: adj.adjustedMinutes,
        reason: adj.reason,
        adjustedBy: adj.adjustedBy,
        adjustedAt: adj.adjustedAt ?? new Date().toISOString(),
      });
    }
    if (preserved.length > 0) await this.repo.recomputeWorkedTotal(id);

    const updated = await this.repo.getById(id);
    this.logger.info(
      { timesheetId: id, preservedAdjustments: preserved.length },
      'Timesheet regenerated',
    );
    return { success: true, timesheet: updated ?? undefined };
  }

  /** Submit a draft timesheet for approval. */
  async submit(id: string, submitterEmail: string): Promise<ActionResult> {
    const ts = await this.repo.getById(id);
    if (!ts) return { success: false, error: 'Timesheet not found' };
    if (ts.email !== submitterEmail) {
      return { success: false, error: 'Only the timesheet owner can submit' };
    }
    if (ts.status !== 'draft') {
      return { success: false, error: `Cannot submit a timesheet in ${ts.status} status` };
    }

    const now = new Date().toISOString();
    await this.repo.updateStatus(id, 'submitted', { submittedAt: now });
    this.logger.info({ timesheetId: id, email: ts.email }, 'Timesheet submitted');
    this.eventBus?.emit('timesheet.submitted', { timesheetId: id, email: ts.email, periodType: ts.period_type, startDate: ts.start_date, endDate: ts.end_date });
    this.notifyApprover(ts).catch((err) => {
      this.logger.error({ err, timesheetId: id }, 'Approver notification failed');
    });
    return { success: true };
  }

  /** Approve a submitted timesheet. Locks it from further modification. */
  async approve(id: string, approverEmail: string): Promise<ActionResult> {
    const ts = await this.repo.getById(id);
    if (!ts) return { success: false, error: 'Timesheet not found' };
    if (ts.status !== 'submitted') {
      return { success: false, error: `Cannot approve a timesheet in ${ts.status} status` };
    }
    const allowed = await this.canApprove(approverEmail, ts.email);
    if (!allowed) {
      return {
        success: false,
        error: 'Only a manager, HR, or an admin can approve this timesheet',
        statusCode: 403,
      };
    }

    const now = new Date().toISOString();
    await this.repo.updateStatus(id, 'approved', {
      approvedBy: approverEmail,
      approvedAt: now,
    });
    this.logger.info(
      { timesheetId: id, email: ts.email, approver: approverEmail },
      'Timesheet approved',
    );
    this.eventBus?.emit('timesheet.approved', { timesheetId: id, email: ts.email, periodType: ts.period_type, startDate: ts.start_date, endDate: ts.end_date, approverEmail });
    this.notifyOwner(ts, 'approved').catch((err) => {
      this.logger.error({ err, timesheetId: id }, 'Owner notification failed');
    });
    return { success: true };
  }

  /** Reject a submitted timesheet. Employee can regenerate and resubmit. */
  async reject(id: string, rejectorEmail: string, reason: string): Promise<ActionResult> {
    const ts = await this.repo.getById(id);
    if (!ts) return { success: false, error: 'Timesheet not found' };
    if (ts.status !== 'submitted') {
      return { success: false, error: `Cannot reject a timesheet in ${ts.status} status` };
    }
    const allowed = await this.canApprove(rejectorEmail, ts.email);
    if (!allowed) {
      return {
        success: false,
        error: 'Only a manager, HR, or an admin can reject this timesheet',
        statusCode: 403,
      };
    }

    const now = new Date().toISOString();
    await this.repo.updateStatus(id, 'rejected', {
      rejectedBy: rejectorEmail,
      rejectedAt: now,
      rejectionReason: reason,
    });
    this.logger.info(
      { timesheetId: id, email: ts.email, rejector: rejectorEmail },
      'Timesheet rejected',
    );
    this.eventBus?.emit('timesheet.rejected', { timesheetId: id, email: ts.email, periodType: ts.period_type, startDate: ts.start_date, endDate: ts.end_date, approverEmail: rejectorEmail, reason });
    this.notifyOwner(ts, 'rejected', reason).catch((err) => {
      this.logger.error({ err, timesheetId: id }, 'Owner notification failed');
    });
    return { success: true };
  }

  /** Get a timesheet with all its daily entries and its adjustment trail. */
  async getDetail(id: string): Promise<TimesheetDetail | null> {
    const timesheet = await this.repo.getById(id);
    if (!timesheet) return null;
    const [entries, adjustments] = await Promise.all([
      this.repo.getEntries(id),
      this.repo.listAdjustments(id),
    ]);
    return { timesheet, entries, adjustments };
  }

  /** List timesheets with optional filters. */
  async list(filters: {
    email?: string;
    periodType?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<TimesheetRow[]> {
    return this.repo.list(filters);
  }

  // ── Week view ──

  /**
   * Weekly grid data: every weekly timesheet starting on the given Monday,
   * each with its seven daily entries attached.
   */
  async getWeek(startDate: string, filters: { email?: string } = {}): Promise<WeekView | null> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate)) return null;
    const monday = mondayOf(startDate);
    const endD = parseDate(monday);
    endD.setUTCDate(endD.getUTCDate() + 6);
    const endDate = toDateStr(endD);

    const timesheets = await this.repo.list({
      periodType: 'weekly',
      startDate: monday,
      endDate,
      email: filters.email,
    });

    const entries = await this.repo.getEntriesForTimesheetIds(timesheets.map((t) => t.id));
    const byTimesheet = new Map<string, TimesheetEntryRow[]>();
    for (const e of entries) {
      const list = byTimesheet.get(e.timesheet_id) ?? [];
      list.push(e);
      byTimesheet.set(e.timesheet_id, list);
    }

    return {
      startDate: monday,
      endDate,
      timesheets: timesheets.map((t) => ({ ...t, entries: byTimesheet.get(t.id) ?? [] })),
    };
  }

  /** Submitted timesheets the actor is allowed to approve. */
  async listPendingApprovals(actorEmail: string): Promise<TimesheetRow[]> {
    const submitted = await this.repo.list({ status: 'submitted' });
    const allowed: TimesheetRow[] = [];
    for (const ts of submitted) {
      if (ts.email === actorEmail) continue;
      if (await this.canApprove(actorEmail, ts.email)) allowed.push(ts);
    }
    return allowed;
  }

  // ── Team generation ──

  /**
   * Generate weekly timesheets for the whole roster (or an explicit subset).
   * Already-generated members are skipped rather than failing the batch.
   */
  async generateTeam(
    periodType: string,
    startDate: string,
    emails?: string[],
  ): Promise<TeamGenerateResult> {
    const roster =
      emails && emails.length > 0
        ? emails.map((e) => e.toLowerCase().trim()).filter(Boolean)
        : await this.repo.listActiveMemberEmails();

    if (roster.length === 0) {
      return { success: false, error: 'No active members to generate for', generated: [], skipped: [] };
    }

    const generated: string[] = [];
    const skipped: Array<{ email: string; reason: string }> = [];

    for (const email of roster) {
      const result = await this.generate(email, periodType, startDate);
      if (result.success) {
        generated.push(email);
      } else {
        skipped.push({ email, reason: result.error ?? 'Generation failed' });
      }
    }

    // Every member failing for the same structural reason (bad period) is a request error
    if (generated.length === 0 && skipped.length > 0) {
      const first = skipped[0].reason;
      const structural =
        first.includes('must be a Monday') ||
        first.includes('must be the 1st') ||
        first.includes('periodType must be') ||
        first.includes('startDate must be');
      if (structural) return { success: false, error: first, generated, skipped };
    }

    this.logger.info(
      { periodType, startDate, generated: generated.length, skipped: skipped.length },
      'Team timesheets generated',
    );
    return { success: true, generated, skipped };
  }

  // ── Day adjustments ──

  /**
   * Override a single day's worked hours. Derived data is left intact; the
   * override, its reason, and the previous value are all recorded.
   */
  async adjustDay(
    id: string,
    date: string,
    hours: number,
    reason: string,
    actorEmail: string,
  ): Promise<ActionResult> {
    if (!(await this.repo.isAdmin(actorEmail))) {
      return { success: false, error: 'Admin access required', statusCode: 403 };
    }
    if (!Number.isFinite(hours) || hours < 0 || hours > 24) {
      return { success: false, error: 'hours must be between 0 and 24' };
    }
    if (!reason.trim()) {
      return { success: false, error: 'A reason is required for an adjustment' };
    }

    const ts = await this.repo.getById(id);
    if (!ts) return { success: false, error: 'Timesheet not found', statusCode: 404 };
    if (ts.status === 'approved') {
      return { success: false, error: 'Cannot adjust an approved timesheet' };
    }

    const entry = await this.repo.getEntryByDate(id, date);
    if (!entry) return { success: false, error: 'No entry for that date', statusCode: 404 };

    const previousMinutes = entry.adjusted_minutes ?? entry.worked_minutes;
    const newMinutes = hours * 60;

    await this.repo.setAdjustment(id, date, {
      adjustedMinutes: newMinutes,
      reason: reason.trim(),
      adjustedBy: actorEmail,
    });
    await this.repo.recomputeWorkedTotal(id);
    await this.repo.addAdjustmentLog({
      id: uuidv4(),
      timesheetId: id,
      date,
      action: 'adjusted',
      previousMinutes,
      newMinutes,
      reason: reason.trim(),
      actorEmail,
    });

    this.logger.info({ timesheetId: id, date, hours, actorEmail }, 'Timesheet day adjusted');
    return { success: true };
  }

  /** Drop an override so the day falls back to its derived value. */
  async revertDay(id: string, date: string, actorEmail: string): Promise<ActionResult> {
    if (!(await this.repo.isAdmin(actorEmail))) {
      return { success: false, error: 'Admin access required', statusCode: 403 };
    }

    const ts = await this.repo.getById(id);
    if (!ts) return { success: false, error: 'Timesheet not found', statusCode: 404 };
    if (ts.status === 'approved') {
      return { success: false, error: 'Cannot adjust an approved timesheet' };
    }

    const entry = await this.repo.getEntryByDate(id, date);
    if (!entry) return { success: false, error: 'No entry for that date', statusCode: 404 };
    if (entry.adjusted_minutes === null || entry.adjusted_minutes === undefined) {
      return { success: false, error: 'That day has no adjustment to revert' };
    }

    const previousMinutes = entry.adjusted_minutes;

    await this.repo.clearAdjustment(id, date);
    await this.repo.recomputeWorkedTotal(id);
    await this.repo.addAdjustmentLog({
      id: uuidv4(),
      timesheetId: id,
      date,
      action: 'reverted',
      previousMinutes,
      newMinutes: entry.worked_minutes,
      reason: '',
      actorEmail,
    });

    this.logger.info({ timesheetId: id, date, actorEmail }, 'Timesheet day adjustment reverted');
    return { success: true };
  }

  // ── Authorization ──

  /** Admins, HR, the owner's reporting manager, or an assigned manager may decide. */
  async canApprove(actorEmail: string, ownerEmail: string): Promise<boolean> {
    if (!actorEmail) return false;
    if (actorEmail === ownerEmail) return false;
    if (await this.repo.isAdmin(actorEmail)) return true;

    const owner = await this.repo.getMember(ownerEmail);
    if (owner?.reports_to && owner.reports_to === actorEmail) return true;

    if (await this.repo.hasManagerAssignment(actorEmail, ownerEmail)) return true;
    return this.repo.hasHrAssignment(actorEmail);
  }

  async isAdmin(email: string): Promise<boolean> {
    return this.repo.isAdmin(email);
  }

  // ── Notifications ──

  private async notifyApprover(ts: TimesheetRow): Promise<void> {
    if (!this.dispatcher) return;
    const owner = await this.repo.getMember(ts.email);
    if (!owner?.reports_to) return;
    const manager = await this.repo.getMember(owner.reports_to);
    if (!manager) return;
    await this.dispatcher.notify({
      eventType: 'timesheet:submitted',
      entityType: 'timesheet',
      entityId: ts.id,
      recipients: [{ email: manager.email, name: manager.name, role: 'approver' }],
      data: {
        timesheetId: ts.id,
        employee: ts.name || ts.email,
        periodType: ts.period_type,
        startDate: ts.start_date,
        endDate: ts.end_date,
      },
    });
  }

  private async notifyOwner(ts: TimesheetRow, event: string, reason?: string): Promise<void> {
    if (!this.dispatcher) return;
    const owner = await this.repo.getMember(ts.email);
    if (!owner) return;
    await this.dispatcher.notify({
      eventType: `timesheet:${event}`,
      entityType: 'timesheet',
      entityId: ts.id,
      recipients: [{ email: owner.email, name: owner.name, role: 'owner' }],
      data: {
        timesheetId: ts.id,
        periodType: ts.period_type,
        startDate: ts.start_date,
        endDate: ts.end_date,
        status: event,
        reason: reason ?? '',
      },
    });
  }

  // ── Private: build daily entries from raw data ──

  private async buildEntries(
    timesheetId: string,
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<{
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
    };
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
    }>;
  }> {
    // Pull all raw data in parallel
    const [attendance, leaves, ot, timeEntries, mandatoryHolidays, selectedHolidays] =
      await Promise.all([
        this.repo.getAttendanceForRange(email, startDate, endDate),
        this.repo.getApprovedLeavesForRange(email, startDate, endDate),
        this.repo.getApprovedOtForRange(email, startDate, endDate),
        this.repo.getTimeEntriesForRange(email, startDate, endDate),
        this.repo.getMandatoryHolidaysForRange(startDate, endDate),
        this.repo.getSelectedHolidaysForRange(email, startDate, endDate),
      ]);

    // Index raw data by date for O(1) lookups
    const attendanceByDate = new Map<string, AttendanceDayRow>();
    for (const row of attendance) attendanceByDate.set(row.date, row);

    const otByDate = new Map<string, { minutes: number; pay: number }>();
    for (const row of ot) {
      const existing = otByDate.get(row.date) ?? { minutes: 0, pay: 0 };
      existing.minutes += row.ot_minutes;
      existing.pay += row.ot_pay;
      otByDate.set(row.date, existing);
    }

    const timeByDate = new Map<string, { billable: number; nonBillable: number }>();
    for (const row of timeEntries) {
      const existing = timeByDate.get(row.date) ?? { billable: 0, nonBillable: 0 };
      if (row.billable) {
        existing.billable += row.hours;
      } else {
        existing.nonBillable += row.hours;
      }
      timeByDate.set(row.date, existing);
    }

    const allHolidays: HolidayAggRow[] = [...mandatoryHolidays, ...selectedHolidays];
    const holidayDates = new Set<string>(allHolidays.map((h) => h.date));

    // Build per-day entries
    const dates = enumerateDates(startDate, endDate);
    const entries: Array<{
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
    }> = [];

    let totalWorkedMinutes = 0;
    let totalBreakMinutes = 0;
    let totalPresentDays = 0;
    let totalAbsentDays = 0;
    let totalLeaveDays = 0;
    let totalHolidayDays = 0;
    let totalLateDays = 0;
    let totalOtMinutes = 0;
    let totalOtPay = 0;
    let totalBillableHours = 0;
    let totalNonBillableHours = 0;

    for (const dateStr of dates) {
      const weekend = isWeekend(dateStr);
      const isHoliday = holidayDates.has(dateStr);
      const leaveCoverage = checkLeaveCoverage(dateStr, leaves);
      const att = attendanceByDate.get(dateStr);
      const otData = otByDate.get(dateStr);
      const timeData = timeByDate.get(dateStr);

      // Determine day type (priority: holiday > leave > weekend > workday)
      let dayType: string;
      if (isHoliday) {
        dayType = 'holiday';
        totalHolidayDays++;
      } else if (leaveCoverage.covered && leaveCoverage.leaveDays >= 1) {
        dayType = 'leave';
        totalLeaveDays += leaveCoverage.leaveDays;
      } else if (weekend) {
        dayType = 'weekend';
      } else {
        dayType = 'workday';
      }

      // Attendance status from the daily record
      const attendanceStatus = att?.status ?? '';
      const workedMinutes = att?.total_worked_minutes ?? 0;
      const breakMinutes = att?.total_break_minutes ?? 0;
      const isLate = att?.is_late ?? 0;
      const lateMinutes = att?.late_minutes ?? 0;

      // Half-day leave on a workday: still counts partial leave
      let leaveDays = 0;
      let leaveType = '';
      if (leaveCoverage.covered) {
        leaveDays = leaveCoverage.leaveDays;
        leaveType = leaveCoverage.leaveType;
        if (dayType === 'workday' && leaveDays === 0.5) {
          totalLeaveDays += 0.5;
        }
      }

      // Track present/absent for workdays
      if (dayType === 'workday' && !leaveCoverage.covered) {
        if (att && (att.status === 'in' || att.status === 'out' || att.status === 'break')) {
          totalPresentDays++;
        } else if (att && att.status === 'absent') {
          totalAbsentDays++;
        } else if (!att) {
          // No attendance record at all on a workday = absent
          totalAbsentDays++;
        }
      } else if (dayType === 'workday' && leaveCoverage.covered && leaveCoverage.leaveDays === 0.5) {
        // Half-day leave: could still be present for half
        if (att && (att.status === 'in' || att.status === 'out' || att.status === 'break')) {
          totalPresentDays++;
        }
      }

      // OT
      const otMinutes = otData?.minutes ?? 0;
      const otPay = otData?.pay ?? 0;

      // Time entries (project billing)
      const billableHours = timeData?.billable ?? 0;
      const nonBillableHours = timeData?.nonBillable ?? 0;

      // Late
      if (isLate) totalLateDays++;

      // Accumulate totals
      totalWorkedMinutes += workedMinutes;
      totalBreakMinutes += breakMinutes;
      totalOtMinutes += otMinutes;
      totalOtPay += otPay;
      totalBillableHours += billableHours;
      totalNonBillableHours += nonBillableHours;

      entries.push({
        timesheetId,
        date: dateStr,
        dayType,
        attendanceStatus,
        workedMinutes,
        breakMinutes,
        isLate,
        lateMinutes,
        otMinutes,
        otPay,
        leaveType,
        leaveDays,
        billableHours,
        nonBillableHours,
      });
    }

    return {
      totals: {
        totalWorkedMinutes,
        totalBreakMinutes,
        totalPresentDays,
        totalAbsentDays,
        totalLeaveDays,
        totalHolidayDays,
        totalLateDays,
        totalOtMinutes,
        totalOtPay,
        totalBillableHours,
        totalNonBillableHours,
      },
      entries,
    };
  }
}
