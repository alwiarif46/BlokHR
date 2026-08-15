import type { SchoolAttendanceDb } from '../db';
import type {
  AttendanceAuditRow,
  AttendanceExcuse,
  AttendanceGranularity,
  AttendanceRecord,
  AttendanceSettings,
  AttendanceSource,
  AttendanceStatus,
  CaptureBinding,
  CaptureDecision,
  CaptureEvent,
  CaptureModality,
  CaptureSubjectType,
  DayDerivation,
  NudgeAssignment,
  NudgeCohort,
  NudgeConfig,
  NudgeMessage,
  NudgeTier,
  ReasonBucket,
  ReasonCode,
  ReportedAbsence,
  ReportedAbsenceChannel,
  SessionPart,
  StaffAttendance,
  StaffAttendanceSource,
  StaffAttendanceStatus,
  AttendanceMonthlyRollup,
  LeaveBalance,
  LeaveRequest,
  LeaveRequestState,
  LeaveType,
} from '../types';

interface ReasonCodeRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  bucket: string;
  is_active: number;
  sort: number;
  created_at: string;
  updated_at: string;
}

function mapReasonCode(row: ReasonCodeRow): ReasonCode {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    label: row.label,
    bucket: row.bucket as ReasonBucket,
    isActive: row.is_active === 1,
    sort: row.sort,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class AttendanceRepository {
  constructor(private readonly db: SchoolAttendanceDb) {}

  async countReasonCodes(tenantId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM reason_codes WHERE tenant_id = ?',
      [tenantId],
    );
    return Number(row?.c ?? 0);
  }

  async listReasonCodes(tenantId: string): Promise<ReasonCode[]> {
    const rows = await this.db.all<ReasonCodeRow>(
      `SELECT * FROM reason_codes
       WHERE tenant_id = ?
       ORDER BY sort ASC, code ASC`,
      [tenantId],
    );
    return rows.map(mapReasonCode);
  }

  async getReasonCode(tenantId: string, id: string): Promise<ReasonCode | null> {
    const row = await this.db.get<ReasonCodeRow>(
      'SELECT * FROM reason_codes WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapReasonCode(row) : null;
  }

  async findReasonCodeByCode(tenantId: string, code: string): Promise<ReasonCode | null> {
    const row = await this.db.get<ReasonCodeRow>(
      'SELECT * FROM reason_codes WHERE tenant_id = ? AND code = ?',
      [tenantId, code],
    );
    return row ? mapReasonCode(row) : null;
  }

  async insertReasonCode(r: ReasonCode): Promise<ReasonCode> {
    await this.db.run(
      `INSERT INTO reason_codes (id, tenant_id, code, label, bucket, is_active, sort)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [r.id, r.tenantId, r.code, r.label, r.bucket, r.isActive ? 1 : 0, r.sort],
    );
    const created = await this.getReasonCode(r.tenantId, r.id);
    if (!created) throw new Error('Failed to read inserted reason code');
    return created;
  }

  async updateReasonCode(tenantId: string, id: string, next: ReasonCode): Promise<ReasonCode | null> {
    await this.db.run(
      `UPDATE reason_codes SET
         code = ?, label = ?, bucket = ?, is_active = ?, sort = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.code, next.label, next.bucket, next.isActive ? 1 : 0, next.sort, tenantId, id],
    );
    return this.getReasonCode(tenantId, id);
  }

  async getSettings(tenantId: string): Promise<AttendanceSettings | null> {
    const row = await this.db.get<SettingsRow>(
      'SELECT * FROM attendance_settings WHERE tenant_id = ?',
      [tenantId],
    );
    return row ? mapSettings(row) : null;
  }

  async insertSettings(s: AttendanceSettings): Promise<AttendanceSettings> {
    await this.db.run(
      `INSERT INTO attendance_settings (
         tenant_id, granularity, edit_window_minutes, late_threshold_minutes,
         half_day_min_minutes, day_derivation
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        s.tenantId,
        s.granularity,
        s.editWindowMinutes,
        s.lateThresholdMinutes,
        s.halfDayMinMinutes,
        s.dayDerivation,
      ],
    );
    const created = await this.getSettings(s.tenantId);
    if (!created) throw new Error('Failed to read inserted settings');
    return created;
  }

  async updateSettings(s: AttendanceSettings): Promise<AttendanceSettings> {
    await this.db.run(
      `UPDATE attendance_settings SET
         granularity = ?, edit_window_minutes = ?, late_threshold_minutes = ?,
         half_day_min_minutes = ?, day_derivation = ?, updated_at = datetime('now')
       WHERE tenant_id = ?`,
      [
        s.granularity,
        s.editWindowMinutes,
        s.lateThresholdMinutes,
        s.halfDayMinMinutes,
        s.dayDerivation,
        s.tenantId,
      ],
    );
    const updated = await this.getSettings(s.tenantId);
    if (!updated) throw new Error('Failed to read updated settings');
    return updated;
  }

  async getRecord(tenantId: string, id: string): Promise<AttendanceRecord | null> {
    const row = await this.db.get<RecordRow>(
      'SELECT * FROM attendance_records WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapRecord(row) : null;
  }

  async findRecordBySlot(
    tenantId: string,
    studentId: string,
    date: string,
    periodInstanceId: string | null,
    sessionPart: string | null,
  ): Promise<AttendanceRecord | null> {
    const row = await this.db.get<RecordRow>(
      `SELECT * FROM attendance_records
       WHERE tenant_id = ? AND student_id = ? AND date = ?
         AND COALESCE(period_instance_id, '') = ?
         AND COALESCE(session_part, '') = ?`,
      [tenantId, studentId, date, periodInstanceId ?? '', sessionPart ?? ''],
    );
    return row ? mapRecord(row) : null;
  }

  async listRecordsByIdempotencyPrefix(
    tenantId: string,
    batchKey: string,
  ): Promise<AttendanceRecord[]> {
    const rows = await this.db.all<RecordRow>(
      `SELECT * FROM attendance_records
       WHERE tenant_id = ? AND idempotency_key LIKE ?
       ORDER BY student_id ASC`,
      [tenantId, `${batchKey}::%`],
    );
    return rows.map(mapRecord);
  }

  async listRecordsForStudentsOnDate(
    tenantId: string,
    date: string,
    studentIds: string[],
  ): Promise<AttendanceRecord[]> {
    if (studentIds.length === 0) return [];
    const placeholders = studentIds.map(() => '?').join(',');
    const rows = await this.db.all<RecordRow>(
      `SELECT * FROM attendance_records
       WHERE tenant_id = ? AND date = ? AND student_id IN (${placeholders})
       ORDER BY student_id ASC`,
      [tenantId, date, ...studentIds],
    );
    return rows.map(mapRecord);
  }

  async insertRecord(r: AttendanceRecord): Promise<AttendanceRecord> {
    await this.db.run(
      `INSERT INTO attendance_records (
         id, tenant_id, student_id, date, period_instance_id, session_part,
         status, excuse, reason_code_id, late_minutes, marked_by, marked_at,
         source, device_id, idempotency_key
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.tenantId,
        r.studentId,
        r.date,
        r.periodInstanceId,
        r.sessionPart,
        r.status,
        r.excuse,
        r.reasonCodeId,
        r.lateMinutes,
        r.markedBy,
        r.markedAt,
        r.source,
        r.deviceId,
        r.idempotencyKey,
      ],
    );
    const created = await this.getRecord(r.tenantId, r.id);
    if (!created) throw new Error('Failed to read inserted record');
    return created;
  }

  async updateRecord(
    tenantId: string,
    id: string,
    next: AttendanceRecord,
  ): Promise<AttendanceRecord | null> {
    await this.db.run(
      `UPDATE attendance_records SET
         status = ?, excuse = ?, reason_code_id = ?, late_minutes = ?,
         marked_by = ?, marked_at = ?, source = ?, device_id = ?,
         idempotency_key = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.status,
        next.excuse,
        next.reasonCodeId,
        next.lateMinutes,
        next.markedBy,
        next.markedAt,
        next.source,
        next.deviceId,
        next.idempotencyKey,
        tenantId,
        id,
      ],
    );
    return this.getRecord(tenantId, id);
  }

  async insertAudit(a: AttendanceAuditRow): Promise<void> {
    await this.db.run(
      `INSERT INTO attendance_audit (id, tenant_id, record_id, before_json, after_json, actor, at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [a.id, a.tenantId, a.recordId, a.beforeJson, a.afterJson, a.actor, a.at],
    );
  }

  async listAuditForRecord(tenantId: string, recordId: string): Promise<AttendanceAuditRow[]> {
    const rows = await this.db.all<AuditRow>(
      `SELECT * FROM attendance_audit
       WHERE tenant_id = ? AND record_id = ?
       ORDER BY at ASC`,
      [tenantId, recordId],
    );
    return rows.map(mapAudit);
  }

  async countRecords(tenantId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM attendance_records WHERE tenant_id = ?',
      [tenantId],
    );
    return Number(row?.c ?? 0);
  }

  async findActiveBindingByHash(
    tenantId: string,
    modality: CaptureModality,
    payloadHash: string,
  ): Promise<CaptureBinding | null> {
    const row = await this.db.get<BindingRow>(
      `SELECT * FROM capture_bindings
       WHERE tenant_id = ? AND modality = ? AND payload_hash = ? AND is_active = 1`,
      [tenantId, modality, payloadHash],
    );
    return row ? mapBinding(row) : null;
  }

  async getBinding(tenantId: string, id: string): Promise<CaptureBinding | null> {
    const row = await this.db.get<BindingRow>(
      'SELECT * FROM capture_bindings WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapBinding(row) : null;
  }

  async insertBinding(b: CaptureBinding): Promise<CaptureBinding> {
    await this.db.run(
      `INSERT INTO capture_bindings (
         id, tenant_id, subject_type, subject_id, modality, payload_hash, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        b.id,
        b.tenantId,
        b.subjectType,
        b.subjectId,
        b.modality,
        b.payloadHash,
        b.isActive ? 1 : 0,
      ],
    );
    const created = await this.getBinding(b.tenantId, b.id);
    if (!created) throw new Error('Failed to read inserted capture binding');
    return created;
  }

  async deactivateBinding(tenantId: string, id: string): Promise<CaptureBinding | null> {
    await this.db.run(
      `UPDATE capture_bindings SET is_active = 0
       WHERE tenant_id = ? AND id = ?`,
      [tenantId, id],
    );
    return this.getBinding(tenantId, id);
  }

  async getCaptureEventByIdempotency(
    tenantId: string,
    idempotencyKey: string,
  ): Promise<CaptureEvent | null> {
    const row = await this.db.get<EventRow>(
      `SELECT * FROM capture_events
       WHERE tenant_id = ? AND idempotency_key = ?`,
      [tenantId, idempotencyKey],
    );
    return row ? mapEvent(row) : null;
  }

  async findRecentCaptureByHashAndContext(
    tenantId: string,
    payloadHash: string,
    contextJson: string,
    sinceIso: string,
  ): Promise<CaptureEvent | null> {
    const row = await this.db.get<EventRow>(
      `SELECT * FROM capture_events
       WHERE tenant_id = ? AND payload_hash = ? AND context_json = ?
         AND at >= ?
       ORDER BY at DESC
       LIMIT 1`,
      [tenantId, payloadHash, contextJson, sinceIso],
    );
    return row ? mapEvent(row) : null;
  }

  async findRecentCaptureOtherDevice(
    tenantId: string,
    payloadHash: string,
    deviceId: string,
    sinceIso: string,
  ): Promise<CaptureEvent | null> {
    const row = await this.db.get<EventRow>(
      `SELECT * FROM capture_events
       WHERE tenant_id = ? AND payload_hash = ?
         AND device_id != ? AND at >= ?
         AND decision = 'matched'
       ORDER BY at DESC
       LIMIT 1`,
      [tenantId, payloadHash, deviceId, sinceIso],
    );
    return row ? mapEvent(row) : null;
  }

  async insertCaptureEvent(e: CaptureEvent): Promise<CaptureEvent> {
    await this.db.run(
      `INSERT INTO capture_events (
         id, tenant_id, device_id, modality, payload_hash, matched_subject_id,
         decision, context_json, idempotency_key, at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.id,
        e.tenantId,
        e.deviceId,
        e.modality,
        e.payloadHash,
        e.matchedSubjectId,
        e.decision,
        e.contextJson,
        e.idempotencyKey,
        e.at,
      ],
    );
    const created = await this.getCaptureEvent(e.tenantId, e.id);
    if (!created) throw new Error('Failed to read inserted capture event');
    return created;
  }

  async getCaptureEvent(tenantId: string, id: string): Promise<CaptureEvent | null> {
    const row = await this.db.get<EventRow>(
      'SELECT * FROM capture_events WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapEvent(row) : null;
  }

  async listCaptureEvents(
    tenantId: string,
    filters: { date?: string; decision?: CaptureDecision },
  ): Promise<CaptureEvent[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.date) {
      clauses.push(`json_extract(context_json, '$.date') = ?`);
      params.push(filters.date);
    }
    if (filters.decision) {
      clauses.push('decision = ?');
      params.push(filters.decision);
    }
    const rows = await this.db.all<EventRow>(
      `SELECT * FROM capture_events
       WHERE ${clauses.join(' AND ')}
       ORDER BY at DESC`,
      params,
    );
    return rows.map(mapEvent);
  }

  async findStaffByDay(
    tenantId: string,
    memberId: string,
    date: string,
  ): Promise<StaffAttendance | null> {
    const row = await this.db.get<StaffRow>(
      `SELECT * FROM staff_attendance
       WHERE tenant_id = ? AND member_id = ? AND date = ?`,
      [tenantId, memberId, date],
    );
    return row ? mapStaff(row) : null;
  }

  async getStaffAttendance(tenantId: string, id: string): Promise<StaffAttendance | null> {
    const row = await this.db.get<StaffRow>(
      'SELECT * FROM staff_attendance WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapStaff(row) : null;
  }

  async insertStaffAttendance(r: StaffAttendance): Promise<StaffAttendance> {
    await this.db.run(
      `INSERT INTO staff_attendance (
         id, tenant_id, member_id, date, check_in_at, check_out_at,
         status, source, minutes_on_premises, marked_by
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.tenantId,
        r.memberId,
        r.date,
        r.checkInAt,
        r.checkOutAt,
        r.status,
        r.source,
        r.minutesOnPremises,
        r.markedBy,
      ],
    );
    const created = await this.getStaffAttendance(r.tenantId, r.id);
    if (!created) throw new Error('Failed to read inserted staff attendance');
    return created;
  }

  async updateStaffAttendance(
    tenantId: string,
    id: string,
    next: StaffAttendance,
  ): Promise<StaffAttendance | null> {
    await this.db.run(
      `UPDATE staff_attendance SET
         check_in_at = ?, check_out_at = ?, status = ?, source = ?,
         minutes_on_premises = ?, marked_by = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.checkInAt,
        next.checkOutAt,
        next.status,
        next.source,
        next.minutesOnPremises,
        next.markedBy,
        tenantId,
        id,
      ],
    );
    return this.getStaffAttendance(tenantId, id);
  }

  async listStaffForMonth(
    tenantId: string,
    month: string,
    memberId?: string,
  ): Promise<StaffAttendance[]> {
    const clauses = ['tenant_id = ?', `substr(date, 1, 7) = ?`];
    const params: unknown[] = [tenantId, month];
    if (memberId) {
      clauses.push('member_id = ?');
      params.push(memberId);
    }
    const rows = await this.db.all<StaffRow>(
      `SELECT * FROM staff_attendance
       WHERE ${clauses.join(' AND ')}
       ORDER BY date ASC, member_id ASC`,
      params,
    );
    return rows.map(mapStaff);
  }

  async isStaffMonthLocked(tenantId: string, month: string): Promise<boolean> {
    const row = await this.db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM staff_locks WHERE tenant_id = ? AND month = ?',
      [tenantId, month],
    );
    return Number(row?.c ?? 0) > 0;
  }

  async insertStaffLock(
    tenantId: string,
    month: string,
    finalizedBy: string | null,
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO staff_locks (tenant_id, month, finalized_by)
       VALUES (?, ?, ?)`,
      [tenantId, month, finalizedBy],
    );
  }

  async getReportedAbsence(tenantId: string, id: string): Promise<ReportedAbsence | null> {
    const row = await this.db.get<ReportedRow>(
      'SELECT * FROM reported_absences WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapReported(row) : null;
  }

  async findReportedByStudentGuardian(
    tenantId: string,
    studentId: string,
    guardianId: string,
  ): Promise<ReportedAbsence | null> {
    const row = await this.db.get<ReportedRow>(
      `SELECT * FROM reported_absences
       WHERE tenant_id = ? AND student_id = ? AND reported_by_guardian_id = ?
       ORDER BY created_at ASC
       LIMIT 1`,
      [tenantId, studentId, guardianId],
    );
    return row ? mapReported(row) : null;
  }

  async listReportedForStudent(
    tenantId: string,
    studentId: string,
  ): Promise<ReportedAbsence[]> {
    const rows = await this.db.all<ReportedRow>(
      `SELECT * FROM reported_absences
       WHERE tenant_id = ? AND student_id = ?
       ORDER BY created_at ASC`,
      [tenantId, studentId],
    );
    return rows.map(mapReported);
  }

  async listReportedCoveringDate(
    tenantId: string,
    date: string,
  ): Promise<ReportedAbsence[]> {
    const rows = await this.db.all<ReportedRow>(
      `SELECT * FROM reported_absences WHERE tenant_id = ?`,
      [tenantId],
    );
    return rows.map(mapReported).filter((r) => r.dates.includes(date));
  }

  async findReportedCoveringStudentDate(
    tenantId: string,
    studentId: string,
    date: string,
  ): Promise<ReportedAbsence | null> {
    const rows = await this.listReportedForStudent(tenantId, studentId);
    return rows.find((r) => r.dates.includes(date)) ?? null;
  }

  async insertReportedAbsence(r: ReportedAbsence): Promise<ReportedAbsence> {
    await this.db.run(
      `INSERT INTO reported_absences (
         id, tenant_id, student_id, reported_by_guardian_id, dates_json,
         reason_code_id, note, attachment_ref, channel
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.tenantId,
        r.studentId,
        r.reportedByGuardianId,
        JSON.stringify(r.dates),
        r.reasonCodeId,
        r.note,
        r.attachmentRef,
        r.channel,
      ],
    );
    const created = await this.getReportedAbsence(r.tenantId, r.id);
    if (!created) throw new Error('Failed to read inserted reported absence');
    return created;
  }

  async updateReportedAbsence(
    tenantId: string,
    id: string,
    next: ReportedAbsence,
  ): Promise<ReportedAbsence | null> {
    await this.db.run(
      `UPDATE reported_absences SET
         dates_json = ?, reason_code_id = ?, note = ?, attachment_ref = ?,
         channel = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        JSON.stringify(next.dates),
        next.reasonCodeId,
        next.note,
        next.attachmentRef,
        next.channel,
        tenantId,
        id,
      ],
    );
    return this.getReportedAbsence(tenantId, id);
  }

  async listAbsentRecordsOnDate(
    tenantId: string,
    date: string,
  ): Promise<AttendanceRecord[]> {
    const rows = await this.db.all<RecordRow>(
      `SELECT * FROM attendance_records
       WHERE tenant_id = ? AND date = ? AND status = 'absent'
       ORDER BY student_id ASC`,
      [tenantId, date],
    );
    return rows.map(mapRecord);
  }

  async listAbsentRecordsForStudentDates(
    tenantId: string,
    studentId: string,
    dates: string[],
  ): Promise<AttendanceRecord[]> {
    if (dates.length === 0) return [];
    const placeholders = dates.map(() => '?').join(',');
    const rows = await this.db.all<RecordRow>(
      `SELECT * FROM attendance_records
       WHERE tenant_id = ? AND student_id = ? AND status = 'absent'
         AND date IN (${placeholders})
       ORDER BY date ASC`,
      [tenantId, studentId, ...dates],
    );
    return rows.map(mapRecord);
  }

  async listRecordsForMonth(tenantId: string, month: string): Promise<AttendanceRecord[]> {
    const rows = await this.db.all<RecordRow>(
      `SELECT * FROM attendance_records
       WHERE tenant_id = ? AND substr(date, 1, 7) = ?
       ORDER BY student_id ASC, date ASC`,
      [tenantId, month],
    );
    return rows.map(mapRecord);
  }

  async listRecordsForStudentDateRange(
    tenantId: string,
    studentId: string,
    from: string,
    to: string,
  ): Promise<AttendanceRecord[]> {
    const rows = await this.db.all<RecordRow>(
      `SELECT * FROM attendance_records
       WHERE tenant_id = ? AND student_id = ? AND date >= ? AND date <= ?
       ORDER BY date ASC`,
      [tenantId, studentId, from, to],
    );
    return rows.map(mapRecord);
  }

  async upsertMonthlyRollup(r: AttendanceMonthlyRollup): Promise<AttendanceMonthlyRollup> {
    await this.db.run(
      `INSERT INTO attendance_monthly_rollups (
         tenant_id, student_id, month, working_days, present_days, absent_days,
         late_count, pct, computed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(tenant_id, student_id, month) DO UPDATE SET
         working_days = excluded.working_days,
         present_days = excluded.present_days,
         absent_days = excluded.absent_days,
         late_count = excluded.late_count,
         pct = excluded.pct,
         computed_at = excluded.computed_at`,
      [
        r.tenantId,
        r.studentId,
        r.month,
        r.workingDays,
        r.presentDays,
        r.absentDays,
        r.lateCount,
        r.pct,
        r.computedAt,
      ],
    );
    const saved = await this.getMonthlyRollup(r.tenantId, r.studentId, r.month);
    if (!saved) throw new Error('Failed to read upserted rollup');
    return saved;
  }

  async getMonthlyRollup(
    tenantId: string,
    studentId: string,
    month: string,
  ): Promise<AttendanceMonthlyRollup | null> {
    const row = await this.db.get<RollupRow>(
      `SELECT * FROM attendance_monthly_rollups
       WHERE tenant_id = ? AND student_id = ? AND month = ?`,
      [tenantId, studentId, month],
    );
    return row ? mapRollup(row) : null;
  }

  async listMonthlyRollups(
    tenantId: string,
    month: string,
  ): Promise<AttendanceMonthlyRollup[]> {
    const rows = await this.db.all<RollupRow>(
      `SELECT * FROM attendance_monthly_rollups
       WHERE tenant_id = ? AND month = ?
       ORDER BY student_id ASC`,
      [tenantId, month],
    );
    return rows.map(mapRollup);
  }

  async listStudentRollups(
    tenantId: string,
    studentId: string,
  ): Promise<AttendanceMonthlyRollup[]> {
    const rows = await this.db.all<RollupRow>(
      `SELECT * FROM attendance_monthly_rollups
       WHERE tenant_id = ? AND student_id = ?
       ORDER BY month ASC`,
      [tenantId, studentId],
    );
    return rows.map(mapRollup);
  }

  async listAllRollups(tenantId: string): Promise<AttendanceMonthlyRollup[]> {
    const rows = await this.db.all<RollupRow>(
      `SELECT * FROM attendance_monthly_rollups
       WHERE tenant_id = ?
       ORDER BY student_id ASC, month ASC`,
      [tenantId],
    );
    return rows.map(mapRollup);
  }

  async listAbsentDatesForStudent(
    tenantId: string,
    studentId: string,
    onOrBefore: string,
  ): Promise<string[]> {
    const rows = await this.db.all<{ date: string }>(
      `SELECT DISTINCT date FROM attendance_records
       WHERE tenant_id = ? AND student_id = ? AND status = 'absent' AND date <= ?
       ORDER BY date DESC`,
      [tenantId, studentId, onOrBefore],
    );
    return rows.map((r) => r.date);
  }

  async getNudgeConfig(tenantId: string): Promise<NudgeConfig | null> {
    const row = await this.db.get<NudgeConfigRow>(
      'SELECT * FROM nudge_config WHERE tenant_id = ?',
      [tenantId],
    );
    return row ? mapNudgeConfig(row) : null;
  }

  async insertNudgeConfig(c: NudgeConfig): Promise<NudgeConfig> {
    await this.db.run(
      `INSERT INTO nudge_config (
         tenant_id, enabled, at_risk_pct, chronic_days, holdout_pct, max_messages_per_term
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        c.tenantId,
        c.enabled ? 1 : 0,
        c.atRiskPct,
        c.chronicDays,
        c.holdoutPct,
        c.maxMessagesPerTerm,
      ],
    );
    const created = await this.getNudgeConfig(c.tenantId);
    if (!created) throw new Error('Failed to read inserted nudge config');
    return created;
  }

  async updateNudgeConfig(c: NudgeConfig): Promise<NudgeConfig> {
    await this.db.run(
      `UPDATE nudge_config SET
         enabled = ?, at_risk_pct = ?, chronic_days = ?, holdout_pct = ?,
         max_messages_per_term = ?, updated_at = datetime('now')
       WHERE tenant_id = ?`,
      [
        c.enabled ? 1 : 0,
        c.atRiskPct,
        c.chronicDays,
        c.holdoutPct,
        c.maxMessagesPerTerm,
        c.tenantId,
      ],
    );
    const updated = await this.getNudgeConfig(c.tenantId);
    if (!updated) throw new Error('Failed to read updated nudge config');
    return updated;
  }

  async getNudgeAssignment(
    tenantId: string,
    studentId: string,
  ): Promise<NudgeAssignment | null> {
    const row = await this.db.get<NudgeAssignmentRow>(
      `SELECT * FROM nudge_assignments
       WHERE tenant_id = ? AND student_id = ?`,
      [tenantId, studentId],
    );
    return row ? mapNudgeAssignment(row) : null;
  }

  async insertNudgeAssignment(a: NudgeAssignment): Promise<NudgeAssignment> {
    await this.db.run(
      `INSERT INTO nudge_assignments (tenant_id, student_id, cohort, assigned_at)
       VALUES (?, ?, ?, ?)`,
      [a.tenantId, a.studentId, a.cohort, a.assignedAt],
    );
    return (await this.getNudgeAssignment(a.tenantId, a.studentId))!;
  }

  async listNudgeAssignments(tenantId: string): Promise<NudgeAssignment[]> {
    const rows = await this.db.all<NudgeAssignmentRow>(
      `SELECT * FROM nudge_assignments WHERE tenant_id = ?`,
      [tenantId],
    );
    return rows.map(mapNudgeAssignment);
  }

  async countNudgeMessagesInTerm(
    tenantId: string,
    studentId: string,
    termYear: string,
  ): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM nudge_messages
       WHERE tenant_id = ? AND student_id = ? AND substr(created_at, 1, 4) = ?`,
      [tenantId, studentId, termYear],
    );
    return Number(row?.c ?? 0);
  }

  async insertNudgeMessage(m: NudgeMessage): Promise<NudgeMessage> {
    await this.db.run(
      `INSERT INTO nudge_messages (
         id, tenant_id, student_id, tier, ytd_absent_days, class_percentile,
         rendered_vars_json, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        m.id,
        m.tenantId,
        m.studentId,
        m.tier,
        m.ytdAbsentDays,
        m.classPercentile,
        JSON.stringify(m.renderedVars),
        m.createdAt,
      ],
    );
    const created = await this.getNudgeMessage(m.tenantId, m.id);
    if (!created) throw new Error('Failed to read inserted nudge message');
    return created;
  }

  async getNudgeMessage(tenantId: string, id: string): Promise<NudgeMessage | null> {
    const row = await this.db.get<NudgeMessageRow>(
      'SELECT * FROM nudge_messages WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapNudgeMessage(row) : null;
  }

  async listNudgeMessages(tenantId: string): Promise<NudgeMessage[]> {
    const rows = await this.db.all<NudgeMessageRow>(
      `SELECT * FROM nudge_messages WHERE tenant_id = ? ORDER BY created_at ASC`,
      [tenantId],
    );
    return rows.map(mapNudgeMessage);
  }

  async countNudgeMessagesForStudents(
    tenantId: string,
    studentIds: string[],
  ): Promise<number> {
    if (studentIds.length === 0) return 0;
    const placeholders = studentIds.map(() => '?').join(',');
    const row = await this.db.get<{ c: number }>(
      `SELECT COUNT(*) as c FROM nudge_messages
       WHERE tenant_id = ? AND student_id IN (${placeholders})`,
      [tenantId, ...studentIds],
    );
    return Number(row?.c ?? 0);
  }

  async deleteStaffAttendance(tenantId: string, id: string): Promise<void> {
    await this.db.run('DELETE FROM staff_attendance WHERE tenant_id = ? AND id = ?', [
      tenantId,
      id,
    ]);
  }

  async countLeaveTypes(tenantId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT COUNT(*) as c FROM leave_types WHERE tenant_id = ?',
      [tenantId],
    );
    return Number(row?.c ?? 0);
  }

  async listLeaveTypes(tenantId: string): Promise<LeaveType[]> {
    const rows = await this.db.all<LeaveTypeRow>(
      `SELECT * FROM leave_types WHERE tenant_id = ? ORDER BY code ASC`,
      [tenantId],
    );
    return rows.map(mapLeaveType);
  }

  async getLeaveType(tenantId: string, id: string): Promise<LeaveType | null> {
    const row = await this.db.get<LeaveTypeRow>(
      'SELECT * FROM leave_types WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapLeaveType(row) : null;
  }

  async findLeaveTypeByCode(tenantId: string, code: string): Promise<LeaveType | null> {
    const row = await this.db.get<LeaveTypeRow>(
      'SELECT * FROM leave_types WHERE tenant_id = ? AND code = ?',
      [tenantId, code],
    );
    return row ? mapLeaveType(row) : null;
  }

  async insertLeaveType(t: LeaveType): Promise<LeaveType> {
    await this.db.run(
      `INSERT INTO leave_types (
         id, tenant_id, code, label, annual_quota, carry_forward, is_active
       ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        t.id,
        t.tenantId,
        t.code,
        t.label,
        t.annualQuota,
        t.carryForward ? 1 : 0,
        t.isActive ? 1 : 0,
      ],
    );
    const created = await this.getLeaveType(t.tenantId, t.id);
    if (!created) throw new Error('Failed to read inserted leave type');
    return created;
  }

  async updateLeaveType(tenantId: string, id: string, next: LeaveType): Promise<LeaveType | null> {
    await this.db.run(
      `UPDATE leave_types SET
         label = ?, annual_quota = ?, carry_forward = ?, is_active = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.label,
        next.annualQuota,
        next.carryForward ? 1 : 0,
        next.isActive ? 1 : 0,
        tenantId,
        id,
      ],
    );
    return this.getLeaveType(tenantId, id);
  }

  async getLeaveBalance(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    year: number,
  ): Promise<LeaveBalance | null> {
    const row = await this.db.get<LeaveBalanceRow>(
      `SELECT * FROM leave_balances
       WHERE tenant_id = ? AND member_id = ? AND leave_type_id = ? AND year = ?`,
      [tenantId, memberId, leaveTypeId, year],
    );
    return row ? mapLeaveBalance(row) : null;
  }

  async insertLeaveBalance(b: LeaveBalance): Promise<LeaveBalance> {
    await this.db.run(
      `INSERT INTO leave_balances (
         tenant_id, member_id, leave_type_id, year, opening, used
       ) VALUES (?, ?, ?, ?, ?, ?)`,
      [b.tenantId, b.memberId, b.leaveTypeId, b.year, b.opening, b.used],
    );
    const created = await this.getLeaveBalance(
      b.tenantId,
      b.memberId,
      b.leaveTypeId,
      b.year,
    );
    if (!created) throw new Error('Failed to read inserted leave balance');
    return created;
  }

  async updateLeaveBalanceUsed(
    tenantId: string,
    memberId: string,
    leaveTypeId: string,
    year: number,
    used: number,
  ): Promise<LeaveBalance | null> {
    await this.db.run(
      `UPDATE leave_balances SET used = ?
       WHERE tenant_id = ? AND member_id = ? AND leave_type_id = ? AND year = ?`,
      [used, tenantId, memberId, leaveTypeId, year],
    );
    return this.getLeaveBalance(tenantId, memberId, leaveTypeId, year);
  }

  async listLeaveBalances(
    tenantId: string,
    memberId: string,
    year: number,
  ): Promise<LeaveBalance[]> {
    const rows = await this.db.all<LeaveBalanceRow>(
      `SELECT * FROM leave_balances
       WHERE tenant_id = ? AND member_id = ? AND year = ?
       ORDER BY leave_type_id ASC`,
      [tenantId, memberId, year],
    );
    return rows.map(mapLeaveBalance);
  }

  async getLeaveRequest(tenantId: string, id: string): Promise<LeaveRequest | null> {
    const row = await this.db.get<LeaveRequestRow>(
      'SELECT * FROM leave_requests WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapLeaveRequest(row) : null;
  }

  async insertLeaveRequest(r: LeaveRequest): Promise<LeaveRequest> {
    await this.db.run(
      `INSERT INTO leave_requests (
         id, tenant_id, member_id, leave_type_id, from_date, to_date, is_half_day,
         days, reason, state, decided_by, decided_at, decision_note
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        r.id,
        r.tenantId,
        r.memberId,
        r.leaveTypeId,
        r.fromDate,
        r.toDate,
        r.isHalfDay ? 1 : 0,
        r.days,
        r.reason,
        r.state,
        r.decidedBy,
        r.decidedAt,
        r.decisionNote,
      ],
    );
    const created = await this.getLeaveRequest(r.tenantId, r.id);
    if (!created) throw new Error('Failed to read inserted leave request');
    return created;
  }

  async updateLeaveRequest(
    tenantId: string,
    id: string,
    next: LeaveRequest,
  ): Promise<LeaveRequest | null> {
    await this.db.run(
      `UPDATE leave_requests SET
         state = ?, decided_by = ?, decided_at = ?, decision_note = ?,
         updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [next.state, next.decidedBy, next.decidedAt, next.decisionNote, tenantId, id],
    );
    return this.getLeaveRequest(tenantId, id);
  }

  async listLeaveRequests(
    tenantId: string,
    filters: { memberId?: string; state?: LeaveRequestState; year?: number },
  ): Promise<LeaveRequest[]> {
    const clauses = ['tenant_id = ?'];
    const params: unknown[] = [tenantId];
    if (filters.memberId) {
      clauses.push('member_id = ?');
      params.push(filters.memberId);
    }
    if (filters.state) {
      clauses.push('state = ?');
      params.push(filters.state);
    }
    if (filters.year != null) {
      clauses.push(`substr(from_date, 1, 4) = ?`);
      params.push(String(filters.year));
    }
    const rows = await this.db.all<LeaveRequestRow>(
      `SELECT * FROM leave_requests
       WHERE ${clauses.join(' AND ')}
       ORDER BY from_date ASC, created_at ASC`,
      params,
    );
    return rows.map(mapLeaveRequest);
  }

  async listOverlappingLeaveRequests(
    tenantId: string,
    memberId: string,
    fromDate: string,
    toDate: string,
  ): Promise<LeaveRequest[]> {
    const rows = await this.db.all<LeaveRequestRow>(
      `SELECT * FROM leave_requests
       WHERE tenant_id = ?
         AND member_id = ?
         AND state IN ('pending', 'approved')
         AND from_date <= ?
         AND to_date >= ?`,
      [tenantId, memberId, toDate, fromDate],
    );
    return rows.map(mapLeaveRequest);
  }
}

