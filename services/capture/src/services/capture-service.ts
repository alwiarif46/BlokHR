import { v4 as uuidv4 } from 'uuid';
import type { Logger } from 'pino';
import type { CaptureDb } from '../db';
import { decryptPayload, encryptPayload, getOrCreateTenantKey, payloadsEqual, templateScore } from '../crypto';
import { defaultJurisdiction, isFaceJurisdictionBlocked, resolveAvailableModalities } from '../gating';
import type { CaptureRepository } from '../repositories/capture-repository';
import type {
  ClockPort,
  ConsentPort,
  DeviceCapability,
  EnrolmentInput,
  EntitlementsPort,
  EventInput,
  EventResult,
  Modality,
  SchoolAttendancePort,
  SubjectType,
  TenantJurisdiction,
} from '../types';
import { BIOMETRIC_MODALITIES } from '../types';

export interface CaptureServiceDeps {
  db: CaptureDb;
  repo: CaptureRepository;
  logger: Logger;
  tenantId?: string;
  consent: ConsentPort;
  entitlements: EntitlementsPort;
  schoolAttendance?: SchoolAttendancePort;
  clock?: ClockPort;
}

const FACE_MATCH_THRESHOLD = 0.72;
const FP_MATCH_THRESHOLD = 0.85;
const IMPOSSIBLE_SEQUENCE_SECONDS = 4;

export class CaptureService {
  private readonly tenantId: string;

  constructor(private readonly deps: CaptureServiceDeps) {
    this.tenantId = deps.tenantId ?? 'default';
  }

  async ensureJurisdiction(defaults?: Partial<TenantJurisdiction>): Promise<TenantJurisdiction> {
    let j = await this.deps.repo.getJurisdiction(this.tenantId);
    if (!j) {
      j = { ...defaultJurisdiction(defaults?.vertical ?? 'hr'), ...defaults };
      await this.deps.repo.upsertJurisdiction(this.tenantId, j);
    }
    return j;
  }

  async updateJurisdiction(partial: Partial<TenantJurisdiction>): Promise<TenantJurisdiction> {
    await this.deps.repo.upsertJurisdiction(this.tenantId, partial);
    return (await this.deps.repo.getJurisdiction(this.tenantId))!;
  }

  async issueSessionToken(input: {
    subjectType: SubjectType;
    deviceId?: string;
    entitledModulesFallback?: string[];
  }): Promise<{ available_modalities: Modality[]; jurisdiction: TenantJurisdiction; roll_call: boolean }> {
    const jurisdiction = await this.ensureJurisdiction();
    let caps: DeviceCapability[] = [];
    if (input.deviceId) {
      const device = await this.deps.repo.getDevice(this.tenantId, input.deviceId);
      caps = device?.capabilities ?? [];
    }

    const entitlements: EntitlementsPort = this.deps.entitlements;

    const available = await resolveAvailableModalities({
      tenantId: this.tenantId,
      entitlements,
      jurisdiction,
      subjectType: input.subjectType,
      deviceCapabilities: caps,
      hasStudentFaceDpia: !!jurisdiction.faceStudentsDpiaRef,
    });

    const roll_call = await entitlements.hasModule(this.tenantId, 'school_roll_call');

    return {
      available_modalities: available,
      jurisdiction,
      roll_call: roll_call || jurisdiction.vertical === 'school',
    };
  }

