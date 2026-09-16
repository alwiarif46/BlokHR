import type { Logger } from 'pino';
import { v4 as uuidv4 } from 'uuid';
import type {
  OtPolicyConfig,
  OvertimeRepository,
  OvertimeRequestRow,
  OvertimeRow,
} from '../repositories/overtime-repository';
import type { AttendanceClient } from '../clients/attendance-client';
import type { HolidaysClient } from '../clients/holidays-client';
import type {
  MembersClient,
  MemberCompensation,
} from '../clients/members-client';
import type { EventPublisher } from '../events';
import { calculateOvertimeIndia } from '../formula';

export interface OvertimeView {
  id: number;
  tenantId: string;
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

export interface OvertimeRequestView {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  date: string;
  plannedHours: number;
  reason: string;
  status: string;
  approvedBy: string;
  rejectionReason: string;
  createdAt: string;
  updatedAt: string;
}

export type Ok<T> = { success: true } & T;
export type Fail = { success: false; error: string; code?: string };

export class OvertimeService {
  constructor(
    private readonly repo: OvertimeRepository,
    private readonly logger: Logger,
    private readonly attendance: AttendanceClient,
    private readonly holidays: HolidaysClient,
    private readonly members: MembersClient,
    private readonly events: EventPublisher,
  ) {}

  // ─── policy ──────────────────────────────────────────────────────

  async getPolicy(tenantId: string): Promise<OtPolicyConfig> {
    return this.repo.getPolicy(tenantId);
  }

  async updatePolicy(
    tenantId: string,
    patch: Partial<OtPolicyConfig>,
  ): Promise<OtPolicyConfig> {
    return this.repo.upsertPolicy(tenantId, patch);
  }

  // ─── detect / manual log ─────────────────────────────────────────

  async detectForDate(
    tenantId: string,
    date: string,
  ): Promise<{ detected: number; skipped: number; errors: string[] }> {
    const policy = await this.repo.getPolicy(tenantId);
    if (!policy.otEnabled) return { detected: 0, skipped: 0, errors: [] };

    const attendance = await this.attendance.getDailyForDate(tenantId, date);
    if (attendance.length === 0) return { detected: 0, skipped: 0, errors: [] };

    const memberIndex = await this.buildMemberIndex(tenantId);
    const isHoliday = await this.holidays.isMandatoryHoliday(tenantId, date);
    const dayOfWeek = new Date(date + 'T00:00:00').getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    let detected = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const record of attendance) {
      try {
        const member = memberIndex.get(record.email.toLowerCase());
        if (!member) {
          skipped++;
          continue;
        }

        const otType = otTypeFor({ isHoliday, isWeekend });
        if (policy.requiresPriorApproval) {
          const approved = await this.repo.findApprovedRequest(
            tenantId,
            record.email,
            date,
          );
          if (!approved) {
            skipped++;
            continue;
          }
        }

        const standardMinutes = calcShiftMinutes(member.shiftStart, member.shiftEnd);
        const worked = record.totalWorkedMinutes;

        let otMinutes: number;
        if (isWeekend || isHoliday) {
          otMinutes = worked;
        } else {
          otMinutes = Math.max(0, worked - policy.dailyThresholdMinutes);
        }
        if (otMinutes <= 0) {
          skipped++;
          continue;
        }
        if (policy.maxDailyMinutes > 0 && otType === 'weekday') {
          otMinutes = Math.min(otMinutes, policy.maxDailyMinutes);
        }
        if (policy.maxQuarterlyHours > 0) {
          const quarterlyUsed = await this.repo.getQuarterlyTotalMinutes(
            tenantId,
            record.email,
            date,
          );
          const quarterlyLimitMinutes = policy.maxQuarterlyHours * 60;
          const remaining = Math.max(0, quarterlyLimitMinutes - quarterlyUsed);
          if (remaining <= 0) {
            skipped++;
            continue;
          }
          otMinutes = Math.min(otMinutes, remaining);
        }

        const multiplier =
          otType === 'holiday' ? policy.holidayMultiplier : policy.multiplier;
        const pay = this.pricePay({
          member,
          standardMinutes,
          otMinutes,
          otType,
          policy,
        });

        const row = await this.repo.upsert({
          tenantId,
          email: record.email,
          date,
          shiftStart: member.shiftStart,
          shiftEnd: member.shiftEnd,
          actualWorkedMinutes: worked,
          standardMinutes,
          otMinutes,
          otType,
          hourlyRate: pay.hourlyRate,
          multiplier,
          otPay: pay.otPay,
          source: 'auto',
        });
        await this.publish('overtime.detected', tenantId, {
          recordId: row.id,
          email: row.email,
          date: row.date,
          otMinutes: row.ot_minutes,
          otType: row.ot_type,
          source: 'auto',
        });
        detected++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        errors.push(`${record.email}: ${msg}`);
        this.logger.error({ err, email: record.email }, 'OT detection error');
      }
    }
    this.logger.info(
      { tenantId, date, detected, skipped, checked: attendance.length },
      'OT detection completed',
    );
    return { detected, skipped, errors };
  }