interface SettingsRow extends Record<string, unknown> {
  tenant_id: string;
  granularity: string;
  edit_window_minutes: number;
  late_threshold_minutes: number;
  half_day_min_minutes: number;
  day_derivation?: string;
  updated_at: string;
}

function mapSettings(row: SettingsRow): AttendanceSettings {
  return {
    tenantId: row.tenant_id,
    granularity: row.granularity as AttendanceGranularity,
    editWindowMinutes: row.edit_window_minutes,
    lateThresholdMinutes: row.late_threshold_minutes,
    halfDayMinMinutes: row.half_day_min_minutes,
    dayDerivation: (row.day_derivation as DayDerivation) || 'majority',
    updatedAt: row.updated_at,
  };
}

interface RecordRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_id: string;
  date: string;
  period_instance_id: string | null;
  session_part: string | null;
  status: string;
  excuse: string;
  reason_code_id: string | null;
  late_minutes: number | null;
  marked_by: string | null;
  marked_at: string | null;
  source: string | null;
  device_id: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
}

function mapRecord(row: RecordRow): AttendanceRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    date: row.date,
    periodInstanceId: row.period_instance_id,
    sessionPart: row.session_part as SessionPart | null,
    status: row.status as AttendanceStatus,
    excuse: row.excuse as AttendanceExcuse,
    reasonCodeId: row.reason_code_id,
    lateMinutes: row.late_minutes,
    markedBy: row.marked_by,
    markedAt: row.marked_at,
    source: row.source as AttendanceSource | null,
    deviceId: row.device_id,
    idempotencyKey: row.idempotency_key,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface AuditRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  record_id: string;
  before_json: string | null;
  after_json: string | null;
  actor: string;
  at: string;
}