  async enrol(
    input: EnrolmentInput,
    actorEmail = '',
  ): Promise<{ success: boolean; enrolmentId?: string; error?: string }> {
    if (!input.subjectRef?.trim()) return { success: false, error: 'subject_ref is required' };
    if (!input.payloadB64?.trim()) return { success: false, error: 'payload_b64 is required' };
    if (!input.modality) return { success: false, error: 'modality is required' };

    // Subject type rules — fingerprint allowed for staff or gated students (not visitors)
    if (input.modality === 'fingerprint' && input.subjectType === 'visitor') {
      return { success: false, error: 'Fingerprint enrolment is not available for visitors' };
    }

    const jurisdiction = await this.ensureJurisdiction();
    if ((input.modality === 'face' || input.modality === 'iris') && isFaceJurisdictionBlocked(jurisdiction)) {
      return { success: false, error: 'Face/iris is blocked in this jurisdiction' };
    }

    const entitlements = this.deps.entitlements;
    if (input.modality === 'fingerprint') {
      const fingerSlot = input.fingerSlot;
      if (fingerSlot !== 1 && fingerSlot !== 2) {
        return { success: false, error: 'finger_slot (1 or 2) is required for dual-finger enrolment' };
      }
      if (input.subjectType === 'staff') {
        if (!(await entitlements.hasModule(this.tenantId, 'capture_fingerprint_staff'))) {
          return { success: false, error: 'Staff fingerprint module not entitled' };
        }
      } else if (input.subjectType === 'student') {
        if (!(await entitlements.hasModule(this.tenantId, 'capture_fingerprint_students'))) {
          return { success: false, error: 'Student fingerprint module not entitled' };
        }
        if (!jurisdiction.faceStudentsDpiaRef) {
          return { success: false, error: 'Student fingerprint requires DPIA on file' };
        }
      } else {
        return { success: false, error: 'Fingerprint enrolment requires staff or student subject_type' };
      }
    }
    if (input.modality === 'face') {
      if (input.subjectType === 'staff' || input.subjectType === 'visitor') {
        if (!(await entitlements.hasModule(this.tenantId, 'capture_face_adults')) || !jurisdiction.faceAdultsEnabled) {
          return { success: false, error: 'Adult face capture not entitled or disabled' };
        }
      } else if (input.subjectType === 'student') {
        if (!(await entitlements.hasModule(this.tenantId, 'capture_face_students'))) {
          return { success: false, error: 'Student face module not entitled' };
        }
        if (!jurisdiction.faceStudentsDpiaRef) {
          return { success: false, error: 'Student face requires DPIA on file' };
        }
      }
    }
    if (input.modality === 'iris') {
      if (input.subjectType !== 'student') {
        return { success: false, error: 'Iris enrolment is student-gated only in this product' };
      }
      if (!(await entitlements.hasModule(this.tenantId, 'capture_iris_students'))) {
        return { success: false, error: 'Student iris module not entitled' };
      }
      if (!jurisdiction.faceStudentsDpiaRef) {
        return { success: false, error: 'Student iris requires DPIA on file' };
      }
    }
    if (input.modality === 'bus_rfid') {
      if (!(await entitlements.hasModule(this.tenantId, 'transport_bus_rfid'))) {
        return { success: false, error: 'Bus RFID module not entitled' };
      }
    }

    if (BIOMETRIC_MODALITIES.has(input.modality)) {
      if (!input.consentRef) {
        return { success: false, error: 'consent_ref is required for biometric modalities' };
      }
      const ok = await this.deps.consent.validate(this.tenantId, input.consentRef, input.modality);
      if (!ok) return { success: false, error: 'Invalid or revoked consent_ref' };
    }

    // Emotion/attention — never build; reject known bad algos
    const algo = (input.algo || '').toLowerCase();
    if (algo.includes('emotion') || algo.includes('attention') || algo.includes('engagement')) {
      return { success: false, error: 'Emotion/attention modalities are prohibited' };
    }

    const key = await getOrCreateTenantKey(this.deps.db, this.tenantId);
    const id = `enr_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
    const storedAlgo =
      input.modality === 'fingerprint' && input.fingerSlot
        ? `${input.algo || defaultAlgo(input.modality)}#slot${input.fingerSlot}`
        : input.algo || defaultAlgo(input.modality);
    await this.deps.repo.insertEnrolment({
      id,
      tenantId: this.tenantId,
      subjectRef: input.subjectRef.trim(),
      subjectType: input.subjectType,
      modality: input.modality,
      algo: storedAlgo,
      payloadCiphertext: encryptPayload(key, input.payloadB64),
      quality: input.quality ?? 0,
      deviceId: input.deviceId || '',
      consentRef: input.consentRef || '',
    });

    await this.deps.repo.audit(this.tenantId, actorEmail, 'enrol', `modality=${input.modality}`, id);
    this.deps.logger.info({ enrolmentId: id, modality: input.modality }, 'Capture enrolment created');
    return { success: true, enrolmentId: id };
  }

