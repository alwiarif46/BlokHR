import { createHash } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { AttendanceRepository } from '../repositories/attendance-repository';
import type {
  AttendanceExcuse,
  AttendanceGranularity,
  AttendanceRecord,
  AttendanceSettings,
  AttendanceSource,
  AttendanceStatus,
  CaptureBinding,
  CaptureDecision,
  CaptureEvent,
  CaptureInput,
  CaptureModality,
  CaptureSubjectType,
  CreateCaptureBindingInput,
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  CreateReasonCodeInput,
  CreateReportedAbsenceInput,
  DayDerivation,
  DecideLeaveInput,
  EligibilityResult,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestState,
  LeaveType,
  MarkBatchInput,
  AttendanceMonthlyRollup,
  NudgeConfig,
  NudgeMessage,
  NudgeReport,
  NudgeRunInput,
  PatchLeaveTypeInput,
  PatchReasonCodeInput,
  PatchRecordInput,
  ReasonBucket,
  ReasonCode,
  RegularizeInput,
  ReportedAbsence,
  ReportedAbsenceChannel,
  SessionPart,
  StaffAttendance,
  StaffAttendanceSource,
  StaffAttendanceStatus,
  StaffBulkMarkInput,
  StaffCheckDirection,
  StaffCheckInput,
  StaffMonthReport,
  StaffMonthTotals,
  UpsertAttendanceSettingsInput,
  UpsertNudgeConfigInput,
} from '../types';
import {
  computeEligibilityProjection,
  computeMonth,
  countWeekdaysAfter,
  countWeekdaysInclusive,
  deriveDayPresent,
} from './attendance-stats';
import {
  assignCohort,
  classifyNudgeTier,
  isImproving,
  percentileOf,
} from './nudge-math';