function mapAudit(row: AuditRow): AttendanceAuditRow {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    recordId: row.record_id,
    beforeJson: row.before_json,
    afterJson: row.after_json,
    actor: row.actor,
    at: row.at,
  };
}

interface BindingRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  subject_type: string;
  subject_id: string;
  modality: string;
  payload_hash: string;
  is_active: number;
  created_at: string;
}

function mapBinding(row: BindingRow): CaptureBinding {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    subjectType: row.subject_type as CaptureSubjectType,
    subjectId: row.subject_id,
    modality: row.modality as CaptureModality,
    payloadHash: row.payload_hash,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

interface EventRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  device_id: string;
  modality: string;
  payload_hash: string;
  matched_subject_id: string | null;
  decision: string;
  context_json: string;
  idempotency_key: string | null;
  at: string;
}

function mapEvent(row: EventRow): CaptureEvent {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    deviceId: row.device_id,
    modality: row.modality as CaptureModality,
    payloadHash: row.payload_hash,
    matchedSubjectId: row.matched_subject_id,
    decision: row.decision as CaptureDecision,
    contextJson: row.context_json,
    idempotencyKey: row.idempotency_key,
    at: row.at,
  };
}

interface StaffRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  member_id: string;
  date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  status: string;
  source: string;
  minutes_on_premises: number | null;
  marked_by: string | null;
  created_at: string;
  updated_at: string;
}