  async processEvent(input: EventInput, actorEmail = ''): Promise<EventResult & { error?: string }> {
    if (!input.idempotencyKey?.trim()) {
      return { id: '', subjectRef: '', matchScore: 0, decision: 'no_match', error: 'idempotency_key required' };
    }

    const existing = await this.deps.repo.findEventByIdempotency(this.tenantId, input.idempotencyKey);
    if (existing) {
      return {
        id: existing.id,
        subjectRef: existing.subject_ref,
        matchScore: existing.match_score,
        decision: existing.decision as EventResult['decision'],
        idempotentReplay: true,
      };
    }

    if (!input.payloadB64?.trim()) {
      return { id: '', subjectRef: '', matchScore: 0, decision: 'no_match', error: 'payload_b64 required' };
    }

    const jurisdiction = await this.ensureJurisdiction();
    if ((input.modality === 'face' || input.modality === 'iris') && isFaceJurisdictionBlocked(jurisdiction)) {
      return { id: '', subjectRef: '', matchScore: 0, decision: 'no_match', error: 'Face/iris blocked' };
    }

    // Impossible-sequence pre-check uses post-match gate comparison below

    const key = await getOrCreateTenantKey(this.deps.db, this.tenantId);
    const enrolments = await this.deps.repo.listActiveEnrolments(this.tenantId, input.modality);

    let best: { subjectRef: string; subjectType: string; score: number } | null = null;

    for (const enr of enrolments) {
      if (input.subjectTypeHint && enr.subject_type !== input.subjectTypeHint) continue;
      // Student fingerprint templates only match when scanning as student (or no hint)
      if (
        input.modality === 'fingerprint' &&
        enr.subject_type === 'student' &&
        input.subjectTypeHint === 'staff'
      ) {
        continue;
      }

      let plain: string;
      try {
        plain = decryptPayload(key, enr.payload_ciphertext);
      } catch {
        continue;
      }

      let score = 0;
      if (input.modality === 'qr' || input.modality === 'nfc' || input.modality === 'bus_rfid') {
        score = payloadsEqual(plain, input.payloadB64) ? 1 : 0;
      } else {
        score = templateScore(plain, input.payloadB64);
      }

      const threshold =
        input.modality === 'face' || input.modality === 'iris'
          ? FACE_MATCH_THRESHOLD
          : input.modality === 'fingerprint'
            ? FP_MATCH_THRESHOLD
            : 1;

      if (score >= threshold && (!best || score > best.score)) {
        best = { subjectRef: enr.subject_ref, subjectType: enr.subject_type, score };
      }
    }

    let finalDecision: EventResult['decision'] = best ? 'matched' : 'no_match';

    // Impossible sequence: same subject matched at two different gates within 4s → manual_required
    if (best && input.modality === 'nfc' && input.context?.gate_id) {
      const since = new Date(Date.now() - IMPOSSIBLE_SEQUENCE_SECONDS * 1000).toISOString();
      const recent = await this.deps.repo.recentDeviceEvents(this.tenantId, '', since);
      const conflict = recent.find((r) => {
        if (r.subject_ref !== best!.subjectRef) return false;
        if (r.decision !== 'matched') return false;
        try {
          const c = JSON.parse(r.context_json) as { gate_id?: string };
          return !!c.gate_id && c.gate_id !== input.context!.gate_id;
        } catch {
          return false;
        }
      });
      if (conflict) {
        finalDecision = 'manual_required';
      }
    }

    const id = `evt_${uuidv4().replace(/-/g, '').slice(0, 24)}`;
    const capturedAt = input.capturedAt || new Date().toISOString();
    await this.deps.repo.insertEvent({
      id,
      tenantId: this.tenantId,
      modality: input.modality,
      subjectRef: best?.subjectRef ?? '',
      subjectType: best?.subjectType ?? '',
      decision: finalDecision,
      matchScore: best?.score ?? 0,
      deviceId: input.deviceId || '',
      contextJson: JSON.stringify(input.context ?? {}),
      idempotencyKey: input.idempotencyKey,
      capturedAt,
    });

    await this.deps.repo.audit(
      this.tenantId,
      actorEmail,
      finalDecision === 'manual_required' ? 'impossible_sequence' : 'event',
      `decision=${finalDecision} modality=${input.modality}`,
      '',
      id,
    );

    if (
      best &&
      finalDecision === 'matched' &&
      this.deps.schoolAttendance &&
      (best.subjectType === 'student' || jurisdiction.vertical === 'school')
    ) {
      const ctx = input.context ?? {};
      await this.deps.schoolAttendance.markFromCapture({
        tenantId: this.tenantId,
        subjectRef: best.subjectRef,
        periodId: typeof ctx.period_id === 'string' ? ctx.period_id : undefined,
        classId: typeof ctx.class_id === 'string' ? ctx.class_id : undefined,
        decision: finalDecision,
        source: `capture-${input.modality}`,
        idempotencyKey: input.idempotencyKey,
      });
    }

    if (best && finalDecision === 'matched' && best.subjectType === 'staff' && this.deps.clock) {
      const email = best.subjectRef.includes('@') ? best.subjectRef : `${best.subjectRef}@local`;
      await this.deps.clock.clock('in', email, email, `capture-${input.modality}`);
    }

    return {
      id,
      subjectRef: best?.subjectRef ?? '',
      matchScore: best?.score ?? 0,
      decision: finalDecision,
    };
  }