  async logManual(input: {
    tenantId: string;
    email: string;
    date: string;
    otMinutes: number;
    otType?: string;
  }): Promise<Ok<{ record: OvertimeView }> | Fail> {
    if (!input.email) return { success: false, error: 'Email is required' };
    if (!input.date) return { success: false, error: 'Date is required' };
    if (!input.otMinutes || input.otMinutes <= 0) {
      return { success: false, error: 'OT minutes must be positive' };
    }
    const policy = await this.repo.getPolicy(input.tenantId);
    if (!policy.otEnabled) {
      return { success: false, error: 'Overtime is disabled for this tenant', code: 'ot_disabled' };
    }
    const otType = input.otType ?? 'weekday';
    if (!['weekday', 'weekend', 'holiday'].includes(otType)) {
      return { success: false, error: 'Invalid OT type' };
    }

    if (policy.requiresPriorApproval) {
      const approved = await this.repo.findApprovedRequest(
        input.tenantId,
        input.email,
        input.date,
      );
      if (!approved) {
        return {
          success: false,
          error: 'Prior OT approval required for this date',
          code: 'prior_approval_required',
        };
      }
    }

    if (
      policy.maxDailyMinutes > 0 &&
      otType === 'weekday' &&
      input.otMinutes > policy.maxDailyMinutes
    ) {
      return {
        success: false,
        error: `Weekday OT cannot exceed ${policy.maxDailyMinutes} minutes per day`,
        code: 'daily_cap',
      };
    }

    if (policy.maxQuarterlyHours > 0) {
      const quarterlyUsed = await this.repo.getQuarterlyTotalMinutes(
        input.tenantId,
        input.email,
        input.date,
      );
      const quarterlyLimitMinutes = policy.maxQuarterlyHours * 60;
      const remaining = Math.max(0, quarterlyLimitMinutes - quarterlyUsed);
      if (input.otMinutes > remaining) {
        const remainingHours = Math.round((remaining / 60) * 100) / 100;
        return {
          success: false,
          error: `Quarterly OT cap reached. Only ${remainingHours} hours remaining this quarter`,
          code: 'quarterly_cap',
        };
      }
    }

    const member = await this.resolveMember(input.tenantId, input.email);
    const shiftStart = member?.shiftStart ?? '09:00';
    const shiftEnd = member?.shiftEnd ?? '18:00';
    const standardMinutes = calcShiftMinutes(shiftStart, shiftEnd);
    const multiplier =
      otType === 'holiday' ? policy.holidayMultiplier : policy.multiplier;
    const pay = member
      ? this.pricePay({
          member,
          standardMinutes,
          otMinutes: input.otMinutes,
          otType,
          policy,
        })
      : { otPay: 0, hourlyRate: 0 };

    const row = await this.repo.upsert({
      tenantId: input.tenantId,
      email: input.email,
      date: input.date,
      shiftStart,
      shiftEnd,
      actualWorkedMinutes: standardMinutes + input.otMinutes,
      standardMinutes,
      otMinutes: input.otMinutes,
      otType,
      hourlyRate: pay.hourlyRate,
      multiplier,
      otPay: pay.otPay,
      source: 'manual',
    });
    await this.publish('overtime.detected', input.tenantId, {
      recordId: row.id,
      email: row.email,
      date: row.date,
      otMinutes: row.ot_minutes,
      otType: row.ot_type,
      source: 'manual',
    });
    return { success: true, record: toView(row) };
  }

  async getByEmail(
    tenantId: string,
    email: string,
    startDate?: string,
    endDate?: string,
  ): Promise<OvertimeView[]> {
    const rows = await this.repo.getByEmail(tenantId, email, startDate, endDate);
    return rows.map(toView);
  }

  async getPending(tenantId: string): Promise<OvertimeView[]> {
    const rows = await this.repo.getPending(tenantId);
    return rows.map(toView);
  }