function mapStaff(row: StaffRow): StaffAttendance {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    memberId: row.member_id,
    date: row.date,
    checkInAt: row.check_in_at,
    checkOutAt: row.check_out_at,
    status: row.status as StaffAttendanceStatus,
    source: row.source as StaffAttendanceSource,
    minutesOnPremises: row.minutes_on_premises,
    markedBy: row.marked_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface ReportedRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_id: string;
  reported_by_guardian_id: string;
  dates_json: string;
  reason_code_id: string;
  note: string | null;
  attachment_ref: string | null;
  channel: string;
  created_at: string;
  updated_at: string;
}

function mapReported(row: ReportedRow): ReportedAbsence {
  let dates: string[] = [];
  try {
    const parsed = JSON.parse(row.dates_json) as unknown;
    if (Array.isArray(parsed)) {
      dates = parsed.map((d) => String(d));
    }
  } catch {
    dates = [];
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    reportedByGuardianId: row.reported_by_guardian_id,
    dates,
    reasonCodeId: row.reason_code_id,
    note: row.note,
    attachmentRef: row.attachment_ref,
    channel: row.channel as ReportedAbsenceChannel,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface RollupRow extends Record<string, unknown> {
  tenant_id: string;
  student_id: string;
  month: string;
  working_days: number;
  present_days: number;
  absent_days: number;
  late_count: number;
  pct: number;
  computed_at: string;
}

function mapRollup(row: RollupRow): AttendanceMonthlyRollup {
  return {
    tenantId: row.tenant_id,
    studentId: row.student_id,
    month: row.month,
    workingDays: row.working_days,
    presentDays: row.present_days,
    absentDays: row.absent_days,
    lateCount: row.late_count,
    pct: row.pct,
    computedAt: row.computed_at,
  };
}

interface NudgeConfigRow extends Record<string, unknown> {
  tenant_id: string;
  enabled: number;
  at_risk_pct: number;
  chronic_days: number;
  holdout_pct: number;
  max_messages_per_term: number;
  updated_at: string;
}

function mapNudgeConfig(row: NudgeConfigRow): NudgeConfig {
  return {
    tenantId: row.tenant_id,
    enabled: row.enabled === 1,
    atRiskPct: row.at_risk_pct,
    chronicDays: row.chronic_days,
    holdoutPct: row.holdout_pct,
    maxMessagesPerTerm: row.max_messages_per_term,
    updatedAt: row.updated_at,
  };
}

interface NudgeAssignmentRow extends Record<string, unknown> {
  tenant_id: string;
  student_id: string;
  cohort: string;
  assigned_at: string;
}

function mapNudgeAssignment(row: NudgeAssignmentRow): NudgeAssignment {
  return {
    tenantId: row.tenant_id,
    studentId: row.student_id,
    cohort: row.cohort as NudgeCohort,
    assignedAt: row.assigned_at,
  };
}

interface NudgeMessageRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_id: string;
  tier: string;
  ytd_absent_days: number;
  class_percentile: number;
  rendered_vars_json: string;
  created_at: string;
}

function mapNudgeMessage(row: NudgeMessageRow): NudgeMessage {
  let renderedVars: Record<string, unknown> = {};
  try {
    const parsed = JSON.parse(row.rendered_vars_json) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      renderedVars = parsed as Record<string, unknown>;
    }
  } catch {
    renderedVars = {};
  }
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    tier: row.tier as NudgeTier,
    ytdAbsentDays: row.ytd_absent_days,
    classPercentile: row.class_percentile,
    renderedVars,
    createdAt: row.created_at,
  };
}

