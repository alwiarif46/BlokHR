import type { CaptureDb } from '../db';
import type { DeviceCapability, Modality, SubjectType, TenantJurisdiction } from '../types';

export interface EnrolmentRow {
  id: string;
  tenant_id: string;
  subject_ref: string;
  subject_type: string;
  modality: string;
  algo: string;
  payload_ciphertext: string;
  quality: number;
  device_id: string;
  consent_ref: string;
  revoked_at: string | null;
  created_at: string;
  [key: string]: unknown;
}

export interface EventRow {
  id: string;
  tenant_id: string;
  modality: string;
  subject_ref: string;
  subject_type: string;
  decision: string;
  match_score: number;
  device_id: string;
  context_json: string;
  idempotency_key: string;
  override_by: string;
  override_reason: string;
  captured_at: string;
  created_at: string;
  [key: string]: unknown;
}

export class CaptureRepository {
  constructor(private readonly db: CaptureDb) {}

  async getJurisdiction(tenantId: string): Promise<TenantJurisdiction | null> {
    const row = await this.db.get<{
      country: string;
      state: string;
      vertical: string;
      face_adults_enabled: number;
      face_students_dpia_ref: string;
      retention_days: number;
      [key: string]: unknown;
    }>('SELECT * FROM tenant_jurisdiction WHERE tenant_id = ?', [tenantId]);
    if (!row) return null;
    return {
      country: row.country,
      state: row.state,
      vertical: row.vertical as TenantJurisdiction['vertical'],
      faceAdultsEnabled: row.face_adults_enabled === 1,
      faceStudentsDpiaRef: row.face_students_dpia_ref,
      retentionDays: row.retention_days,
    };
  }

  async upsertJurisdiction(tenantId: string, j: Partial<TenantJurisdiction>): Promise<void> {
    const existing = await this.getJurisdiction(tenantId);
    const merged: TenantJurisdiction = {
      country: j.country ?? existing?.country ?? 'IN',
      state: j.state ?? existing?.state ?? '',
      vertical: j.vertical ?? existing?.vertical ?? 'hr',
      faceAdultsEnabled: j.faceAdultsEnabled ?? existing?.faceAdultsEnabled ?? false,
      faceStudentsDpiaRef: j.faceStudentsDpiaRef ?? existing?.faceStudentsDpiaRef ?? '',
      retentionDays: j.retentionDays ?? existing?.retentionDays ?? 365,
    };
    await this.db.run(
      `INSERT INTO tenant_jurisdiction (
        tenant_id, country, state, vertical, face_adults_enabled, face_students_dpia_ref, retention_days, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(tenant_id) DO UPDATE SET
        country = excluded.country,
        state = excluded.state,
        vertical = excluded.vertical,
        face_adults_enabled = excluded.face_adults_enabled,
        face_students_dpia_ref = excluded.face_students_dpia_ref,
        retention_days = excluded.retention_days,
        updated_at = datetime('now')`,
      [
        tenantId,
        merged.country,
        merged.state,
        merged.vertical,
        merged.faceAdultsEnabled ? 1 : 0,
        merged.faceStudentsDpiaRef,
        merged.retentionDays,
      ],
    );
  }

  async insertEnrolment(row: {
    id: string;
    tenantId: string;
    subjectRef: string;
    subjectType: SubjectType;
    modality: Modality;
    algo: string;
    payloadCiphertext: string;
    quality: number;
    deviceId: string;
    consentRef: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO enrolments (
        id, tenant_id, subject_ref, subject_type, modality, algo, payload_ciphertext,
        quality, device_id, consent_ref
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.tenantId,
        row.subjectRef,
        row.subjectType,
        row.modality,
        row.algo,
        row.payloadCiphertext,
        row.quality,
        row.deviceId,
        row.consentRef,
      ],
    );
  }

  async listActiveEnrolments(tenantId: string, modality: Modality): Promise<EnrolmentRow[]> {
    return this.db.all<EnrolmentRow>(
      `SELECT * FROM enrolments WHERE tenant_id = ? AND modality = ? AND revoked_at IS NULL`,
      [tenantId, modality],
    );
  }