  async approve(
    tenantId: string,
    id: number,
    approverEmail: string,
  ): Promise<Ok<{ record: OvertimeView }> | Fail> {
    const existing = await this.repo.getById(tenantId, id);
    if (!existing) return { success: false, error: 'OT record not found' };
    if (existing.status !== 'pending') {
      return { success: false, error: 'Only pending OT can be approved' };
    }
    await this.repo.approve(tenantId, id, approverEmail);
    await this.publish('overtime.approved', tenantId, {
      recordId: id,
      email: existing.email,
      date: existing.date,
      otMinutes: existing.ot_minutes,
      otType: existing.ot_type,
      approverEmail,
    });
    const updated = await this.repo.getById(tenantId, id);
    return { success: true, record: toView(updated ?? existing) };
  }

  async reject(
    tenantId: string,
    id: number,
    approverEmail: string,
    reason: string,
  ): Promise<Ok<{ record: OvertimeView }> | Fail> {
    const existing = await this.repo.getById(tenantId, id);
    if (!existing) return { success: false, error: 'OT record not found' };
    if (existing.status !== 'pending') {
      return { success: false, error: 'Only pending OT can be rejected' };
    }
    await this.repo.reject(tenantId, id, approverEmail, reason);
    await this.publish('overtime.rejected', tenantId, {
      recordId: id,
      email: existing.email,
      date: existing.date,
      otMinutes: existing.ot_minutes,
      otType: existing.ot_type,
      approverEmail,
      reason,
    });
    const updated = await this.repo.getById(tenantId, id);
    return { success: true, record: toView(updated ?? existing) };
  }

  async getSummary(
    tenantId: string,
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
    const raw = await this.repo.getSummary(tenantId, email, startDate, endDate);
    return {
      ...raw,
      totalOtHours: Math.round((raw.totalOtMinutes / 60) * 100) / 100,
    };
  }

  // ─── requests ────────────────────────────────────────────────────

  async createRequest(input: {
    tenantId: string;
    email: string;
    name?: string;
    date: string;
    plannedHours: number;
    reason?: string;
  }): Promise<Ok<{ request: OvertimeRequestView }> | Fail> {
    if (!input.email) return { success: false, error: 'Email is required' };
    if (!input.date) return { success: false, error: 'Date is required' };
    if (!input.plannedHours || input.plannedHours <= 0) {
      return { success: false, error: 'Planned hours must be positive' };
    }
    const row = await this.repo.createRequest({
      id: uuidv4(),
      tenantId: input.tenantId,
      email: input.email,
      name: input.name ?? '',
      date: input.date,
      plannedHours: input.plannedHours,
      reason: input.reason ?? '',
    });
    return { success: true, request: toRequestView(row) };
  }

  async listRequests(
    tenantId: string,
    filters: { email?: string; status?: string } = {},
  ): Promise<OvertimeRequestView[]> {
    const rows = await this.repo.listRequests(tenantId, filters);
    return rows.map(toRequestView);
  }

  async approveRequest(
    tenantId: string,
    id: string,
    approverEmail: string,
  ): Promise<Ok<{ request: OvertimeRequestView }> | Fail> {
    const existing = await this.repo.getRequestById(tenantId, id);
    if (!existing) return { success: false, error: 'OT request not found' };
    if (existing.status !== 'pending') {
      return { success: false, error: 'Only pending requests can be approved' };
    }
    await this.repo.approveRequest(tenantId, id, approverEmail);
    const updated = await this.repo.getRequestById(tenantId, id);
    return { success: true, request: toRequestView(updated ?? existing) };
  }

  async rejectRequest(
    tenantId: string,
    id: string,
    approverEmail: string,
    reason: string,
  ): Promise<Ok<{ request: OvertimeRequestView }> | Fail> {
    const existing = await this.repo.getRequestById(tenantId, id);
    if (!existing) return { success: false, error: 'OT request not found' };
    if (existing.status !== 'pending') {
      return { success: false, error: 'Only pending requests can be rejected' };
    }
    await this.repo.rejectRequest(tenantId, id, approverEmail, reason);
    const updated = await this.repo.getRequestById(tenantId, id);
    return { success: true, request: toRequestView(updated ?? existing) };
  }

  // ─── compensation cache maintenance ──────────────────────────────