interface LeaveTypeRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  code: string;
  label: string;
  annual_quota: number;
  carry_forward: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

function mapLeaveType(row: LeaveTypeRow): LeaveType {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    code: row.code,
    label: row.label,
    annualQuota: row.annual_quota,
    carryForward: row.carry_forward === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface LeaveBalanceRow extends Record<string, unknown> {
  tenant_id: string;
  member_id: string;
  leave_type_id: string;
  year: number;
  opening: number;
  used: number;
}

function mapLeaveBalance(row: LeaveBalanceRow): LeaveBalance {
  return {
    tenantId: row.tenant_id,
    memberId: row.member_id,
    leaveTypeId: row.leave_type_id,
    year: row.year,
    opening: row.opening,
    used: row.used,
  };
}

interface LeaveRequestRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  member_id: string;
  leave_type_id: string;
  from_date: string;
  to_date: string;
  is_half_day: number;
  days: number;
  reason: string | null;
  state: string;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
  created_at: string;
  updated_at: string;
}

function mapLeaveRequest(row: LeaveRequestRow): LeaveRequest {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    memberId: row.member_id,
    leaveTypeId: row.leave_type_id,
    fromDate: row.from_date,
    toDate: row.to_date,
    isHalfDay: row.is_half_day === 1,
    days: row.days,
    reason: row.reason,
    state: row.state as LeaveRequestState,
    decidedBy: row.decided_by,
    decidedAt: row.decided_at,
    decisionNote: row.decision_note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
