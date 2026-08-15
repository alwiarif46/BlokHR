import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { MemberShiftInfo, ClockRepository } from '../repositories/clock-repository';
import type { SseBroadcaster } from '../sse/broadcaster';

/** Scheduler settings from system_settings table. */
interface SchedulerConfig {
  autoCutoffEnabled: boolean;
  autoCutoffBufferMinutes: number;
  autoCutoffCreditMode: string;
  absenceMarkingEnabled: boolean;
  ptoAccrualDay: number;
  reminderIntervalHours: number;
  logicalDayChangeTime: string;
}

interface GroupRow {
  [key: string]: unknown;
  id: string;
  cutoff_buffer_minutes: number;
}

interface AttendanceRow {
  [key: string]: unknown;
  email: string;
  name: string;
  date: string;
  status: string;
  first_in: string;
  group_id: string;
  total_worked_minutes: number;
}

/**
 * Scheduler Service — runs periodic jobs for attendance management.
 *
 * Jobs:
 *   1. autoCutoff()      — Clocks out employees still "in" or "break" past their shift + buffer.
 *                           Per-employee shift resolution. Credits hours to shift end only.
 *   2. markAbsences()    — At logical day change, marks employees who never clocked in as "absent".
 *   3. accruePto()       — Monthly PTO accrual based on leave policies + tenure.
 *   4. sendReminders()   — Periodic reminders for pending approvals.
 *
 * The scheduler itself (setInterval/cron) is external — this service provides the job functions.
 */