  async manualOverride(input: {
    eventId: string;
    subjectRef: string;
    reason: string;
    by: string;
  }): Promise<{ success: boolean; error?: string }> {
    if (!input.reason?.trim()) return { success: false, error: 'reason is required' };
    if (!input.subjectRef?.trim()) return { success: false, error: 'subject_ref is required' };
    const ev = await this.deps.repo.getEvent(this.tenantId, input.eventId);
    if (!ev) return { success: false, error: 'Event not found' };
    if (ev.decision === 'matched' && ev.subject_ref && !ev.override_by) {
      return { success: false, error: 'Event already matched' };
    }
    await this.deps.repo.applyManualOverride(
      this.tenantId,
      input.eventId,
      input.subjectRef.trim(),
      input.by,
      input.reason.trim(),
    );
    await this.deps.repo.audit(
      this.tenantId,
      input.by,
      'manual_override',
      input.reason.trim(),
      '',
      input.eventId,
    );

    if (this.deps.schoolAttendance) {
      let periodId: string | undefined;
      let classId: string | undefined;
      try {
        const ctx = JSON.parse(ev.context_json) as { period_id?: string; class_id?: string };
        periodId = ctx.period_id;
        classId = ctx.class_id;
      } catch {
        /* ignore */
      }
      await this.deps.schoolAttendance.markFromCapture({
        tenantId: this.tenantId,
        subjectRef: input.subjectRef.trim(),
        periodId,
        classId,
        decision: 'matched',
        source: 'manual_override',
        idempotencyKey: `${ev.idempotency_key}:override`,
      });
    }

    return { success: true };
  }

  async revokeEnrolment(id: string, actorEmail = ''): Promise<{ success: boolean; error?: string }> {
    const ok = await this.deps.repo.revokeEnrolment(this.tenantId, id);
    if (!ok) return { success: false, error: 'Enrolment not found' };
    await this.deps.repo.audit(this.tenantId, actorEmail, 'revoke', '', id);
    return { success: true };
  }

  async listEnrolments(): Promise<
    Array<{
      id: string;
      subjectRef: string;
      subjectType: string;
      modality: string;
      algo: string;
      quality: number;
      consentRef: string;
      revoked: boolean;
      createdAt: string;
    }>
  > {
    const rows = await this.deps.repo.listEnrolmentsAdmin(this.tenantId);
    return rows.map((r) => ({
      id: r.id,
      subjectRef: r.subject_ref,
      subjectType: r.subject_type,
      modality: r.modality,
      algo: r.algo,
      quality: r.quality,
      consentRef: r.consent_ref,
      revoked: !!r.revoked_at,
      createdAt: r.created_at,
    }));
  }

  async registerDevice(
    id: string,
    name: string,
    capabilities: DeviceCapability[],
  ): Promise<{ success: boolean }> {
    await this.deps.repo.upsertDevice(this.tenantId, id, name, capabilities);
    return { success: true };
  }

  async runRetentionPurge(): Promise<{ purged: number }> {
    const j = await this.ensureJurisdiction();
    const cutoff = new Date(Date.now() - j.retentionDays * 86400000).toISOString();
    const purged = await this.deps.repo.purgeExpiredEnrolments(this.tenantId, cutoff);
    return { purged };
  }

  /** Issue temporary QR payload for lost NFC card (staff/student). */
  async issueTemporaryQr(subjectRef: string, subjectType: SubjectType, actorEmail = ''): Promise<{
    success: boolean;
    payloadB64?: string;
    enrolmentId?: string;
    error?: string;
  }> {
    const token = `tmpqr_${uuidv4().replace(/-/g, '')}`;
    const payloadB64 = Buffer.from(token, 'utf8').toString('base64');
    const result = await this.enrol(
      {
        subjectRef,
        subjectType,
        modality: 'qr',
        payloadB64,
        algo: 'blokhr.tmpqr.v1',
        quality: 100,
      },
      actorEmail,
    );
    if (!result.success) return { success: false, error: result.error };
    return { success: true, payloadB64, enrolmentId: result.enrolmentId };
  }
}

function defaultAlgo(modality: Modality): string {
  switch (modality) {
    case 'fingerprint':
      return 'mantra.mfs100.v2';
    case 'face':
      return 'blokhr.face.embed.v1';
    case 'iris':
      return 'blokhr.iris.v1';
    case 'nfc':
      return 'uid.hex.v1';
    case 'qr':
      return 'blokhr.qr.v1';
    case 'bus_rfid':
      return 'bus.rfid.v1';
    default: {
      const _exhaustive: never = modality;
      return String(_exhaustive);
    }
  }
}