  async upsertCompensation(row: {
    tenantId: string;
    email: string;
    basicSalary: number;
    da: number;
    shiftStart: string;
    shiftEnd: string;
    name?: string;
  }): Promise<void> {
    await this.repo.upsertCompensation({
      tenantId: row.tenantId,
      email: row.email,
      basicSalary: row.basicSalary,
      da: row.da,
      shiftStart: row.shiftStart,
      shiftEnd: row.shiftEnd,
      name: row.name ?? '',
    });
  }

  // ─── internals ───────────────────────────────────────────────────

  private async buildMemberIndex(
    tenantId: string,
  ): Promise<Map<string, MemberCompensation>> {
    const index = new Map<string, MemberCompensation>();
    const cached = await this.repo.listCompensation(tenantId);
    for (const r of cached) {
      index.set(r.email.toLowerCase(), {
        email: r.email,
        name: r.name,
        basicSalary: Number(r.basic_salary ?? 0),
        da: Number(r.da ?? 0),
        shiftStart: r.shift_start || '09:00',
        shiftEnd: r.shift_end || '18:00',
      });
    }
    if (index.size === 0) {
      const upstream = await this.members.listAllForTenant(tenantId);
      for (const m of upstream) index.set(m.email.toLowerCase(), m);
    }
    return index;
  }

  private async resolveMember(
    tenantId: string,
    email: string,
  ): Promise<MemberCompensation | null> {
    const cached = await this.repo.getCompensation(tenantId, email);
    if (cached) {
      return {
        email: cached.email,
        name: cached.name,
        basicSalary: Number(cached.basic_salary ?? 0),
        da: Number(cached.da ?? 0),
        shiftStart: cached.shift_start || '09:00',
        shiftEnd: cached.shift_end || '18:00',
      };
    }
    return this.members.getCompensation(tenantId, email);
  }

  private pricePay(args: {
    member: MemberCompensation;
    standardMinutes: number;
    otMinutes: number;
    otType: string;
    policy: OtPolicyConfig;
  }): { otPay: number; hourlyRate: number } {
    if (!args.member.basicSalary || args.member.basicSalary <= 0) {
      return { otPay: 0, hourlyRate: 0 };
    }
    const result = calculateOvertimeIndia({
      basicSalary: args.member.basicSalary,
      dearnessAllowance: args.member.da,
      workingDaysPerMonth: 26,
      hoursPerDay: Math.max(1, Math.round(args.standardMinutes / 60)),
      overtimeHours: args.otMinutes / 60,
      isHoliday: args.otType === 'holiday',
      holidayMultiplier: args.policy.holidayMultiplier,
    });
    return { otPay: result.otPay, hourlyRate: result.hourlyRate };
  }

  private async publish(
    type: string,
    tenantId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    try {
      await this.events.publish({
        type,
        tenantId,
        occurredAt: new Date().toISOString(),
        data,
      });
    } catch (err) {
      this.logger.warn({ err, type }, 'overtime_event_publish_failed');
    }
  }
}

function otTypeFor(flags: { isHoliday: boolean; isWeekend: boolean }): string {
  if (flags.isHoliday) return 'holiday';
  if (flags.isWeekend) return 'weekend';
  return 'weekday';
}

function calcShiftMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(':').map((v) => Number(v));
  const [eh, em] = end.split(':').map((v) => Number(v));
  const s = (sh || 0) * 60 + (sm || 0);
  let e = (eh || 0) * 60 + (em || 0);
  if (e <= s) e += 1440;
  return e - s;
}

function toView(r: OvertimeRow): OvertimeView {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    email: r.email,
    date: r.date,
    shiftStart: r.shift_start,
    shiftEnd: r.shift_end,
    actualWorkedMinutes: Number(r.actual_worked_minutes),
    standardMinutes: Number(r.standard_minutes),
    otMinutes: Number(r.ot_minutes),
    otHours: Math.round((Number(r.ot_minutes) / 60) * 100) / 100,
    otType: r.ot_type,
    hourlyRate: Number(r.hourly_rate),
    multiplier: Number(r.multiplier),
    otPay: Number(r.ot_pay),
    source: r.source,
    status: r.status,
    approvedBy: r.approved_by,
    rejectionReason: r.rejection_reason,
  };
}

function toRequestView(r: OvertimeRequestRow): OvertimeRequestView {
  return {
    id: r.id,
    tenantId: r.tenant_id,
    email: r.email,
    name: r.name,
    date: r.date,
    plannedHours: Number(r.planned_hours),
    reason: r.reason,
    status: r.status,
    approvedBy: r.approved_by,
    rejectionReason: r.rejection_reason,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}