export class SchedulerService {
  constructor(
    private readonly db: DatabaseEngine,
    private readonly clockRepo: ClockRepository,
    private readonly broadcaster: SseBroadcaster | null,
    private readonly logger: Logger,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  1. AUTO-CUTOFF — shift-aware per-employee
  // ═══════════════════════════════════════════════════════════════

  /**
   * Find all employees still clocked in/on break past their shift end + buffer,
   * and auto-clock them out. Credits worked hours up to shift end time.
   *
   * All shift times are in the member's timezone (default Asia/Kolkata).
   * The logical day determines which record date to check.
   * Cutoff threshold = shiftEnd + buffer, resolved as absolute UTC timestamp.
   *
   * Returns the number of employees cut off.
   */
  async autoCutoff(now?: Date): Promise<{ cutoffCount: number; errors: string[] }> {
    const config = await this.getConfig();
    if (!config.autoCutoffEnabled) {
      return { cutoffCount: 0, errors: [] };
    }

    const currentTime = now ?? new Date();

    // Query active records from the last 2 calendar days (covers overnight shifts)
    const utcToday = currentTime.toISOString().split('T')[0];
    const utcYesterday = new Date(currentTime.getTime() - 86400000).toISOString().split('T')[0];

    const activeRecords = await this.db.all<AttendanceRow>(
      `SELECT * FROM attendance_daily
       WHERE status IN ('in', 'break')
         AND date IN (?, ?)`,
      [utcToday, utcYesterday],
    );

    if (activeRecords.length === 0) {
      return { cutoffCount: 0, errors: [] };
    }

    const groupBuffers = await this.getGroupBuffers();
    const allMembers = await this.clockRepo.getAllActiveMembersWithShifts();
    const memberMap = new Map<string, MemberShiftInfo>();
    for (const m of allMembers) {
      memberMap.set(m.email.toLowerCase(), m);
    }

    let cutoffCount = 0;
    const errors: string[] = [];

    for (const record of activeRecords) {
      try {
        const memberInfo = memberMap.get(record.email.toLowerCase());
        if (!memberInfo) continue;

        const tz = memberInfo.timezone || 'Asia/Kolkata';
        const tzOffset = this.getTzOffsetMinutes(tz, currentTime);

        // Resolve this employee's shift
        const shiftEnd = memberInfo.individual_shift_end ?? memberInfo.group_shift_end ?? '18:00';
        const shiftStart =
          memberInfo.individual_shift_start ?? memberInfo.group_shift_start ?? '09:00';
        const shiftEndMin = this.timeToMinutes(shiftEnd);
        const shiftStartMin = this.timeToMinutes(shiftStart);
        const isOvernight = shiftEndMin <= shiftStartMin;

        // Resolve buffer: group → global
        const groupBuffer = memberInfo.group_id ? groupBuffers.get(memberInfo.group_id) : undefined;
        const bufferMinutes = groupBuffer ?? config.autoCutoffBufferMinutes;

        // Build absolute UTC cutoff threshold from logical date + shift + TZ
        const cutoffThreshold = this.shiftTimeToUtc(
          record.date,
          shiftEndMin + bufferMinutes,
          isOvernight,
          tzOffset,
        );

        if (currentTime < cutoffThreshold) continue;

        // Credit hours up to shift end (not cutoff time)
        const shiftEndUtc = this.shiftTimeToUtc(record.date, shiftEndMin, isOvernight, tzOffset);
        const firstIn = record.first_in ? new Date(record.first_in) : null;
        let creditedMinutes = record.total_worked_minutes;

        if (firstIn && config.autoCutoffCreditMode === 'shift_end') {
          const diff = (shiftEndUtc.getTime() - firstIn.getTime()) / 60000;
          creditedMinutes = Math.max(0, Math.round(diff));
        }

        // Auto clock out — timestamp is shift end, not now
        await this.db.run(
          `UPDATE attendance_daily SET
             status = 'out',
             status_source = 'auto-cutoff',
             last_out = ?,
             total_worked_minutes = ?,
             updated_at = datetime('now')
           WHERE email = ? AND date = ?`,
          [shiftEndUtc.toISOString(), creditedMinutes, record.email, record.date],
        );

        await this.db.run(
          `INSERT INTO clock_events (email, date, event_type, event_time, source)
           VALUES (?, ?, 'out', ?, 'auto-cutoff')`,
          [record.email, record.date, shiftEndUtc.toISOString()],
        );

        cutoffCount++;
        this.logger.info(
          { email: record.email, date: record.date, shiftEnd, bufferMinutes, creditedMinutes },
          'Auto-cutoff applied',
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${record.email}: ${msg}`);
        this.logger.error({ err, email: record.email }, 'Auto-cutoff error for employee');
      }
    }

    if (cutoffCount > 0 && this.broadcaster) {
      this.broadcaster.broadcast('attendance-update');
    }

    this.logger.info(
      { cutoffCount, checked: activeRecords.length, errors: errors.length },
      'Auto-cutoff job completed',
    );

    return { cutoffCount, errors };
  }

  // ═══════════════════════════════════════════════════════════════
  //  2. ABSENCE MARKING
  // ═══════════════════════════════════════════════════════════════

  /**
   * Mark employees who never clocked in today as "absent".
   * Runs at logical day change time (default 06:00 — marks YESTERDAY as absent).
   *
   * Only marks active members who have no attendance_daily record for the date,
   * and who are not on approved leave.
   */
  async markAbsences(forDate?: string): Promise<{ absentCount: number }> {
    const config = await this.getConfig();
    if (!config.absenceMarkingEnabled) {
      return { absentCount: 0 };
    }

    const date = forDate ?? this.toDateString(new Date(Date.now() - 86400000));

    // Skip if the date is a mandatory holiday — nobody should be marked absent
    const isMandatory = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM holidays WHERE date = ? AND type = 'mandatory' AND active = 1",
      [date],
    );
    if ((isMandatory?.cnt ?? 0) > 0) {
      this.logger.info({ date }, 'Skipping absence marking — mandatory holiday');
      return { absentCount: 0 };
    }

    // Get all active members
    const allMembers = await this.db.all<{
      email: string;
      name: string;
      group_id: string;
      [key: string]: unknown;
    }>('SELECT email, name, group_id FROM members WHERE active = 1');

    // Get emails that already have attendance for this date
    const attended = await this.db.all<{ email: string; [key: string]: unknown }>(
      'SELECT email FROM attendance_daily WHERE date = ?',
      [date],
    );
    const attendedSet = new Set(attended.map((r) => r.email.toLowerCase()));

    // Get emails on approved leave for this date
    const onLeave = await this.db.all<{ person_email: string; [key: string]: unknown }>(
      `SELECT person_email FROM leave_requests
       WHERE status IN ('Approved', 'Approved by Manager')
         AND start_date <= ? AND end_date >= ?`,
      [date, date],
    );
    const leaveSet = new Set(onLeave.map((r) => r.person_email.toLowerCase()));

    let absentCount = 0;
    for (const member of allMembers) {
      const email = member.email.toLowerCase();
      if (attendedSet.has(email) || leaveSet.has(email)) continue;

      await this.db.run(
        `INSERT OR IGNORE INTO attendance_daily
           (email, name, date, status, status_source, group_id, total_worked_minutes,
            is_late, late_minutes, created_at, updated_at)
         VALUES (?, ?, ?, 'absent', 'auto', ?, 0, 0, 0, datetime('now'), datetime('now'))`,
        [member.email, member.name, date, member.group_id ?? ''],
      );
      absentCount++;
    }

    if (absentCount > 0 && this.broadcaster) {
      this.broadcaster.broadcast('attendance-update');
    }

    this.logger.info(
      { date, absentCount, totalMembers: allMembers.length },
      'Absence marking completed',
    );
    return { absentCount };
  }

  // ═══════════════════════════════════════════════════════════════
  //  3. PTO ACCRUAL
  // ═══════════════════════════════════════════════════════════════

  /**
   * Monthly PTO accrual — runs on the configured day of month.
   * For each active member, reads their leave policies + tenure,
   * computes accrual via the accrual engine, and credits pto_balances.
   */
  async accruePto(forMonth?: number, forYear?: number): Promise<{ accrualCount: number }> {
    const now = new Date();
    const month = forMonth ?? now.getMonth() + 1;
    const year = forYear ?? now.getFullYear();

    // Get all active members with joining date
    const members = await this.db.all<{
      email: string;
      joining_date: string;
      member_type_id: string;
      [key: string]: unknown;
    }>(
      "SELECT email, joining_date, COALESCE(member_type_id, 'fte') as member_type_id FROM members WHERE active = 1",
    );

    // Get all active leave policies
    const policies = await this.db.all<{
      leave_type: string;
      member_type_id: string;
      method: string;
      config_json: string;
      probation_months: number;
      probation_accrual: number;
      probation_mode: string;
      [key: string]: unknown;
    }>('SELECT * FROM leave_policies WHERE active = 1');

    let accrualCount = 0;

    for (const member of members) {
      for (const policy of policies) {
        // Match member type
        if (policy.member_type_id !== member.member_type_id) continue;

        // Calculate monthly accrual based on method
        let monthlyAccrual = 0;

        const config = JSON.parse(policy.config_json || '{}') as Record<string, unknown>;
        const tenureM = this.calcTenureMonths(
          member.joining_date,
          `${year}-${String(month).padStart(2, '0')}-01`,
        );
        const inProbation = policy.probation_months > 0 && tenureM < policy.probation_months;

        if (inProbation) {
          const mode = policy.probation_mode ?? 'full';
          if (mode === 'no_accrual') continue;
          if (mode === 'reduced_rate') {
            monthlyAccrual = policy.probation_accrual ?? 0;
          } else {
            monthlyAccrual = this.resolveMonthlyRate(policy.method, config, tenureM);
          }
        } else {
          monthlyAccrual = this.resolveMonthlyRate(policy.method, config, tenureM);
        }

        if (monthlyAccrual <= 0) continue;

        // Upsert into pto_balances
        await this.db.run(
          `INSERT INTO pto_balances (email, leave_type, year, accrued, used, carry_forward, updated_at)
           VALUES (?, ?, ?, ?, 0, 0, datetime('now'))
           ON CONFLICT(email, leave_type, year) DO UPDATE SET
             accrued = accrued + ?,
             updated_at = datetime('now')`,
          [member.email, policy.leave_type, year, monthlyAccrual, monthlyAccrual],
        );

        accrualCount++;
      }
    }

    this.logger.info({ month, year, accrualCount }, 'PTO accrual completed');
    return { accrualCount };
  }

  // ═══════════════════════════════════════════════════════════════
  //  4. PENDING ACTION REMINDERS
  // ═══════════════════════════════════════════════════════════════

  /**
   * Count pending items and return summary for reminder dispatch.
   * The actual notification sending is delegated to the caller.
   */
  async getPendingReminders(): Promise<{
    pendingLeaves: number;
    pendingRegularizations: number;
    pendingBdMeetings: number;
    pendingProfiles: number;
    total: number;
  }> {
    const leaves = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM leave_requests WHERE status = 'Pending'",
    );
    const regs = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM regularizations WHERE status = 'pending'",
    );
    const bds = await this.db.get<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM bd_meetings WHERE status = 'pending'",
    );
    const profiles = await this.db.get<{ cnt: number }>(
      'SELECT COUNT(*) as cnt FROM members WHERE active = 1 AND certified_at IS NULL',
    );

    const result = {
      pendingLeaves: leaves?.cnt ?? 0,
      pendingRegularizations: regs?.cnt ?? 0,
      pendingBdMeetings: bds?.cnt ?? 0,
      pendingProfiles: profiles?.cnt ?? 0,
      total: 0,
    };
    result.total =
      result.pendingLeaves +
      result.pendingRegularizations +
      result.pendingBdMeetings +
      result.pendingProfiles;

    return result;
  }

  // ═══════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════

  private async getConfig(): Promise<SchedulerConfig> {
    const row = await this.db.get<{ [key: string]: unknown }>(
      'SELECT * FROM system_settings WHERE id = 1',
    );
    return {
      autoCutoffEnabled: (row?.auto_cutoff_enabled as number) === 1,
      autoCutoffBufferMinutes: (row?.auto_cutoff_buffer_minutes as number) ?? 120,
      autoCutoffCreditMode: (row?.auto_cutoff_credit_mode as string) ?? 'shift_end',
      absenceMarkingEnabled: (row?.absence_marking_enabled as number) === 1,
      ptoAccrualDay: (row?.pto_accrual_day as number) ?? 1,
      reminderIntervalHours: (row?.reminder_interval_hours as number) ?? 3,
      logicalDayChangeTime: (row?.logical_day_change_time as string) ?? '06:00',
    };
  }

  private async getGroupBuffers(): Promise<Map<string, number>> {
    const groups = await this.db.all<GroupRow>('SELECT id, cutoff_buffer_minutes FROM groups');
    const map = new Map<string, number>();
    for (const g of groups) {
      map.set(g.id, g.cutoff_buffer_minutes);
    }
    return map;
  }

  /** Convert "HH:MM" to minutes since midnight. */
  private timeToMinutes(time: string): number {
    const [h, m] = time.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  /** Convert a Date to YYYY-MM-DD string. */
  private toDateString(d: Date): string {
    return d.toISOString().split('T')[0];
  }

  /**
   * Convert a local shift time (minutes since midnight) on a logical date
   * to an absolute UTC timestamp.
   *
   * recordDate: logical date like '2026-03-20'
   * localMinutes: shift time in member's TZ (e.g. 1080 for 18:00)
   * isOvernight: if true, the time falls on the NEXT calendar day
   * tzOffsetMinutes: TZ offset from UTC (e.g. 330 for IST)
   *
   * Example (IST, shift end 18:00):
   *   base = 2026-03-20 00:00 UTC
   *   localMin = 1080
   *   utcMin = 1080 - 330 = 750
   *   result = 2026-03-20 12:30 UTC = 18:00 IST ✓
   */
  private shiftTimeToUtc(
    recordDate: string,
    localMinutes: number,
    isOvernight: boolean,
    tzOffsetMinutes: number,
  ): Date {
    const base = new Date(recordDate + 'T00:00:00.000Z');
    let adjustedMinutes = localMinutes - tzOffsetMinutes;
    if (isOvernight) {
      adjustedMinutes += 24 * 60;
    }
    return new Date(base.getTime() + adjustedMinutes * 60000);
  }

  /**
   * Get UTC offset in minutes for a timezone at a given reference time.
   * Returns positive for east of UTC (e.g. 330 for Asia/Kolkata).
   */
  private getTzOffsetMinutes(tz: string, refDate: Date): number {
    const utcStr = refDate.toLocaleString('en-US', { timeZone: 'UTC', hour12: false });
    const tzStr = refDate.toLocaleString('en-US', { timeZone: tz, hour12: false });
    const utcParsed = new Date(utcStr);
    const tzParsed = new Date(tzStr);
    return Math.round((tzParsed.getTime() - utcParsed.getTime()) / 60000);
  }

  /** Calculate tenure months between two date strings. */
  private calcTenureMonths(joiningDate: string, refDate: string): number {
    if (!joiningDate) return 0;
    const joined = new Date(joiningDate + 'T00:00:00');
    const ref = new Date(refDate + 'T00:00:00');
    if (isNaN(joined.getTime()) || isNaN(ref.getTime()) || ref < joined) return 0;
    const months =
      (ref.getFullYear() - joined.getFullYear()) * 12 + (ref.getMonth() - joined.getMonth());
    if (ref.getDate() < joined.getDate()) return Math.max(0, months - 1);
    return Math.max(0, months);
  }

  /** Resolve the monthly accrual rate for a given method + config + tenure. */
  private resolveMonthlyRate(
    method: string,
    config: Record<string, unknown>,
    tenureMonths: number,
  ): number {
    switch (method) {
      case 'flat':
        return (config.accrualPerMonth as number) ?? 0;
      case 'tenure_bucket': {
        const buckets = (config.buckets ?? []) as Array<{
          minMonths: number;
          maxMonths: number | null;
          accrualPerMonth: number;
        }>;
        for (const b of buckets) {
          if (tenureMonths >= b.minMonths && (b.maxMonths === null || tenureMonths < b.maxMonths)) {
            return b.accrualPerMonth;
          }
        }
        return 0;
      }
      case 'annual_lump':
        return ((config.annualDays as number) ?? 0) / 12;
      case 'tenure_linear': {
        const base = (config.basePerMonth as number) ?? 0;
        const increment = (config.incrementPerYear as number) ?? 0;
        const max = (config.maxPerMonth as number) ?? Infinity;
        return Math.min(base + increment * Math.floor(tenureMonths / 12), max);
      }
      case 'per_pay_period':
        return (config.daysPerPeriod as number) ?? 0;
      default:
        return 0;
    }
  }
}