  async getEnrolment(tenantId: string, id: string): Promise<EnrolmentRow | undefined> {
    return this.db.get<EnrolmentRow>(
      'SELECT * FROM enrolments WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
  }

  async revokeEnrolment(tenantId: string, id: string): Promise<boolean> {
    const e = await this.getEnrolment(tenantId, id);
    if (!e || e.revoked_at) return false;
    await this.db.run(
      `UPDATE enrolments SET revoked_at = datetime('now'), updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [tenantId, id],
    );
    return true;
  }

  async listEnrolmentsAdmin(tenantId: string): Promise<EnrolmentRow[]> {
    return this.db.all<EnrolmentRow>(
      'SELECT * FROM enrolments WHERE tenant_id = ? ORDER BY created_at DESC',
      [tenantId],
    );
  }

  async findEventByIdempotency(tenantId: string, key: string): Promise<EventRow | undefined> {
    return this.db.get<EventRow>(
      'SELECT * FROM capture_events WHERE tenant_id = ? AND idempotency_key = ?',
      [tenantId, key],
    );
  }

  async insertEvent(row: {
    id: string;
    tenantId: string;
    modality: Modality;
    subjectRef: string;
    subjectType: string;
    decision: string;
    matchScore: number;
    deviceId: string;
    contextJson: string;
    idempotencyKey: string;
    capturedAt: string;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO capture_events (
        id, tenant_id, modality, subject_ref, subject_type, decision, match_score,
        device_id, context_json, idempotency_key, captured_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        row.id,
        row.tenantId,
        row.modality,
        row.subjectRef,
        row.subjectType,
        row.decision,
        row.matchScore,
        row.deviceId,
        row.contextJson,
        row.idempotencyKey,
        row.capturedAt,
      ],
    );
  }

  async getEvent(tenantId: string, id: string): Promise<EventRow | undefined> {
    return this.db.get<EventRow>(
      'SELECT * FROM capture_events WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
  }

  async applyManualOverride(
    tenantId: string,
    id: string,
    subjectRef: string,
    by: string,
    reason: string,
  ): Promise<boolean> {
    const ev = await this.getEvent(tenantId, id);
    if (!ev) return false;
    await this.db.run(
      `UPDATE capture_events SET
        subject_ref = ?, decision = 'matched', override_by = ?, override_reason = ?
       WHERE tenant_id = ? AND id = ?`,
      [subjectRef, by, reason, tenantId, id],
    );
    return true;
  }

  async recentDeviceEvents(
    tenantId: string,
    deviceId: string,
    sinceIso: string,
  ): Promise<EventRow[]> {
    if (!deviceId) {
      return this.db.all<EventRow>(
        `SELECT * FROM capture_events
         WHERE tenant_id = ? AND captured_at >= ?
         ORDER BY captured_at DESC LIMIT 50`,
        [tenantId, sinceIso],
      );
    }
    return this.db.all<EventRow>(
      `SELECT * FROM capture_events
       WHERE tenant_id = ? AND device_id = ? AND captured_at >= ?
       ORDER BY captured_at DESC LIMIT 50`,
      [tenantId, deviceId, sinceIso],
    );
  }

  async upsertDevice(
    tenantId: string,
    id: string,
    name: string,
    capabilities: DeviceCapability[],
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO devices (id, tenant_id, name, capabilities_json, last_seen_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         capabilities_json = excluded.capabilities_json,
         last_seen_at = datetime('now')`,
      [id, tenantId, name, JSON.stringify(capabilities)],
    );
  }

  async getDevice(tenantId: string, id: string): Promise<{
    id: string;
    capabilities: DeviceCapability[];
  } | null> {
    const row = await this.db.get<{ id: string; capabilities_json: string; [key: string]: unknown }>(
      'SELECT * FROM devices WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    if (!row) return null;
    let capabilities: DeviceCapability[] = [];
    try {
      capabilities = JSON.parse(row.capabilities_json) as DeviceCapability[];
    } catch {
      capabilities = [];
    }
    return { id: row.id, capabilities };
  }

  async audit(
    tenantId: string,
    actorEmail: string,
    action: string,
    detail: string,
    enrolmentId = '',
    eventId = '',
  ): Promise<void> {
    await this.db.run(
      `INSERT INTO match_audit (tenant_id, actor_email, action, enrolment_id, event_id, detail)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [tenantId, actorEmail, action, enrolmentId, eventId, detail],
    );
  }

  async purgeExpiredEnrolments(tenantId: string, olderThanIso: string): Promise<number> {
    const rows = await this.db.all<{ id: string }>(
      `SELECT id FROM enrolments
       WHERE tenant_id = ? AND revoked_at IS NOT NULL AND revoked_at < ?`,
      [tenantId, olderThanIso],
    );
    for (const r of rows) {
      await this.db.run('DELETE FROM enrolments WHERE id = ?', [r.id]);
    }
    return rows.length;
  }
}