type ServiceError = {
  error: string;
  status: number;
  regularization_required?: boolean;
  remaining?: number;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const BUCKETS = new Set<ReasonBucket>([
  'authorised',
  'unauthorised',
  'medical',
  'school_activity',
]);
const GRANULARITIES = new Set<AttendanceGranularity>(['day', 'session', 'period']);
const STATUSES = new Set<AttendanceStatus>(['present', 'absent', 'late', 'left_early']);
const EXCUSES = new Set<AttendanceExcuse>(['excused', 'unexcused', 'exempt', 'unknown']);
const SESSION_PARTS = new Set<SessionPart>(['am', 'pm']);
const SUBJECT_TYPES = new Set<CaptureSubjectType>(['student', 'staff']);
const MODALITIES = new Set<CaptureModality>(['nfc', 'qr']);
const STAFF_STATUSES = new Set<StaffAttendanceStatus>([
  'present',
  'absent',
  'on_leave',
  'half_day',
]);
const STAFF_SOURCES = new Set<StaffAttendanceSource>([
  'manual',
  'nfc',
  'qr',
  'biometric_device',
]);
const CHECK_DIRECTIONS = new Set<StaffCheckDirection>(['in', 'out']);
const REPORT_CHANNELS = new Set<ReportedAbsenceChannel>([
  'app',
  'web',
  'ivr',
  'whatsapp',
]);
const DAY_DERIVATIONS = new Set<DayDerivation>([
  'any_absent',
  'majority',
  'half_day_minutes',
]);
const ISO_MONTH = /^\d{4}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
const MAX_REPORT_DATES = 15;
const MAX_REPORT_AHEAD_DAYS = 30;

const DUPLICATE_WINDOW_MS = 120_000;
const ANOMALY_WINDOW_MS = 60_000;

const DEFAULT_SETTINGS = {
  granularity: 'day' as AttendanceGranularity,
  editWindowMinutes: 120,
  lateThresholdMinutes: 30,
  halfDayMinMinutes: 180,
  dayDerivation: 'majority' as DayDerivation,
};

const DEFAULT_SEEDS: Array<{ code: string; label: string; bucket: ReasonBucket; sort: number }> = [
  { code: 'SICK', label: 'Sick', bucket: 'medical', sort: 10 },
  { code: 'FAMILY', label: 'Family', bucket: 'authorised', sort: 20 },
  { code: 'MEDICAL_APPT', label: 'Medical appointment', bucket: 'medical', sort: 30 },
  { code: 'SCHOOL_EVENT', label: 'School event', bucket: 'school_activity', sort: 40 },
  { code: 'UNEXPLAINED', label: 'Unexplained', bucket: 'unauthorised', sort: 50 },
];

const DEFAULT_LEAVE_TYPE_SEEDS: Array<{
  code: string;
  label: string;
  annualQuota: number;
}> = [
  { code: 'CL', label: 'Casual Leave', annualQuota: 12 },
  { code: 'EL', label: 'Earned Leave', annualQuota: 15 },
  { code: 'ML', label: 'Medical Leave', annualQuota: 10 },
];

const LEAVE_STATES = new Set<LeaveRequestState>([
  'pending',
  'approved',
  'rejected',
  'cancelled',
]);

/** Inclusive ISO calendar dates from `from` through `to` (UTC date arithmetic). */
function eachIsoDateInclusive(from: string, to: string): string[] {
  const out: string[] = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor.getTime() <= end.getTime()) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

function recordSnapshot(r: AttendanceRecord): string {
  return JSON.stringify({
    status: r.status,
    excuse: r.excuse,
    reasonCodeId: r.reasonCodeId,
    lateMinutes: r.lateMinutes,
    source: r.source,
    markedBy: r.markedBy,
  });
}

export function hashCapturePayloadB64(payloadB64: string): string {
  const bytes = Buffer.from(payloadB64, 'base64');
  return createHash('sha256').update(bytes).digest('hex');
}

function canonicalizeCaptureContext(ctx: {
  date: string;
  gate?: string | null;
  periodInstanceId?: string | null;
}): string {
  const normalized: Record<string, string> = { date: ctx.date };
  if (ctx.gate != null && String(ctx.gate).trim() !== '') {
    normalized.gate = String(ctx.gate).trim();
  }
  if (ctx.periodInstanceId != null && String(ctx.periodInstanceId).trim() !== '') {
    normalized.period_instance_id = String(ctx.periodInstanceId).trim();
  }
  return JSON.stringify(normalized);
}

function excuseFromReportedBucket(bucket: ReasonBucket): AttendanceExcuse {
  switch (bucket) {
    case 'medical':
    case 'authorised':
      return 'excused';
    case 'school_activity':
      return 'exempt';
    case 'unauthorised':
      return 'unexcused';
    default: {
      const _exhaustive: never = bucket;
      return _exhaustive;
    }
  }
}

function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDaysIso(isoDate: string, days: number): string {
  const ms = Date.parse(`${isoDate}T00:00:00.000Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

function daysBetweenUtc(from: string, to: string): number {
  const a = Date.parse(`${from}T00:00:00.000Z`);
  const b = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((b - a) / MS_PER_DAY);
}

export class AttendanceService {
  constructor(
    private readonly repo: AttendanceRepository,
    private readonly events: EventPublisher,
  ) {}

  async listReasonCodes(tenantId: string): Promise<ReasonCode[]> {
    await this.ensureSeeded(tenantId);
    return this.repo.listReasonCodes(tenantId);
  }

  async createReasonCode(
    tenantId: string,
    input: CreateReasonCodeInput,
  ): Promise<{ reasonCode?: ReasonCode; error?: ServiceError }> {
    await this.ensureSeeded(tenantId);
    const validated = this.validateCreate(input);
    if ('error' in validated) return { error: validated };

    const dup = await this.repo.findReasonCodeByCode(tenantId, validated.code);
    if (dup) return { error: { error: 'reason code already exists', status: 409 } };

    const reasonCode = await this.repo.insertReasonCode({
      id: uuidv4(),
      tenantId,
      ...validated,
      createdAt: '',
      updatedAt: '',
    });
    return { reasonCode };
  }

  async patchReasonCode(
    tenantId: string,
    id: string,
    input: PatchReasonCodeInput,
  ): Promise<{ reasonCode?: ReasonCode; error?: ServiceError }> {
    await this.ensureSeeded(tenantId);
    const existing = await this.repo.getReasonCode(tenantId, id);
    if (!existing) return { error: { error: 'Reason code not found', status: 404 } };

    if (input.bucket !== undefined && input.bucket !== existing.bucket) {
      return { error: { error: 'bucket is immutable after creation', status: 400 } };
    }

    const nextCode =
      input.code !== undefined ? String(input.code).trim().toUpperCase() : existing.code;
    const nextLabel =
      input.label !== undefined ? String(input.label).trim() : existing.label;
    if (!nextCode) return { error: { error: 'code is required', status: 400 } };
    if (!nextLabel) return { error: { error: 'label is required', status: 400 } };

    if (nextCode !== existing.code) {
      const dup = await this.repo.findReasonCodeByCode(tenantId, nextCode);
      if (dup) return { error: { error: 'reason code already exists', status: 409 } };
    }

    const sort = input.sort !== undefined ? Number(input.sort) : existing.sort;
    if (!Number.isInteger(sort)) {
      return { error: { error: 'sort must be an integer', status: 400 } };
    }

    const reasonCode = await this.repo.updateReasonCode(tenantId, id, {
      ...existing,
      code: nextCode,
      label: nextLabel,
      isActive: input.isActive !== undefined ? !!input.isActive : existing.isActive,
      sort,
    });
    if (!reasonCode) return { error: { error: 'Reason code not found', status: 404 } };
    return { reasonCode };
  }

  async getSettings(tenantId: string): Promise<AttendanceSettings> {
    const existing = await this.repo.getSettings(tenantId);
    if (existing) return existing;
    return this.repo.insertSettings({
      tenantId,
      ...DEFAULT_SETTINGS,
      updatedAt: '',
    });
  }

  async putSettings(
    tenantId: string,
    input: UpsertAttendanceSettingsInput,
  ): Promise<{ settings?: AttendanceSettings; error?: ServiceError }> {
    const current = await this.getSettings(tenantId);
    const next = {
      granularity: input.granularity ?? current.granularity,
      editWindowMinutes:
        input.editWindowMinutes !== undefined
          ? Number(input.editWindowMinutes)
          : current.editWindowMinutes,
      lateThresholdMinutes:
        input.lateThresholdMinutes !== undefined
          ? Number(input.lateThresholdMinutes)
          : current.lateThresholdMinutes,
      halfDayMinMinutes:
        input.halfDayMinMinutes !== undefined
          ? Number(input.halfDayMinMinutes)
          : current.halfDayMinMinutes,
      dayDerivation: input.dayDerivation ?? current.dayDerivation,
    };

    const validated = this.validateSettings(next);
    if (validated) return { error: validated };

    const settings = await this.repo.updateSettings({
      tenantId,
      ...next,
      updatedAt: '',
    });
    return { settings };
  }

  async markBatch(
    tenantId: string,
    input: MarkBatchInput,
  ): Promise<{
    records?: AttendanceRecord[];
    replayed?: boolean;
    error?: ServiceError;
  }> {
    await this.ensureSeeded(tenantId);
    const settings = await this.getSettings(tenantId);

    const batchKey = (input.idempotencyKey || '').trim();
    if (!batchKey) return { error: { error: 'idempotency_key is required', status: 400 } };
    const markedBy = (input.markedBy || '').trim();
    if (!markedBy) return { error: { error: 'marked_by is required', status: 400 } };

    const existingBatch = await this.repo.listRecordsByIdempotencyPrefix(tenantId, batchKey);
    if (existingBatch.length > 0) {
      return { records: existingBatch, replayed: true };
    }

    const date = (input.context?.date || '').trim();
    if (!ISO_DATE.test(date)) {
      return { error: { error: 'context.date must be ISO date (YYYY-MM-DD)', status: 400 } };
    }

    const periodInstanceId =
      input.context.periodInstanceId != null && String(input.context.periodInstanceId).trim() !== ''
        ? String(input.context.periodInstanceId).trim()
        : null;
    const sessionPartRaw =
      input.context.sessionPart != null && String(input.context.sessionPart).trim() !== ''
        ? (String(input.context.sessionPart).trim() as SessionPart)
        : null;

    const ctxErr = this.validateMarkContext(settings.granularity, periodInstanceId, sessionPartRaw);
    if (ctxErr) return { error: ctxErr };

    if (!Array.isArray(input.marks) || input.marks.length === 0) {
      return { error: { error: 'marks must be a non-empty array', status: 400 } };
    }

    const now = new Date().toISOString();
    const records: AttendanceRecord[] = [];

    for (const mark of input.marks) {
      const studentId = (mark.studentId || '').trim();
      if (!studentId) return { error: { error: 'student_id is required', status: 400 } };
      if (!STATUSES.has(mark.status)) {
        return { error: { error: 'invalid status', status: 400 } };
      }

      let lateMinutes: number | null = null;
      if (mark.status === 'late') {
        if (mark.lateMinutes == null || !Number.isInteger(Number(mark.lateMinutes))) {
          return { error: { error: 'late_minutes is required for late status', status: 400 } };
        }
        lateMinutes = Number(mark.lateMinutes);
        if (lateMinutes < 0) {
          return { error: { error: 'late_minutes must be >= 0', status: 400 } };
        }
      }

      let excuse: AttendanceExcuse =
        mark.excuse && EXCUSES.has(mark.excuse) ? mark.excuse : 'unknown';

      let reasonCodeId: string | null = null;
      let reasonBucket: ReasonBucket | null = null;
      if (mark.reasonCodeId != null && String(mark.reasonCodeId).trim() !== '') {
        const rc = await this.repo.getReasonCode(tenantId, String(mark.reasonCodeId).trim());
        if (!rc || !rc.isActive) {
          return { error: { error: 'reason_code not found or inactive', status: 400 } };
        }
        reasonCodeId = rc.id;
        reasonBucket = rc.bucket;
      }

      let explained = false;
      if (mark.status === 'absent') {
        const reported = await this.repo.findReportedCoveringStudentDate(
          tenantId,
          studentId,
          date,
        );
        if (reported) {
          explained = true;
          const rc = await this.repo.getReasonCode(tenantId, reported.reasonCodeId);
          if (rc) {
            reasonBucket = rc.bucket;
            if (!reasonCodeId) reasonCodeId = rc.id;
            if (!mark.excuse || mark.excuse === 'unknown') {
              excuse = excuseFromReportedBucket(rc.bucket);
            }
          }
        }
      }

      const slot = await this.repo.findRecordBySlot(
        tenantId,
        studentId,
        date,
        periodInstanceId,
        sessionPartRaw,
      );

      const payload: AttendanceRecord = {
        id: slot?.id ?? uuidv4(),
        tenantId,
        studentId,
        date,
        periodInstanceId,
        sessionPart: sessionPartRaw,
        status: mark.status,
        excuse,
        reasonCodeId,
        lateMinutes,
        markedBy,
        markedAt: now,
        source: 'roll_call',
        deviceId: null,
        idempotencyKey: `${batchKey}::${studentId}`,
        createdAt: '',
        updatedAt: '',
      };

      let saved: AttendanceRecord;
      if (slot) {
        saved = (await this.repo.updateRecord(tenantId, slot.id, {
          ...payload,
          id: slot.id,
          idempotencyKey: `${batchKey}::${studentId}`,
        }))!;
      } else {
        saved = await this.repo.insertRecord(payload);
      }
      records.push(saved);

      if (mark.status === 'absent') {
        await this.events.publish({
          type: 'school.attendance.marked_absent',
          tenantId,
          occurredAt: now,
          data: {
            student_id: studentId,
            date,
            period_instance_id: periodInstanceId,
            reason_bucket: reasonBucket,
            explained,
          },
        });
      }
    }

    return { records, replayed: false };
  }

  async getRecord(
    tenantId: string,
    id: string,
  ): Promise<{ record?: AttendanceRecord; error?: ServiceError }> {
    const record = await this.repo.getRecord(tenantId, id);
    if (!record) return { error: { error: 'Record not found', status: 404 } };
    return { record };
  }

  async patchRecord(
    tenantId: string,
    id: string,
    input: PatchRecordInput,
  ): Promise<{ record?: AttendanceRecord; error?: ServiceError }> {
    const existing = await this.repo.getRecord(tenantId, id);
    if (!existing) return { error: { error: 'Record not found', status: 404 } };

    const settings = await this.getSettings(tenantId);
    if (!this.withinEditWindow(existing.markedAt, settings.editWindowMinutes)) {
      return {
        error: {
          error: 'window_closed',
          status: 409,
          regularization_required: true,
        },
      };
    }

    const nextStatus = input.status ?? existing.status;
    if (!STATUSES.has(nextStatus)) return { error: { error: 'invalid status', status: 400 } };

    let lateMinutes = existing.lateMinutes;
    if (input.lateMinutes !== undefined) lateMinutes = input.lateMinutes;
    if (nextStatus === 'late') {
      if (lateMinutes == null || !Number.isInteger(Number(lateMinutes))) {
        return { error: { error: 'late_minutes is required for late status', status: 400 } };
      }
      lateMinutes = Number(lateMinutes);
    } else if (input.status && input.status !== 'late') {
      lateMinutes = null;
    }

    const excuse = input.excuse ?? existing.excuse;
    if (!EXCUSES.has(excuse)) return { error: { error: 'invalid excuse', status: 400 } };

    let reasonCodeId =
      input.reasonCodeId !== undefined ? input.reasonCodeId : existing.reasonCodeId;
    if (reasonCodeId) {
      const rc = await this.repo.getReasonCode(tenantId, reasonCodeId);
      if (!rc || !rc.isActive) {
        return { error: { error: 'reason_code not found or inactive', status: 400 } };
      }
      reasonCodeId = rc.id;
    }

    const updated = await this.repo.updateRecord(tenantId, id, {
      ...existing,
      status: nextStatus,
      excuse,
      reasonCodeId,
      lateMinutes,
      markedBy: input.actor || existing.markedBy,
    });
    if (!updated) return { error: { error: 'Record not found', status: 404 } };

    await this.repo.insertAudit({
      id: uuidv4(),
      tenantId,
      recordId: id,
      beforeJson: recordSnapshot(existing),
      afterJson: recordSnapshot(updated),
      actor: input.actor,
      at: new Date().toISOString(),
    });

    return { record: updated };
  }

  async regularizeRecord(
    tenantId: string,
    id: string,
    input: RegularizeInput,
  ): Promise<{ record?: AttendanceRecord; error?: ServiceError }> {
    const existing = await this.repo.getRecord(tenantId, id);
    if (!existing) return { error: { error: 'Record not found', status: 404 } };

    if (!STATUSES.has(input.newStatus)) {
      return { error: { error: 'invalid new_status', status: 400 } };
    }
    if (!EXCUSES.has(input.newExcuse)) {
      return { error: { error: 'invalid new_excuse', status: 400 } };
    }
    const approvedBy = (input.approvedBy || '').trim();
    if (!approvedBy) return { error: { error: 'approved_by is required', status: 400 } };

    const rc = await this.repo.getReasonCode(tenantId, (input.reasonCodeId || '').trim());
    if (!rc || !rc.isActive) {
      return { error: { error: 'reason_code not found or inactive', status: 400 } };
    }

    let lateMinutes = existing.lateMinutes;
    if (input.newStatus !== 'late') lateMinutes = null;

    const updated = await this.repo.updateRecord(tenantId, id, {
      ...existing,
      status: input.newStatus,
      excuse: input.newExcuse,
      reasonCodeId: rc.id,
      lateMinutes,
      source: 'regularization',
      markedBy: approvedBy,
      markedAt: new Date().toISOString(),
    });
    if (!updated) return { error: { error: 'Record not found', status: 404 } };

    const at = new Date().toISOString();
    await this.repo.insertAudit({
      id: uuidv4(),
      tenantId,
      recordId: id,
      beforeJson: recordSnapshot(existing),
      afterJson: recordSnapshot({
        ...updated,
        // note is not a column; include in after for audit trail
      }),
      actor: approvedBy,
      at,
    });

    await this.events.publish({
      type: 'school.attendance.regularized',
      tenantId,
      occurredAt: at,
      data: {
        record_id: id,
        student_id: updated.studentId,
        new_status: updated.status,
        approved_by: approvedBy,
        note: input.note ?? null,
      },
    });

    return { record: updated };
  }

  async getRegister(
    tenantId: string,
    date: string,
    studentIds: string[],
  ): Promise<{
    date?: string;
    register?: Record<string, AttendanceRecord | { status: 'unmarked' }>;
    error?: ServiceError;
  }> {
    if (!ISO_DATE.test(date)) {
      return { error: { error: 'date must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    const ids = studentIds.map((s) => s.trim()).filter(Boolean);
    const records = await this.repo.listRecordsForStudentsOnDate(tenantId, date, ids);
    const byStudent = new Map(records.map((r) => [r.studentId, r]));
    const register: Record<string, AttendanceRecord | { status: 'unmarked' }> = {};
    for (const id of ids) {
      register[id] = byStudent.get(id) ?? { status: 'unmarked' };
    }
    return { date, register };
  }

  async createBinding(
    tenantId: string,
    input: CreateCaptureBindingInput,
  ): Promise<{ binding?: CaptureBinding; error?: ServiceError }> {
    if (!SUBJECT_TYPES.has(input.subjectType)) {
      return { error: { error: 'subject_type must be student or staff', status: 400 } };
    }
    if (!MODALITIES.has(input.modality)) {
      return { error: { error: 'modality must be nfc or qr', status: 400 } };
    }
    const subjectId = (input.subjectId || '').trim();
    if (!subjectId) return { error: { error: 'subject_id is required', status: 400 } };
    const payloadB64 = (input.payloadB64 || '').trim();
    if (!payloadB64) return { error: { error: 'payload_b64 is required', status: 400 } };

    let payloadHash: string;
    try {
      payloadHash = hashCapturePayloadB64(payloadB64);
    } catch {
      return { error: { error: 'payload_b64 is invalid', status: 400 } };
    }

    const existing = await this.repo.findActiveBindingByHash(
      tenantId,
      input.modality,
      payloadHash,
    );
    if (existing) {
      return {
        error: {
          error: 'payload already bound; deactivate previous binding first',
          status: 409,
        },
      };
    }

    const binding = await this.repo.insertBinding({
      id: uuidv4(),
      tenantId,
      subjectType: input.subjectType,
      subjectId,
      modality: input.modality,
      payloadHash,
      isActive: true,
      createdAt: '',
    });
    return { binding };
  }

  async deactivateBinding(
    tenantId: string,
    id: string,
  ): Promise<{ binding?: CaptureBinding; error?: ServiceError }> {
    const existing = await this.repo.getBinding(tenantId, id);
    if (!existing) return { error: { error: 'Binding not found', status: 404 } };
    const binding = await this.repo.deactivateBinding(tenantId, id);
    if (!binding) return { error: { error: 'Binding not found', status: 404 } };
    return { binding };
  }

  async capture(
    tenantId: string,
    input: CaptureInput,
  ): Promise<{
    event?: CaptureEvent;
    record?: AttendanceRecord | null;
    replayed?: boolean;
    error?: ServiceError;
  }> {
    if (!MODALITIES.has(input.modality)) {
      return { error: { error: 'modality must be nfc or qr', status: 400 } };
    }
    const deviceId = (input.deviceId || '').trim();
    if (!deviceId) return { error: { error: 'device_id is required', status: 400 } };
    const payloadB64 = (input.payloadB64 || '').trim();
    if (!payloadB64) return { error: { error: 'payload_b64 is required', status: 400 } };
    const idempotencyKey = (input.idempotencyKey || '').trim();
    if (!idempotencyKey) {
      return { error: { error: 'idempotency_key is required', status: 400 } };
    }
    const date = (input.context?.date || '').trim();
    if (!ISO_DATE.test(date)) {
      return { error: { error: 'context.date must be ISO date (YYYY-MM-DD)', status: 400 } };
    }

    const prior = await this.repo.getCaptureEventByIdempotency(tenantId, idempotencyKey);
    if (prior) {
      return { event: prior, record: null, replayed: true };
    }

    let payloadHash: string;
    try {
      payloadHash = hashCapturePayloadB64(payloadB64);
    } catch {
      return { error: { error: 'payload_b64 is invalid', status: 400 } };
    }

    const gate =
      input.context.gate != null && String(input.context.gate).trim() !== ''
        ? String(input.context.gate).trim()
        : null;
    const periodInstanceId =
      input.context.periodInstanceId != null &&
      String(input.context.periodInstanceId).trim() !== ''
        ? String(input.context.periodInstanceId).trim()
        : null;
    const contextJson = canonicalizeCaptureContext({ date, gate, periodInstanceId });
    const now = new Date();
    const nowIso = now.toISOString();

    const dupSince = new Date(now.getTime() - DUPLICATE_WINDOW_MS).toISOString();
    const recentDup = await this.repo.findRecentCaptureByHashAndContext(
      tenantId,
      payloadHash,
      contextJson,
      dupSince,
    );
    if (recentDup) {
      const event = await this.repo.insertCaptureEvent({
        id: uuidv4(),
        tenantId,
        deviceId,
        modality: input.modality,
        payloadHash,
        matchedSubjectId: recentDup.matchedSubjectId,
        decision: 'duplicate',
        contextJson,
        idempotencyKey,
        at: nowIso,
      });
      return { event, record: null, replayed: false };
    }

    const binding = await this.repo.findActiveBindingByHash(
      tenantId,
      input.modality,
      payloadHash,
    );

    if (!binding) {
      const event = await this.repo.insertCaptureEvent({
        id: uuidv4(),
        tenantId,
        deviceId,
        modality: input.modality,
        payloadHash,
        matchedSubjectId: null,
        decision: 'no_match',
        contextJson,
        idempotencyKey,
        at: nowIso,
      });
      return { event, record: null, replayed: false };
    }

    const anomalySince = new Date(now.getTime() - ANOMALY_WINDOW_MS).toISOString();
    const otherDevice = await this.repo.findRecentCaptureOtherDevice(
      tenantId,
      payloadHash,
      deviceId,
      anomalySince,
    );
    if (otherDevice) {
      await this.events.publish({
        type: 'school.attendance.anomaly',
        tenantId,
        occurredAt: nowIso,
        data: { kind: 'impossible_sequence', payload_hash: payloadHash },
      });
    }

    let record: AttendanceRecord | null = null;
    if (binding.subjectType === 'student' && gate) {
      record = await this.upsertGatePresent({
        tenantId,
        studentId: binding.subjectId,
        date,
        modality: input.modality,
        deviceId,
        at: nowIso,
        gate,
      });
      await this.events.publish({
        type: 'school.attendance.gate_entry',
        tenantId,
        occurredAt: nowIso,
        data: {
          student_id: binding.subjectId,
          at: nowIso,
          gate,
        },
      });
    }

    const event = await this.repo.insertCaptureEvent({
      id: uuidv4(),
      tenantId,
      deviceId,
      modality: input.modality,
      payloadHash,
      matchedSubjectId: binding.subjectId,
      decision: 'matched',
      contextJson,
      idempotencyKey,
      at: nowIso,
    });

    return { event, record, replayed: false };
  }

  async listCaptureEvents(
    tenantId: string,
    filters: { date?: string; decision?: CaptureDecision },
  ): Promise<{ events?: CaptureEvent[]; error?: ServiceError }> {
    if (filters.date && !ISO_DATE.test(filters.date)) {
      return { error: { error: 'date must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    if (filters.decision) {
      switch (filters.decision) {
        case 'matched':
        case 'no_match':
        case 'duplicate':
          break;
        default: {
          const _exhaustive: never = filters.decision;
          void _exhaustive;
          return {
            error: { error: 'decision must be matched, no_match, or duplicate', status: 400 },
          };
        }
      }
    }
    const events = await this.repo.listCaptureEvents(tenantId, filters);
    return { events };
  }

  async staffCheck(
    tenantId: string,
    input: StaffCheckInput,
  ): Promise<{ record?: StaffAttendance; error?: ServiceError }> {
    const memberId = (input.memberId || '').trim();
    if (!memberId) return { error: { error: 'member_id is required', status: 400 } };
    if (!CHECK_DIRECTIONS.has(input.direction)) {
      return { error: { error: 'direction must be in or out', status: 400 } };
    }
    if (!STAFF_SOURCES.has(input.source)) {
      return { error: { error: 'invalid source', status: 400 } };
    }
    const at = (input.at || '').trim();
    if (!at || Number.isNaN(Date.parse(at))) {
      return { error: { error: 'at must be a valid ISO timestamp', status: 400 } };
    }
    const date = at.slice(0, 10);
    if (!ISO_DATE.test(date)) {
      return { error: { error: 'at must include a valid date', status: 400 } };
    }

    const month = date.slice(0, 7);
    if (await this.repo.isStaffMonthLocked(tenantId, month)) {
      return { error: { error: 'month is finalized', status: 409 } };
    }

    const markedBy =
      input.deviceId != null && String(input.deviceId).trim() !== ''
        ? `device:${String(input.deviceId).trim()}`
        : null;

    const existing = await this.repo.findStaffByDay(tenantId, memberId, date);

    switch (input.direction) {
      case 'in': {
        if (existing?.checkInAt) {
          return { error: { error: 'already checked in', status: 409 } };
        }
        const payload: StaffAttendance = {
          id: existing?.id ?? uuidv4(),
          tenantId,
          memberId,
          date,
          checkInAt: at,
          checkOutAt: existing?.checkOutAt ?? null,
          status: existing?.status ?? 'present',
          source: input.source,
          minutesOnPremises: existing?.minutesOnPremises ?? null,
          markedBy,
          createdAt: '',
          updatedAt: '',
        };
        if (existing) {
          return {
            record: (await this.repo.updateStaffAttendance(tenantId, existing.id, payload))!,
          };
        }
        return { record: await this.repo.insertStaffAttendance(payload) };
      }
      case 'out': {
        if (!existing?.checkInAt) {
          return { error: { error: 'check-out requires prior check-in', status: 400 } };
        }
        const settings = await this.getSettings(tenantId);
        const inMs = Date.parse(existing.checkInAt);
        const outMs = Date.parse(at);
        if (outMs < inMs) {
          return { error: { error: 'check-out must be after check-in', status: 400 } };
        }
        const minutes = Math.floor((outMs - inMs) / 60_000);
        const status: StaffAttendanceStatus =
          minutes >= settings.halfDayMinMinutes ? 'present' : 'half_day';
        const updated = await this.repo.updateStaffAttendance(tenantId, existing.id, {
          ...existing,
          checkOutAt: at,
          minutesOnPremises: minutes,
          status,
          source: input.source,
          markedBy: markedBy ?? existing.markedBy,
        });
        return { record: updated! };
      }
      default: {
        const _exhaustive: never = input.direction;
        void _exhaustive;
        return { error: { error: 'direction must be in or out', status: 400 } };
      }
    }
  }

  async staffBulkMark(
    tenantId: string,
    input: StaffBulkMarkInput,
  ): Promise<{ records?: StaffAttendance[]; error?: ServiceError }> {
    const date = (input.date || '').trim();
    if (!ISO_DATE.test(date)) {
      return { error: { error: 'date must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    const markedBy = (input.markedBy || '').trim();
    if (!markedBy) return { error: { error: 'marked_by is required', status: 400 } };
    if (!Array.isArray(input.marks) || input.marks.length === 0) {
      return { error: { error: 'marks must be a non-empty array', status: 400 } };
    }

    const month = date.slice(0, 7);
    if (await this.repo.isStaffMonthLocked(tenantId, month)) {
      return { error: { error: 'month is finalized', status: 409 } };
    }

    const records: StaffAttendance[] = [];
    for (const mark of input.marks) {
      const memberId = (mark.memberId || '').trim();
      if (!memberId) return { error: { error: 'member_id is required', status: 400 } };
      if (!STAFF_STATUSES.has(mark.status)) {
        return { error: { error: 'invalid status', status: 400 } };
      }
      const existing = await this.repo.findStaffByDay(tenantId, memberId, date);
      const payload: StaffAttendance = {
        id: existing?.id ?? uuidv4(),
        tenantId,
        memberId,
        date,
        checkInAt: existing?.checkInAt ?? null,
        checkOutAt: existing?.checkOutAt ?? null,
        status: mark.status,
        source: 'manual',
        minutesOnPremises: existing?.minutesOnPremises ?? null,
        markedBy,
        createdAt: '',
        updatedAt: '',
      };
      if (existing) {
        records.push((await this.repo.updateStaffAttendance(tenantId, existing.id, payload))!);
      } else {
        records.push(await this.repo.insertStaffAttendance(payload));
      }
    }
    return { records };
  }

  async getStaffMonth(
    tenantId: string,
    month: string,
    memberId?: string,
  ): Promise<{ report?: StaffMonthReport; error?: ServiceError }> {
    if (!ISO_MONTH.test(month)) {
      return { error: { error: 'month must be YYYY-MM', status: 400 } };
    }
    const member = memberId?.trim() || undefined;
    const records = await this.repo.listStaffForMonth(tenantId, month, member);
    const locked = await this.repo.isStaffMonthLocked(tenantId, month);
    const totals = this.computeStaffTotals(records);
    return { report: { month, locked, records, totals } };
  }

  async finalizeStaffMonth(
    tenantId: string,
    month: string,
    finalizedBy?: string,
  ): Promise<{ report?: StaffMonthReport; error?: ServiceError }> {
    if (!ISO_MONTH.test(month)) {
      return { error: { error: 'month must be YYYY-MM', status: 400 } };
    }
    if (await this.repo.isStaffMonthLocked(tenantId, month)) {
      return { error: { error: 'month is finalized', status: 409 } };
    }
    await this.repo.insertStaffLock(tenantId, month, finalizedBy?.trim() || null);
    const records = await this.repo.listStaffForMonth(tenantId, month);
    const totals = this.computeStaffTotals(records);
    await this.events.publish({
      type: 'school.staff.attendance_finalized',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: {
        month,
        totals,
        finalized_by: finalizedBy?.trim() || null,
      },
    });
    return { report: { month, locked: true, records, totals } };
  }

  async createReportedAbsence(
    tenantId: string,
    input: CreateReportedAbsenceInput,
  ): Promise<{
    reportedAbsence?: ReportedAbsence;
    merged?: boolean;
    error?: ServiceError;
  }> {
    await this.ensureSeeded(tenantId);

    const studentId = (input.studentId || '').trim();
    if (!studentId) return { error: { error: 'student_id is required', status: 400 } };
    const guardianId = (input.reportedByGuardianId || '').trim();
    if (!guardianId) {
      return { error: { error: 'reported_by_guardian_id is required', status: 400 } };
    }
    if (!REPORT_CHANNELS.has(input.channel)) {
      return { error: { error: 'channel must be app, web, ivr, or whatsapp', status: 400 } };
    }
    const reasonCodeId = (input.reasonCodeId || '').trim();
    if (!reasonCodeId) return { error: { error: 'reason_code_id is required', status: 400 } };
    const rc = await this.repo.getReasonCode(tenantId, reasonCodeId);
    if (!rc || !rc.isActive) {
      return { error: { error: 'reason_code not found or inactive', status: 400 } };
    }

    const rawDates = Array.isArray(input.dates) ? input.dates : [];
    if (rawDates.length === 0) {
      return { error: { error: 'dates must be a non-empty array', status: 400 } };
    }
    if (rawDates.length > MAX_REPORT_DATES) {
      return {
        error: { error: `dates must contain at most ${MAX_REPORT_DATES} entries`, status: 400 },
      };
    }

    const today = utcToday();
    const normalized: string[] = [];
    for (const d of rawDates) {
      const date = String(d || '').trim();
      if (!ISO_DATE.test(date)) {
        return { error: { error: 'each date must be ISO date (YYYY-MM-DD)', status: 400 } };
      }
      const delta = daysBetweenUtc(today, date);
      if (delta < 0) {
        return { error: { error: 'dates must be today or future', status: 400 } };
      }
      if (delta > MAX_REPORT_AHEAD_DAYS) {
        return {
          error: {
            error: `dates must be within ${MAX_REPORT_AHEAD_DAYS} days ahead`,
            status: 400,
          },
        };
      }
      normalized.push(date);
    }

    const uniqueDates = [...new Set(normalized)].sort();
    const note =
      input.note != null && String(input.note).trim() !== ''
        ? String(input.note).trim()
        : null;

    const existing = await this.repo.findReportedByStudentGuardian(
      tenantId,
      studentId,
      guardianId,
    );

    let report: ReportedAbsence;
    let merged = false;
    let newlyCovered: string[];

    if (existing) {
      const before = new Set(existing.dates);
      const mergedDates = [...new Set([...existing.dates, ...uniqueDates])].sort();
      newlyCovered = uniqueDates.filter((d) => !before.has(d));
      merged = true;
      report = (await this.repo.updateReportedAbsence(tenantId, existing.id, {
        ...existing,
        dates: mergedDates,
        reasonCodeId: rc.id,
        note: note ?? existing.note,
        channel: input.channel,
      }))!;
    } else {
      newlyCovered = uniqueDates;
      report = await this.repo.insertReportedAbsence({
        id: uuidv4(),
        tenantId,
        studentId,
        reportedByGuardianId: guardianId,
        dates: uniqueDates,
        reasonCodeId: rc.id,
        note,
        attachmentRef: null,
        channel: input.channel,
        createdAt: '',
        updatedAt: '',
      });
    }

    await this.applyReportedExplanation(tenantId, report, newlyCovered, rc);
    return { reportedAbsence: report, merged };
  }

  async attachReportedAbsence(
    tenantId: string,
    id: string,
    attachmentRef: string,
  ): Promise<{ reportedAbsence?: ReportedAbsence; error?: ServiceError }> {
    const existing = await this.repo.getReportedAbsence(tenantId, id);
    if (!existing) return { error: { error: 'Reported absence not found', status: 404 } };
    const ref = (attachmentRef || '').trim();
    if (!ref) return { error: { error: 'attachment_ref is required', status: 400 } };
    const updated = await this.repo.updateReportedAbsence(tenantId, id, {
      ...existing,
      attachmentRef: ref,
    });
    return { reportedAbsence: updated! };
  }

  async listUnexplained(
    tenantId: string,
    date: string,
  ): Promise<{
    date?: string;
    unexplained?: Array<AttendanceRecord & { explained: false }>;
    error?: ServiceError;
  }> {
    if (!ISO_DATE.test(date)) {
      return { error: { error: 'date must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    const absents = await this.repo.listAbsentRecordsOnDate(tenantId, date);
    const covering = await this.repo.listReportedCoveringDate(tenantId, date);
    const explainedStudents = new Set(covering.map((r) => r.studentId));
    const unexplained = absents
      .filter((r) => !explainedStudents.has(r.studentId))
      .map((r) => ({ ...r, explained: false as const }));
    return { date, unexplained };
  }

  async computeRollups(
    tenantId: string,
    month: string,
    workingDays: number,
  ): Promise<{ rollups?: AttendanceMonthlyRollup[]; error?: ServiceError }> {
    if (!ISO_MONTH.test(month)) {
      return { error: { error: 'month must be YYYY-MM', status: 400 } };
    }
    if (!Number.isInteger(workingDays) || workingDays < 0 || workingDays > 31) {
      return {
        error: { error: 'working_days must be an integer between 0 and 31', status: 400 },
      };
    }
    const settings = await this.getSettings(tenantId);
    const records = await this.repo.listRecordsForMonth(tenantId, month);
    const computed = computeMonth({
      tenantId,
      month,
      workingDayCount: workingDays,
      records,
      dayDerivation: settings.dayDerivation,
      halfDayMinMinutes: settings.halfDayMinMinutes,
    });
    const now = new Date().toISOString();
    const rollups: AttendanceMonthlyRollup[] = [];
    for (const row of computed) {
      rollups.push(
        await this.repo.upsertMonthlyRollup({
          tenantId: row.tenantId,
          studentId: row.studentId,
          month: row.month,
          workingDays: row.workingDays,
          presentDays: row.presentDays,
          absentDays: row.absentDays,
          lateCount: row.lateCount,
          pct: row.pct,
          computedAt: now,
        }),
      );
    }
    return { rollups };
  }

  async listRollups(
    tenantId: string,
    month: string,
  ): Promise<{ rollups?: AttendanceMonthlyRollup[]; error?: ServiceError }> {
    if (!ISO_MONTH.test(month)) {
      return { error: { error: 'month must be YYYY-MM', status: 400 } };
    }
    return { rollups: await this.repo.listMonthlyRollups(tenantId, month) };
  }

  async listStudentRollups(
    tenantId: string,
    studentId: string,
  ): Promise<{ rollups?: AttendanceMonthlyRollup[]; error?: ServiceError }> {
    const id = (studentId || '').trim();
    if (!id) return { error: { error: 'student id is required', status: 400 } };
    return { rollups: await this.repo.listStudentRollups(tenantId, id) };
  }

  async getGuardianStudentSummary(
    tenantId: string,
    studentId: string,
    from: string,
    to: string,
  ): Promise<{
    records?: Array<{
      date: string;
      status: string;
      excuse: string;
      reason_bucket: string | null;
    }>;
    monthly?: AttendanceMonthlyRollup[];
    eligibility_pct?: number;
    error?: ServiceError;
  }> {
    const id = (studentId || '').trim();
    if (!id) return { error: { error: 'student id is required', status: 400 } };
    if (!ISO_DATE.test(from) || !ISO_DATE.test(to)) {
      return { error: { error: 'from and to must be ISO dates', status: 400 } };
    }
    if (to < from) {
      return { error: { error: 'to must be on or after from', status: 400 } };
    }

    const raw = await this.repo.listRecordsForStudentDateRange(
      tenantId,
      id,
      from,
      to,
    );
    const records = [];
    for (const r of raw) {
      let reason_bucket: string | null = null;
      if (r.reasonCodeId) {
        const rc = await this.repo.getReasonCode(tenantId, r.reasonCodeId);
        reason_bucket = rc?.bucket ?? null;
      }
      records.push({
        date: r.date,
        status: r.status,
        excuse: r.excuse,
        reason_bucket,
      });
    }

    const allRollups = await this.repo.listStudentRollups(tenantId, id);
    const fromMonth = from.slice(0, 7);
    const toMonth = to.slice(0, 7);
    const monthly = allRollups.filter(
      (m) => m.month >= fromMonth && m.month <= toMonth,
    );

    const eligibility = await this.getStudentEligibility(
      tenantId,
      id,
      from,
      to,
      75,
    );
    if (eligibility.error) return { error: eligibility.error };

    return {
      records,
      monthly,
      eligibility_pct: eligibility.eligibility!.pct,
    };
  }

  async getStudentEligibility(
    tenantId: string,
    studentId: string,
    sessionFrom: string,
    sessionTo: string,
    threshold: number,
  ): Promise<{ eligibility?: EligibilityResult; error?: ServiceError }> {
    const id = (studentId || '').trim();
    if (!id) return { error: { error: 'student id is required', status: 400 } };
    if (!ISO_DATE.test(sessionFrom) || !ISO_DATE.test(sessionTo)) {
      return {
        error: { error: 'session_from and session_to must be ISO dates', status: 400 },
      };
    }
    if (sessionTo < sessionFrom) {
      return { error: { error: 'session_to must be on or after session_from', status: 400 } };
    }
    if (!Number.isFinite(threshold) || threshold < 0 || threshold > 100) {
      return { error: { error: 'threshold must be between 0 and 100', status: 400 } };
    }

    const settings = await this.getSettings(tenantId);
    const records = await this.repo.listRecordsForStudentDateRange(
      tenantId,
      id,
      sessionFrom,
      sessionTo,
    );
    const workingDays = countWeekdaysInclusive(sessionFrom, sessionTo);
    const byDate = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      const list = byDate.get(r.date) ?? [];
      list.push(r);
      byDate.set(r.date, list);
    }
    let presentDays = 0;
    for (const dayRecords of byDate.values()) {
      if (
        deriveDayPresent(dayRecords, settings.dayDerivation, settings.halfDayMinMinutes)
      ) {
        presentDays += 1;
      }
    }
    presentDays = Math.min(presentDays, workingDays);

    const today = utcToday();
    const asOf = today < sessionFrom ? sessionFrom : today > sessionTo ? sessionTo : today;
    const remaining = countWeekdaysAfter(asOf, sessionTo);

    return {
      eligibility: computeEligibilityProjection({
        presentDays,
        workingDays,
        remainingWorkingDays: remaining,
        threshold,
      }),
    };
  }

  async getNudgeConfig(tenantId: string): Promise<NudgeConfig> {
    const existing = await this.repo.getNudgeConfig(tenantId);
    if (existing) return existing;
    return this.repo.insertNudgeConfig({
      tenantId,
      enabled: false,
      atRiskPct: 10,
      chronicDays: 18,
      holdoutPct: 10,
      maxMessagesPerTerm: 6,
      updatedAt: '',
    });
  }

  async putNudgeConfig(
    tenantId: string,
    input: UpsertNudgeConfigInput,
  ): Promise<{ config?: NudgeConfig; error?: ServiceError }> {
    const current = await this.getNudgeConfig(tenantId);
    const next = {
      enabled: input.enabled !== undefined ? !!input.enabled : current.enabled,
      atRiskPct:
        input.atRiskPct !== undefined ? Number(input.atRiskPct) : current.atRiskPct,
      chronicDays:
        input.chronicDays !== undefined
          ? Number(input.chronicDays)
          : current.chronicDays,
      holdoutPct:
        input.holdoutPct !== undefined ? Number(input.holdoutPct) : current.holdoutPct,
      maxMessagesPerTerm:
        input.maxMessagesPerTerm !== undefined
          ? Number(input.maxMessagesPerTerm)
          : current.maxMessagesPerTerm,
    };
    if (!Number.isFinite(next.atRiskPct) || next.atRiskPct < 0 || next.atRiskPct > 100) {
      return { error: { error: 'at_risk_pct must be between 0 and 100', status: 400 } };
    }
    if (
      !Number.isInteger(next.chronicDays) ||
      next.chronicDays < 1 ||
      next.chronicDays > 365
    ) {
      return { error: { error: 'chronic_days must be an integer between 1 and 365', status: 400 } };
    }
    if (
      !Number.isInteger(next.holdoutPct) ||
      next.holdoutPct < 0 ||
      next.holdoutPct > 100
    ) {
      return { error: { error: 'holdout_pct must be an integer between 0 and 100', status: 400 } };
    }
    if (
      !Number.isInteger(next.maxMessagesPerTerm) ||
      next.maxMessagesPerTerm < 0 ||
      next.maxMessagesPerTerm > 100
    ) {
      return {
        error: {
          error: 'max_messages_per_term must be an integer between 0 and 100',
          status: 400,
        },
      };
    }
    const config = await this.repo.updateNudgeConfig({
      tenantId,
      ...next,
      updatedAt: '',
    });
    return { config };
  }

  async runNudge(
    tenantId: string,
    input: NudgeRunInput,
  ): Promise<{
    sent?: NudgeMessage[];
    skipped?: number;
    error?: ServiceError;
  }> {
    const asOf = (input.asOf || '').trim();
    if (!ISO_DATE.test(asOf)) {
      return { error: { error: 'as_of must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    const classMap =
      input.classMap && typeof input.classMap === 'object' ? input.classMap : {};

    const config = await this.getNudgeConfig(tenantId);
    if (!config.enabled) {
      return { sent: [], skipped: 0 };
    }

    const settings = await this.getSettings(tenantId);
    const allRollups = await this.repo.listAllRollups(tenantId);
    const asOfMonth = asOf.slice(0, 7);
    const termYear = asOf.slice(0, 4);

    const ytdByStudent = new Map<
      string,
      { absentDays: number; workingDays: number; presentDays: number }
    >();
    for (const r of allRollups) {
      if (r.month > asOfMonth) continue;
      if (!r.month.startsWith(termYear)) continue;
      const cur = ytdByStudent.get(r.studentId) ?? {
        absentDays: 0,
        workingDays: 0,
        presentDays: 0,
      };
      cur.absentDays += r.absentDays;
      cur.workingDays += r.workingDays;
      cur.presentDays += r.presentDays;
      ytdByStudent.set(r.studentId, cur);
    }

    if (ytdByStudent.size === 0) {
      return { sent: [], skipped: 0 };
    }

    const sectionAbsent = new Map<string, number[]>();
    for (const [studentId, ytd] of ytdByStudent) {
      const section = classMap[studentId] ?? '_unassigned';
      const list = sectionAbsent.get(section) ?? [];
      list.push(ytd.absentDays);
      sectionAbsent.set(section, list);
    }

    const sent: NudgeMessage[] = [];
    let skipped = 0;
    const now = new Date().toISOString();

    for (const [studentId, ytd] of ytdByStudent) {
      let assignment = await this.repo.getNudgeAssignment(tenantId, studentId);
      if (!assignment) {
        assignment = await this.repo.insertNudgeAssignment({
          tenantId,
          studentId,
          cohort: assignCohort(studentId, config.holdoutPct),
          assignedAt: now,
        });
      }
      if (assignment.cohort === 'holdout') {
        skipped += 1;
        continue;
      }

      const tier = classifyNudgeTier({
        ytdAbsentDays: ytd.absentDays,
        ytdWorkingDays: ytd.workingDays,
        atRiskPct: config.atRiskPct,
        chronicDays: config.chronicDays,
      });
      if (!tier) {
        skipped += 1;
        continue;
      }

      const ytdPct =
        ytd.workingDays <= 0 ? 0 : (ytd.presentDays / ytd.workingDays) * 100;
      const last30From = addDaysIso(asOf, -29);
      const last30Pct = await this.attendancePctInRange(
        tenantId,
        studentId,
        last30From,
        asOf,
        settings,
      );
      if (isImproving(last30Pct, ytdPct)) {
        skipped += 1;
        continue;
      }

      const prior = await this.repo.countNudgeMessagesInTerm(
        tenantId,
        studentId,
        termYear,
      );
      if (prior >= config.maxMessagesPerTerm) {
        skipped += 1;
        continue;
      }

      const section = classMap[studentId] ?? '_unassigned';
      const peers = sectionAbsent.get(section) ?? [ytd.absentDays];
      const classPercentile = percentileOf(ytd.absentDays, peers);
      const absentDates = await this.repo.listAbsentDatesForStudent(
        tenantId,
        studentId,
        asOf,
      );
      const preciseDates = absentDates.slice(0, 3);
      const vars = {
        days_missed: ytd.absentDays,
        percentile: classPercentile,
        precise_dates: preciseDates,
      };

      const message = await this.repo.insertNudgeMessage({
        id: uuidv4(),
        tenantId,
        studentId,
        tier,
        ytdAbsentDays: ytd.absentDays,
        classPercentile,
        renderedVars: vars,
        createdAt: `${asOf}T12:00:00.000Z`,
      });
      sent.push(message);

      await this.events.publish({
        type: 'school.nudge.send',
        tenantId,
        occurredAt: `${asOf}T12:00:00.000Z`,
        data: {
          student_id: studentId,
          template: 'attendance_nudge',
          vars,
        },
      });
    }

    return { sent, skipped };
  }

  async getNudgeReport(
    tenantId: string,
  ): Promise<{ report?: NudgeReport; error?: ServiceError }> {
    const assignments = await this.repo.listNudgeAssignments(tenantId);
    const allRollups = await this.repo.listAllRollups(tenantId);
    const ytdByStudent = new Map<string, { absentDays: number; workingDays: number }>();
    for (const r of allRollups) {
      const cur = ytdByStudent.get(r.studentId) ?? { absentDays: 0, workingDays: 0 };
      cur.absentDays += r.absentDays;
      cur.workingDays += r.workingDays;
      ytdByStudent.set(r.studentId, cur);
    }

    const treatmentIds: string[] = [];
    const holdoutIds: string[] = [];
    for (const a of assignments) {
      if (a.cohort === 'treatment') treatmentIds.push(a.studentId);
      else holdoutIds.push(a.studentId);
    }

    const meanAbsence = (ids: string[]): number => {
      if (ids.length === 0) return 0;
      let sum = 0;
      let n = 0;
      for (const id of ids) {
        const y = ytdByStudent.get(id);
        if (!y || y.workingDays <= 0) continue;
        sum += (y.absentDays / y.workingDays) * 100;
        n += 1;
      }
      return n === 0 ? 0 : sum / n;
    };

    const report: NudgeReport = {
      treatment: {
        mean_absence_pct: meanAbsence(treatmentIds),
        message_count: await this.repo.countNudgeMessagesForStudents(
          tenantId,
          treatmentIds,
        ),
        student_count: treatmentIds.length,
      },
      holdout: {
        mean_absence_pct: meanAbsence(holdoutIds),
        message_count: await this.repo.countNudgeMessagesForStudents(
          tenantId,
          holdoutIds,
        ),
        student_count: holdoutIds.length,
      },
    };
    return { report };
  }

  private async attendancePctInRange(
    tenantId: string,
    studentId: string,
    from: string,
    to: string,
    settings: AttendanceSettings,
  ): Promise<number> {
    const records = await this.repo.listRecordsForStudentDateRange(
      tenantId,
      studentId,
      from,
      to,
    );
    const workingDays = countWeekdaysInclusive(from, to);
    if (workingDays === 0) return 0;
    const byDate = new Map<string, AttendanceRecord[]>();
    for (const r of records) {
      const list = byDate.get(r.date) ?? [];
      list.push(r);
      byDate.set(r.date, list);
    }
    let presentDays = 0;
    for (const dayRecords of byDate.values()) {
      if (
        deriveDayPresent(dayRecords, settings.dayDerivation, settings.halfDayMinMinutes)
      ) {
        presentDays += 1;
      }
    }
    return (Math.min(presentDays, workingDays) / workingDays) * 100;
  }

  private async applyReportedExplanation(
    tenantId: string,
    report: ReportedAbsence,
    dates: string[],
    reason: ReasonCode,
  ): Promise<void> {
    if (dates.length === 0) return;
    const excuse = excuseFromReportedBucket(reason.bucket);
    const absents = await this.repo.listAbsentRecordsForStudentDates(
      tenantId,
      report.studentId,
      dates,
    );
    const now = new Date().toISOString();
    for (const record of absents) {
      const updated = await this.repo.updateRecord(tenantId, record.id, {
        ...record,
        excuse,
        reasonCodeId: reason.id,
      });
      if (!updated) continue;
      await this.repo.insertAudit({
        id: uuidv4(),
        tenantId,
        recordId: record.id,
        beforeJson: recordSnapshot(record),
        afterJson: recordSnapshot(updated),
        actor: `guardian:${report.reportedByGuardianId}`,
        at: now,
      });
      await this.events.publish({
        type: 'school.attendance.explained',
        tenantId,
        occurredAt: now,
        data: {
          student_id: report.studentId,
          date: record.date,
          record_id: record.id,
          reported_absence_id: report.id,
          reason_bucket: reason.bucket,
          excuse,
        },
      });
    }
  }

  private computeStaffTotals(records: StaffAttendance[]): StaffMonthTotals {
    const totals: StaffMonthTotals = {
      present: 0,
      absent: 0,
      on_leave: 0,
      half_day: 0,
      total_minutes: 0,
    };
    for (const r of records) {
      switch (r.status) {
        case 'present':
          totals.present += 1;
          break;
        case 'absent':
          totals.absent += 1;
          break;
        case 'on_leave':
          totals.on_leave += 1;
          break;
        case 'half_day':
          totals.half_day += 1;
          break;
        default: {
          const _exhaustive: never = r.status;
          void _exhaustive;
          break;
        }
      }
      if (r.minutesOnPremises != null) {
        totals.total_minutes += r.minutesOnPremises;
      }
    }
    return totals;
  }

  private async upsertGatePresent(args: {
    tenantId: string;
    studentId: string;
    date: string;
    modality: CaptureModality;
    deviceId: string;
    at: string;
    gate: string;
  }): Promise<AttendanceRecord> {
    const source: AttendanceSource = args.modality === 'nfc' ? 'nfc' : 'qr';
    const slot = await this.repo.findRecordBySlot(
      args.tenantId,
      args.studentId,
      args.date,
      null,
      null,
    );
    const payload: AttendanceRecord = {
      id: slot?.id ?? uuidv4(),
      tenantId: args.tenantId,
      studentId: args.studentId,
      date: args.date,
      periodInstanceId: null,
      sessionPart: null,
      status: 'present',
      excuse: 'unknown',
      reasonCodeId: null,
      lateMinutes: null,
      markedBy: `device:${args.deviceId}`,
      markedAt: args.at,
      source,
      deviceId: args.deviceId,
      idempotencyKey: slot?.idempotencyKey ?? null,
      createdAt: '',
      updatedAt: '',
    };
    if (slot) {
      return (await this.repo.updateRecord(args.tenantId, slot.id, {
        ...payload,
        id: slot.id,
      }))!;
    }
    return this.repo.insertRecord(payload);
  }

  private validateMarkContext(
    granularity: AttendanceGranularity,
    periodInstanceId: string | null,
    sessionPart: SessionPart | null,
  ): ServiceError | null {
    switch (granularity) {
      case 'day':
        if (periodInstanceId || sessionPart) {
          return {
            error: 'day granularity does not accept period_instance_id or session_part',
            status: 400,
          };
        }
        return null;
      case 'session':
        if (!sessionPart || !SESSION_PARTS.has(sessionPart)) {
          return { error: 'session granularity requires session_part am|pm', status: 400 };
        }
        if (periodInstanceId) {
          return {
            error: 'session granularity does not accept period_instance_id',
            status: 400,
          };
        }
        return null;
      case 'period':
        if (!periodInstanceId) {
          return {
            error: 'period granularity requires period_instance_id',
            status: 400,
          };
        }
        if (sessionPart) {
          return {
            error: 'period granularity does not accept session_part',
            status: 400,
          };
        }
        return null;
      default: {
        const _exhaustive: never = granularity;
        void _exhaustive;
        return { error: 'invalid granularity', status: 400 };
      }
    }
  }

  private withinEditWindow(markedAt: string | null, windowMinutes: number): boolean {
    if (!markedAt) return true;
    const marked = Date.parse(markedAt);
    if (Number.isNaN(marked)) return false;
    const elapsedMs = Date.now() - marked;
    return elapsedMs <= windowMinutes * 60 * 1000;
  }

  private validateSettings(input: {
    granularity: AttendanceGranularity;
    editWindowMinutes: number;
    lateThresholdMinutes: number;
    halfDayMinMinutes: number;
    dayDerivation: DayDerivation;
  }): ServiceError | null {
    if (!GRANULARITIES.has(input.granularity)) {
      return { error: 'granularity must be day, session, or period', status: 400 };
    }
    const edit = Number(input.editWindowMinutes);
    if (!Number.isInteger(edit) || edit < 0 || edit > 1440) {
      return { error: 'edit_window_minutes must be an integer between 0 and 1440', status: 400 };
    }
    const late = Number(input.lateThresholdMinutes);
    if (!Number.isInteger(late) || late < 5 || late > 120) {
      return {
        error: 'late_threshold_minutes must be an integer between 5 and 120',
        status: 400,
      };
    }
    const half = Number(input.halfDayMinMinutes);
    if (!Number.isInteger(half) || half < 60 || half > 360) {
      return {
        error: 'half_day_min_minutes must be an integer between 60 and 360',
        status: 400,
      };
    }
    if (!DAY_DERIVATIONS.has(input.dayDerivation)) {
      return {
        error: 'day_derivation must be any_absent, majority, or half_day_minutes',
        status: 400,
      };
    }
    return null;
  }

  private async ensureSeeded(tenantId: string): Promise<void> {
    const count = await this.repo.countReasonCodes(tenantId);
    if (count > 0) return;
    for (const seed of DEFAULT_SEEDS) {
      await this.repo.insertReasonCode({
        id: uuidv4(),
        tenantId,
        code: seed.code,
        label: seed.label,
        bucket: seed.bucket,
        isActive: true,
        sort: seed.sort,
        createdAt: '',
        updatedAt: '',
      });
    }
  }

  private async ensureLeaveTypesSeeded(tenantId: string): Promise<void> {
    const count = await this.repo.countLeaveTypes(tenantId);
    if (count > 0) return;
    for (const seed of DEFAULT_LEAVE_TYPE_SEEDS) {
      await this.repo.insertLeaveType({
        id: uuidv4(),
        tenantId,
        code: seed.code,
        label: seed.label,
        annualQuota: seed.annualQuota,
        carryForward: false,
        isActive: true,
        createdAt: '',
        updatedAt: '',
      });
    }
  }

  async listLeaveTypes(
    tenantId: string,
  ): Promise<{ types?: LeaveType[]; error?: ServiceError }> {
    await this.ensureLeaveTypesSeeded(tenantId);
    return { types: await this.repo.listLeaveTypes(tenantId) };
  }

  async createLeaveType(
    tenantId: string,
    input: CreateLeaveTypeInput,
  ): Promise<{ type?: LeaveType; error?: ServiceError }> {
    await this.ensureLeaveTypesSeeded(tenantId);
    const code = (input.code || '').trim().toUpperCase();
    const label = (input.label || '').trim();
    const annualQuota = Number(input.annualQuota);
    if (!code) return { error: { error: 'code is required', status: 400 } };
    if (!label) return { error: { error: 'label is required', status: 400 } };
    if (!Number.isFinite(annualQuota) || annualQuota < 0) {
      return { error: { error: 'annual_quota must be a non-negative number', status: 400 } };
    }
    const existing = await this.repo.findLeaveTypeByCode(tenantId, code);
    if (existing) return { error: { error: 'code already exists', status: 409 } };
    const type = await this.repo.insertLeaveType({
      id: uuidv4(),
      tenantId,
      code,
      label,
      annualQuota,
      carryForward: input.carryForward === true,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    });
    return { type };
  }

  async patchLeaveType(
    tenantId: string,
    id: string,
    input: PatchLeaveTypeInput,
  ): Promise<{ type?: LeaveType; error?: ServiceError }> {
    await this.ensureLeaveTypesSeeded(tenantId);
    const current = await this.repo.getLeaveType(tenantId, id);
    if (!current) return { error: { error: 'leave type not found', status: 404 } };
    let label = current.label;
    let annualQuota = current.annualQuota;
    let carryForward = current.carryForward;
    let isActive = current.isActive;
    if (input.label !== undefined) {
      label = String(input.label).trim();
      if (!label) return { error: { error: 'label is required', status: 400 } };
    }
    if (input.annualQuota !== undefined) {
      annualQuota = Number(input.annualQuota);
      if (!Number.isFinite(annualQuota) || annualQuota < 0) {
        return { error: { error: 'annual_quota must be a non-negative number', status: 400 } };
      }
    }
    if (input.carryForward !== undefined) carryForward = input.carryForward === true;
    if (input.isActive !== undefined) isActive = input.isActive === true;
    const type = await this.repo.updateLeaveType(tenantId, id, {
      ...current,
      label,
      annualQuota,
      carryForward,
      isActive,
    });
    return { type: type! };
  }

  async createLeaveRequest(
    tenantId: string,
    input: CreateLeaveRequestInput,
  ): Promise<{ request?: LeaveRequest; error?: ServiceError }> {
    await this.ensureLeaveTypesSeeded(tenantId);
    const memberId = (input.memberId || '').trim();
    const leaveTypeId = (input.leaveTypeId || '').trim();
    const fromDate = (input.fromDate || '').trim();
    const toDate = (input.toDate || '').trim();
    const isHalfDay = input.isHalfDay === true;
    if (!memberId) return { error: { error: 'member_id is required', status: 400 } };
    if (!leaveTypeId) return { error: { error: 'leave_type_id is required', status: 400 } };
    if (!ISO_DATE.test(fromDate) || !ISO_DATE.test(toDate)) {
      return { error: { error: 'from_date and to_date must be ISO dates', status: 400 } };
    }
    if (toDate < fromDate) {
      return { error: { error: 'to_date must be on or after from_date', status: 400 } };
    }
    if (isHalfDay && fromDate !== toDate) {
      return { error: { error: 'is_half_day requires from_date === to_date', status: 400 } };
    }
    const dates = eachIsoDateInclusive(fromDate, toDate);
    if (dates.length > 30) {
      return { error: { error: 'span must be at most 30 days', status: 400 } };
    }
    const leaveType = await this.repo.getLeaveType(tenantId, leaveTypeId);
    if (!leaveType || !leaveType.isActive) {
      return { error: { error: 'leave type not found or inactive', status: 400 } };
    }
    const overlaps = await this.repo.listOverlappingLeaveRequests(
      tenantId,
      memberId,
      fromDate,
      toDate,
    );
    if (overlaps.length > 0) {
      return { error: { error: 'overlapping_request', status: 409 } };
    }
    const days = isHalfDay ? 0.5 : dates.length;
    const year = Number(fromDate.slice(0, 4));
    await this.ensureLeaveBalance(tenantId, memberId, leaveTypeId, year, leaveType);
    const request = await this.repo.insertLeaveRequest({
      id: uuidv4(),
      tenantId,
      memberId,
      leaveTypeId,
      fromDate,
      toDate,
      isHalfDay,
      days,
      reason: input.reason != null ? String(input.reason) : null,
      state: 'pending',
      decidedBy: null,
      decidedAt: null,
      decisionNote: null,
      createdAt: '',
      updatedAt: '',
    });
    return { request };
  }

  async decideLeaveRequest(
    tenantId: string,
    id: string,
    input: DecideLeaveInput,
  ): Promise<{
    request?: LeaveRequest;
    skipped_locked?: string[];
    error?: ServiceError;
  }> {
    await this.ensureLeaveTypesSeeded(tenantId);
    const current = await this.repo.getLeaveRequest(tenantId, id);
    if (!current) return { error: { error: 'leave request not found', status: 404 } };
    if (current.state !== 'pending') {
      return { error: { error: 'request is not pending', status: 409 } };
    }
    const decision = input.decision;
    if (decision !== 'approved' && decision !== 'rejected') {
      return { error: { error: 'decision must be approved or rejected', status: 400 } };
    }
    const decidedBy = (input.decidedBy || '').trim();
    if (!decidedBy) return { error: { error: 'decided_by is required', status: 400 } };
    const decisionNote =
      input.decisionNote != null ? String(input.decisionNote).trim() : '';

    if (decision === 'rejected') {
      if (!decisionNote) {
        return { error: { error: 'decision_note is required for rejection', status: 400 } };
      }
      const rejected = await this.repo.updateLeaveRequest(tenantId, id, {
        ...current,
        state: 'rejected',
        decidedBy,
        decidedAt: new Date().toISOString(),
        decisionNote,
      });
      return { request: rejected!, skipped_locked: [] };
    }

    const leaveType = await this.repo.getLeaveType(tenantId, current.leaveTypeId);
    if (!leaveType) return { error: { error: 'leave type not found', status: 400 } };
    const year = Number(current.fromDate.slice(0, 4));
    const balance = await this.ensureLeaveBalance(
      tenantId,
      current.memberId,
      current.leaveTypeId,
      year,
      leaveType,
    );
    const remaining = balance.opening - balance.used;
    if (remaining < current.days) {
      return {
        error: {
          error: 'insufficient_balance',
          status: 400,
          remaining,
        },
      };
    }

    const dates = eachIsoDateInclusive(current.fromDate, current.toDate);
    const skipped_locked: string[] = [];
    for (const date of dates) {
      const month = date.slice(0, 7);
      if (await this.repo.isStaffMonthLocked(tenantId, month)) {
        skipped_locked.push(date);
        continue;
      }
      const existing = await this.repo.findStaffByDay(tenantId, current.memberId, date);
      const payload: StaffAttendance = {
        id: existing?.id ?? uuidv4(),
        tenantId,
        memberId: current.memberId,
        date,
        checkInAt: existing?.checkInAt ?? null,
        checkOutAt: existing?.checkOutAt ?? null,
        status: 'on_leave',
        source: 'manual',
        minutesOnPremises: existing?.minutesOnPremises ?? null,
        markedBy: decidedBy,
        createdAt: '',
        updatedAt: '',
      };
      if (existing) {
        await this.repo.updateStaffAttendance(tenantId, existing.id, payload);
      } else {
        await this.repo.insertStaffAttendance(payload);
      }
    }

    await this.repo.updateLeaveBalanceUsed(
      tenantId,
      current.memberId,
      current.leaveTypeId,
      year,
      balance.used + current.days,
    );

    const approved = await this.repo.updateLeaveRequest(tenantId, id, {
      ...current,
      state: 'approved',
      decidedBy,
      decidedAt: new Date().toISOString(),
      decisionNote: decisionNote || null,
    });

    await this.events.publish({
      type: 'school.staff.leave_approved',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: {
        request_id: id,
        member_id: current.memberId,
        from_date: current.fromDate,
        to_date: current.toDate,
        days: current.days,
        skipped_locked,
        decided_by: decidedBy,
      },
    });

    return { request: approved!, skipped_locked };
  }

  async cancelLeaveRequest(
    tenantId: string,
    id: string,
    actor: string,
  ): Promise<{ request?: LeaveRequest; kept?: string[]; error?: ServiceError }> {
    const current = await this.repo.getLeaveRequest(tenantId, id);
    if (!current) return { error: { error: 'leave request not found', status: 404 } };
    if (current.state !== 'pending' && current.state !== 'approved') {
      return { error: { error: 'request cannot be cancelled', status: 409 } };
    }
    const actorId = (actor || '').trim();
    if (!actorId) return { error: { error: 'actor is required', status: 400 } };

    const dates = eachIsoDateInclusive(current.fromDate, current.toDate);
    for (const date of dates) {
      const month = date.slice(0, 7);
      if (await this.repo.isStaffMonthLocked(tenantId, month)) {
        return { error: { error: 'month is finalized', status: 409 } };
      }
    }

    const kept: string[] = [];
    if (current.state === 'approved') {
      const year = Number(current.fromDate.slice(0, 4));
      const balance = await this.repo.getLeaveBalance(
        tenantId,
        current.memberId,
        current.leaveTypeId,
        year,
      );
      if (balance) {
        await this.repo.updateLeaveBalanceUsed(
          tenantId,
          current.memberId,
          current.leaveTypeId,
          year,
          Math.max(0, balance.used - current.days),
        );
      }

      for (const date of dates) {
        const row = await this.repo.findStaffByDay(tenantId, current.memberId, date);
        if (!row) continue;
        if (row.status === 'on_leave') {
          await this.repo.deleteStaffAttendance(tenantId, row.id);
        } else {
          kept.push(date);
        }
      }
    }

    const cancelled = await this.repo.updateLeaveRequest(tenantId, id, {
      ...current,
      state: 'cancelled',
      decidedBy: current.decidedBy ?? actorId,
      decidedAt: current.decidedAt ?? new Date().toISOString(),
      decisionNote: current.decisionNote,
    });

    await this.events.publish({
      type: 'school.staff.leave_cancelled',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: {
        request_id: id,
        member_id: current.memberId,
        actor: actorId,
        previous_state: current.state,
        kept,
      },
    });

    return { request: cancelled!, kept };
  }

  async listLeaveRequests(
    tenantId: string,
    filters: { memberId?: string; state?: string; year?: number },
  ): Promise<{ requests?: LeaveRequest[]; error?: ServiceError }> {
    await this.ensureLeaveTypesSeeded(tenantId);
    let state: LeaveRequestState | undefined;
    if (filters.state) {
      if (!LEAVE_STATES.has(filters.state as LeaveRequestState)) {
        return { error: { error: 'invalid state', status: 400 } };
      }
      state = filters.state as LeaveRequestState;
    }
    const requests = await this.repo.listLeaveRequests(tenantId, {
      memberId: filters.memberId,
      state,
      year: filters.year,
    });
    return { requests };
  }

  async listLeaveBalances(
    tenantId: string,
    memberId: string,
    year: number,
  ): Promise<{
    balances?: Array<LeaveBalance & { remaining: number; leaveType?: LeaveType }>;
    error?: ServiceError;
  }> {
    await this.ensureLeaveTypesSeeded(tenantId);
    const mid = (memberId || '').trim();
    if (!mid) return { error: { error: 'member_id is required', status: 400 } };
    if (!Number.isInteger(year) || year < 2000) {
      return { error: { error: 'year is required', status: 400 } };
    }
    const types = await this.repo.listLeaveTypes(tenantId);
    const balances: Array<LeaveBalance & { remaining: number; leaveType?: LeaveType }> = [];
    for (const t of types.filter((x) => x.isActive)) {
      const bal = await this.ensureLeaveBalance(tenantId, mid, t.id, year, t);
      balances.push({ ...bal, remaining: bal.opening - bal.used, leaveType: t });
    }
    return { balances };
  }

  private async ensureLeaveBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    year: number,
    leaveType: LeaveType,
  ): Promise<LeaveBalance> {
    const existing = await this.repo.getLeaveBalance(
      tenantId,
      memberId,
      leaveTypeId,
      year,
    );
    if (existing) return existing;
    let opening = leaveType.annualQuota;
    if (leaveType.carryForward) {
      const prev = await this.repo.getLeaveBalance(
        tenantId,
        memberId,
        leaveTypeId,
        year - 1,
      );
      if (prev) {
        opening += Math.max(0, prev.opening - prev.used);
      }
    }
    return this.repo.insertLeaveBalance({
      tenantId,
      memberId,
      leaveTypeId,
      year,
      opening,
      used: 0,
    });
  }

  private validateCreate(
    input: CreateReasonCodeInput,
  ):
    | Omit<ReasonCode, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>
    | ServiceError {
    const code = (input.code || '').trim().toUpperCase();
    const label = (input.label || '').trim();
    if (!code) return { error: 'code is required', status: 400 };
    if (!label) return { error: 'label is required', status: 400 };
    if (!BUCKETS.has(input.bucket)) {
      return {
        error: 'bucket must be authorised, unauthorised, medical, or school_activity',
        status: 400,
      };
    }
    const sort = input.sort !== undefined ? Number(input.sort) : 100;
    if (!Number.isInteger(sort)) {
      return { error: 'sort must be an integer', status: 400 };
    }
    return {
      code,
      label,
      bucket: input.bucket,
      isActive: input.isActive !== undefined ? !!input.isActive : true,
      sort,
    };
  }
}
