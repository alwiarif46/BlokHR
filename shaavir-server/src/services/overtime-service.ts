import type { Logger } from 'pino';
import type { DatabaseEngine } from '../db/engine';
import type { OvertimeRepository, OvertimeRow } from '../repositories/overtime-repository';
import type { ClockRepository, MemberShiftInfo } from '../repositories/clock-repository';
import { calculateOvertimeIndia } from '../formula';
import type { EventBus } from '../events';

export interface OvertimeView {
  id: number;
  email: string;
  date: string;
  shiftStart: string;
  shiftEnd: string;
  actualWorkedMinutes: number;
  standardMinutes: number;
  otMinutes: number;
  otHours: number;
  otType: string;
  hourlyRate: number;
  multiplier: number;
  otPay: number;
  source: string;
  status: string;
  approvedBy: string;
  rejectionReason: string;
}

export class OvertimeService {
  constructor(
    private readonly repo: OvertimeRepository,
    private readonly clockRepo: ClockRepository,
    private readonly db: DatabaseEngine,
    private readonly logger: Logger,
    private readonly eventBus?: EventBus,
  ) {}

  async detectForDate(date: string): Promise<{ detected: number; errors: string[] }> {
    const policy = await this.repo.getPolicy();
    if (!policy.otEnabled) return { detected: 0, errors: [] };

    const records = await this.db.all<{
      email: string;
      total_worked_minutes: number;
      [key: string]: unknown;
    }>("SELECT * FROM attendance_daily WHERE date = ? AND status = 'out'", [date]);

    const allMembers = await this.clockRepo.getAllActiveMembersWithShifts();
    const memberMap = new Map<string, MemberShiftInfo>();
    for (const m of allMembers) memberMap.set(m.email.toLowerCase(), m);

    const isHoliday =
      ((
        await this.db.get<{ cnt: number }>(
          "SELECT COUNT(*) as cnt FROM holidays WHERE date = ? AND type = 'mandatory' AND active = 1",
          [date],
        )
      )?.cnt ?? 0) > 0;

    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let detected = 0;
    const errors: string[] = [];

    for (const record of records) {
      try {
        const member = memberMap.get(record.email.toLowerCase());
        if (!member) continue;

        const shiftStart = member.individual_shift_start ?? member.group_shift_start ?? '09:00';
        const shiftEnd = member.individual_shift_end ?? member.group_shift_end ?? '18:00';
        const standardMinutes = this.calcShiftMinutes(shiftStart, shiftEnd);
        const worked = record.total_worked_minutes;

        let otType = 'weekday';
        let multiplier = policy.multiplier;
        if (isHoliday) {
          otType = 'holiday';
          multiplier = policy.holidayMultiplier;
        } else if (isWeekend) {
          otType = 'weekend';
          // Weekend uses same 2× as weekday by default — but explicitly set so
          // admin can change weekday multiplier without accidentally affecting weekends
          multiplier = policy.multiplier;
        }

        let otMinutes: number;
        if (isWeekend || isHoliday) {
          otMinutes = worked;
        } else {
          otMinutes = Math.max(0, worked - policy.dailyThresholdMinutes);
        }

        if (otMinutes <= 0) continue;
        // Daily cap only applies to weekday OT — weekend/holiday work is fully OT by definition
        if (policy.maxDailyMinutes > 0 && otType === 'weekday') {
          otMinutes = Math.min(otMinutes, policy.maxDailyMinutes);
        }

        // Quarterly cap (Factories Act: 125 hours default)
        if (policy.maxQuarterlyHours > 0) {
          const quarterlyUsed = await this.repo.getQuarterlyTotalMinutes(record.email, date);
          const quarterlyLimitMinutes = policy.maxQuarterlyHours * 60;
          const remaining = Math.max(0, quarterlyLimitMinutes - quarterlyUsed);
          if (remaining <= 0) continue; // Already at quarterly cap
          otMinutes = Math.min(otMinutes, remaining);
        }

        const salary = await this.db.get<{
          basic_salary: number;
          da: number;
          [key: string]: unknown;
        }>(
          'SELECT COALESCE(basic_salary, 0) as basic_salary, COALESCE(da, 0) as da FROM members WHERE email = ?',
          [record.email],
        );

        let otPay = 0;
        let hourlyRate = 0;
        if ((salary?.basic_salary ?? 0) > 0) {
          const result = calculateOvertimeIndia({
            basicSalary: salary?.basic_salary ?? 0,
            dearnessAllowance: salary?.da ?? 0,
            workingDaysPerMonth: 26,
            hoursPerDay: Math.max(1, Math.round(standardMinutes / 60)),
            overtimeHours: otMinutes / 60,
            isHoliday,
            holidayMultiplier: policy.holidayMultiplier,
          });
          otPay = result.otPay;
          hourlyRate = result.hourlyRate;
        }

        await this.repo.upsert({
          email: record.email,
          date,
          shiftStart,
          shiftEnd,
          actualWorkedMinutes: worked,
          standardMinutes,
          otMinutes,
          otType,
          hourlyRate,
          multiplier,
          otPay,
          source: 'auto',
        });

        detected++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${record.email}: ${msg}`);
        this.logger.error({ err, email: record.email }, 'OT detection error');
      }
    }

    this.logger.info({ date, detected, checked: records.length }, 'OT detection completed');
    return { detected, errors };
  }

  async logManual(data: {
    email: string;
    date: string;
    otMinutes: number;
    otType?: string;
  }): Promise<{ success: boolean; record?: OvertimeView; error?: string }> {
    if (!data.email) return { success: false, error: 'Email is required' };
    if (!data.date) return { success: false, error: 'Date is required' };
    if (!data.otMinutes || data.otMinutes <= 0)
      return { success: false, error: 'OT minutes must be positive' };

    const policy = await this.repo.getPolicy();
    const otType = data.otType ?? 'weekday';

    // Fix #3: Daily cap only applies to weekday — weekend/holiday is fully OT
    if (
      policy.maxDailyMinutes > 0 &&
      otType === 'weekday' &&
      data.otMinutes > policy.maxDailyMinutes
    ) {
      return {
        success: false,
        error: `Weekday OT cannot exceed ${policy.maxDailyMinutes} minutes per day`,
      };
    }

    // Fix #5: Quarterly cap enforcement on manual entries too
    if (policy.maxQuarterlyHours > 0) {
      const quarterlyUsed = await this.repo.getQuarterlyTotalMinutes(data.email, data.date);
      const quarterlyLimitMinutes = policy.maxQuarterlyHours * 60;
      const remaining = Math.max(0, quarterlyLimitMinutes - quarterlyUsed);
      if (data.otMinutes > remaining) {
        const remainingHours = Math.round((remaining / 60) * 100) / 100;
        return {
          success: false,
          error: `Quarterly OT cap reached. Only ${remainingHours} hours remaining this quarter`,
        };
      }
    }

    const member = await this.clockRepo.getMemberShiftInfo(data.email);
    const shiftStart = member?.individual_shift_start ?? member?.group_shift_start ?? '09:00';
    const shiftEnd = member?.individual_shift_end ?? member?.group_shift_end ?? '18:00';
    const standardMinutes = this.calcShiftMinutes(shiftStart, shiftEnd);

    // Fix #4: Weekend gets explicit multiplier treatment
    let multiplier: number;
    if (otType === 'holiday') {
      multiplier = policy.holidayMultiplier;
    } else {
      // Weekend and weekday both use policy.multiplier (2× default)
      multiplier = policy.multiplier;
    }

    // Fix #2: Calculate OT pay from salary using formula engine
    let otPay = 0;
    let hourlyRate = 0;
    const salary = await this.db.get<{
      basic_salary: number;
      da: number;
      [key: string]: unknown;
    }>(
      'SELECT COALESCE(basic_salary, 0) as basic_salary, COALESCE(da, 0) as da FROM members WHERE email = ?',
      [data.email],
    );
    if ((salary?.basic_salary ?? 0) > 0) {
      const result = calculateOvertimeIndia({
        basicSalary: salary?.basic_salary ?? 0,
        dearnessAllowance: salary?.da ?? 0,
        workingDaysPerMonth: 26,
        hoursPerDay: Math.max(1, Math.round(standardMinutes / 60)),
        overtimeHours: data.otMinutes / 60,
        isHoliday: otType === 'holiday',
        holidayMultiplier: policy.holidayMultiplier,
      });
      otPay = result.otPay;
      hourlyRate = result.hourlyRate;
    }

    const row = await this.repo.upsert({
      email: data.email,
      date: data.date,
      shiftStart,
      shiftEnd,
      actualWorkedMinutes: standardMinutes + data.otMinutes,
      standardMinutes,
      otMinutes: data.otMinutes,
      otType,
      hourlyRate,
      multiplier,
      otPay,
      source: 'manual',
    });

    this.logger.info(
      { email: data.email, date: data.date, otMinutes: data.otMinutes, otPay },
      'Manual OT logged',
    );
    this.eventBus?.emit('overtime.detected', { recordId: row.id, email: data.email, date: data.date, otMinutes: data.otMinutes, otType: data.otType || 'weekday' });
    return { success: true, record: this.toView(row) };
  }

  async getByEmail(email: string, startDate?: string, endDate?: string): Promise<OvertimeView[]> {
    const rows = await this.repo.getByEmail(email, startDate, endDate);
    return rows.map((r) => this.toView(r));
  }

  async getPending(): Promise<OvertimeView[]> {
    const rows = await this.repo.getPending();
    return rows.map((r) => this.toView(r));
  }

  async approve(id: number, approverEmail: string): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getById(id);
    if (!existing) return { success: false, error: 'OT record not found' };
    if (existing.status !== 'pending')
      return { success: false, error: 'Only pending OT can be approved' };
    await this.repo.approve(id, approverEmail);
    this.eventBus?.emit('overtime.approved', { recordId: id, email: existing.email, date: existing.date, otMinutes: existing.ot_minutes, otType: existing.ot_type, approverEmail });
    return { success: true };
  }

  async reject(
    id: number,
    approverEmail: string,
    reason: string,
  ): Promise<{ success: boolean; error?: string }> {
    const existing = await this.repo.getById(id);
    if (!existing) return { success: false, error: 'OT record not found' };
    if (existing.status !== 'pending')
      return { success: false, error: 'Only pending OT can be rejected' };
    await this.repo.reject(id, approverEmail, reason);
    this.eventBus?.emit('overtime.rejected', { recordId: id, email: existing.email, date: existing.date, otMinutes: existing.ot_minutes, otType: existing.ot_type, approverEmail, reason });
    return { success: true };
  }

  async getSummary(
    email: string,
    startDate: string,
    endDate: string,
  ): Promise<{
    totalOtMinutes: number;
    totalOtHours: number;
    totalOtPay: number;
    approvedOtMinutes: number;
    approvedOtPay: number;
    pendingCount: number;
  }> {
    const raw = await this.repo.getSummary(email, startDate, endDate);
    return { ...raw, totalOtHours: Math.round((raw.totalOtMinutes / 60) * 100) / 100 };
  }

  private calcShiftMinutes(start: string, end: string): number {
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    const s = sh * 60 + (sm || 0);
    let e = eh * 60 + (em || 0);
    if (e <= s) e += 1440;
    return e - s;
  }

  private toView(r: OvertimeRow): OvertimeView {
    return {
      id: r.id,
      email: r.email,
      date: r.date,
      shiftStart: r.shift_start,
      shiftEnd: r.shift_end,
      actualWorkedMinutes: r.actual_worked_minutes,
      standardMinutes: r.standard_minutes,
      otMinutes: r.ot_minutes,
      otHours: Math.round((r.ot_minutes / 60) * 100) / 100,
      otType: r.ot_type,
      hourlyRate: r.hourly_rate,
      multiplier: r.multiplier,
      otPay: r.ot_pay,
      source: r.source,
      status: r.status,
      approvedBy: r.approved_by,
      rejectionReason: r.rejection_reason,
    };
  }
}
