import { v4 as uuidv4 } from 'uuid';
import type { EventPublisher } from '../events';
import type { IdentityRepository } from '../repositories/identity-repository';
import type {
  AcademicSession,
  ConsentKind,
  ConsentRecord,
  ConsentState,
  ConsentSummary,
  ConsentTransitionInput,
  ConsentVerificationMethod,
  CreateAcademicSessionInput,
  CreateGuardianInput,
  CreateStudentInput,
  Enrolment,
  EnrolStudentInput,
  ExitStudentInput,
  Guardian,
  GuardianRelation,
  LinkGuardianInput,
  ListStudentsQuery,
  PatchGuardianInput,
  PatchStudentInput,
  Student,
  StudentCategory,
  StudentGender,
  StudentGuardian,
  StudentStatus,
} from '../types';
import { validateStudentForUdise, type UdiseIssue } from './udise-validator';
import { getStatePack, listStatePacks, type StatePack } from '../state-packs';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const GENDERS = new Set<StudentGender>(['male', 'female', 'other']);
const STATUSES = new Set<StudentStatus>([
  'enquiry',
  'admitted',
  'active',
  'transferred',
  'alumni',
  'withdrawn',
]);
const CATEGORIES = new Set<StudentCategory>(['GEN', 'EWS', 'OBC', 'SC', 'ST', 'OTHER_STATE']);
const RELATIONS = new Set<GuardianRelation>(['father', 'mother', 'guardian', 'other']);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LANG_RE = /^[A-Za-z]{2,5}$/;
const INDIAN_MOBILE = /^[6-9]\d{9}$/;
const E164 = /^\+[1-9]\d{7,14}$/;
const CONSENT_KINDS: ConsentKind[] = [
  'apaar',
  'dpdp_processing',
  'biometric',
  'photo',
  'transport_gps',
];
const STRICT_GRANT_KINDS = new Set<ConsentKind>(['apaar', 'biometric', 'dpdp_processing']);
const VERIFICATION_METHODS = new Set<ConsentVerificationMethod>([
  'existing_records',
  'id_details',
  'virtual_token',
  'digilocker',
]);
const ALLOWED_TRANSITIONS: Record<ConsentState, ConsentState[]> = {
  not_sought: ['granted', 'refused'],
  granted: ['withdrawn'],
  refused: ['granted'],
  withdrawn: [],
};
const FORBIDDEN_AADHAAR_KEYS = new Set([
  'aadhaar',
  'aadhaar_number',
  'aadhaarNumber',
  'uid',
  'uidai',
  'full_aadhaar',
  'fullAadhaar',
]);

export type ServiceError = { error: string; status: number };

export class IdentityService {
  constructor(
    private readonly repo: IdentityRepository,
    private readonly events: EventPublisher,
  ) {}

  async listSessions(tenantId: string): Promise<AcademicSession[]> {
    return this.repo.listSessions(tenantId);
  }

  async listActiveEnrolments(tenantId: string, studentId: string): Promise<Enrolment[]> {
    return this.repo.listActiveEnrolments(tenantId, studentId);
  }

  /**
   * Internal: active enrolment section for diary/guardian feeds.
   * section_ref = "<class_label>|<section>"
   */
  async getActiveStudentSection(
    tenantId: string,
    studentId: string,
  ): Promise<
    | { sectionRef: string; academicSessionId: string }
    | { error: string; status: number }
  > {
    const student = await this.repo.getStudent(tenantId, studentId);
    if (!student) return { error: 'not_found', status: 404 };
    const enrolments = await this.repo.listActiveEnrolments(tenantId, studentId);
    const active = enrolments[0];
    if (!active) return { error: 'not_found', status: 404 };
    return {
      sectionRef: `${active.classLabel}|${active.section}`,
      academicSessionId: active.academicSessionId,
    };
  }

  /**
   * Internal: guardians linked to students currently enrolled in section_ref.
   * section_ref = "<class_label>|<section>"
   */
  async listGuardiansForSection(
    tenantId: string,
    sectionRef: string,
  ): Promise<{
    guardians?: Array<{ guardianId: string; studentId: string }>;
    error?: ServiceError;
  }> {
    const raw = (sectionRef || '').trim();
    const pipe = raw.indexOf('|');
    if (pipe <= 0 || pipe === raw.length - 1) {
      return { error: { error: 'invalid section_ref', status: 400 } };
    }
    const classLabel = raw.slice(0, pipe);
    const section = raw.slice(pipe + 1);
    const pairs = await this.repo.listGuardianStudentPairsForSection(
      tenantId,
      classLabel,
      section,
    );
    return { guardians: pairs };
  }

  async createSession(
    tenantId: string,
    input: CreateAcademicSessionInput,
  ): Promise<{ session?: AcademicSession; error?: string }> {
    const label = (input.label || '').trim();
    if (!label) return { error: 'label is required' };

    const startsOn = (input.startsOn || '').trim();
    const endsOn = (input.endsOn || '').trim();
    if (!ISO_DATE.test(startsOn) || !ISO_DATE.test(endsOn)) {
      return { error: 'starts_on and ends_on must be ISO dates (YYYY-MM-DD)' };
    }
    if (endsOn <= startsOn) {
      return { error: 'ends_on must be after starts_on' };
    }

    const isCurrent = !!input.isCurrent;
    if (isCurrent) {
      await this.repo.clearCurrent(tenantId);
    }

    const session = await this.repo.insertSession({
      id: uuidv4(),
      tenantId,
      label,
      startsOn,
      endsOn,
      isCurrent,
    });

    await this.events.publish({
      type: 'school.academic_session.created',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: { sessionId: session.id, label: session.label, isCurrent: session.isCurrent },
    });

    return { session };
  }

  rejectFullAadhaar(payload: unknown): ServiceError | null {
    if (containsFullAadhaar(payload)) {
      return { error: 'aadhaar_not_accepted', status: 400 };
    }
    return null;
  }

  listStatePackSummaries(): Array<{ code: string; label: string }> {
    return listStatePacks();
  }

  getStatePackDetail(code: string): StatePack | null {
    return getStatePack(code);
  }

  async getTenantStatePack(
    tenantId: string,
  ): Promise<{ packCode: string | null; pack: StatePack | null }> {
    const packCode = await this.repo.getTenantStatePackCode(tenantId);
    return { packCode, pack: packCode ? getStatePack(packCode) : null };
  }

  async setTenantStatePack(
    tenantId: string,
    packCode: string,
  ): Promise<{ packCode?: string; pack?: StatePack; error?: ServiceError }> {
    const code = (packCode || '').trim().toUpperCase();
    const pack = getStatePack(code);
    if (!pack) return { error: { error: 'unknown state pack', status: 400 } };
    await this.repo.setTenantStatePack(tenantId, pack.code);
    return { packCode: pack.code, pack };
  }

  async createStudent(
    tenantId: string,
    input: CreateStudentInput,
  ): Promise<{ student?: Student; error?: ServiceError }> {
    const validated = this.validateStudentFields(input, true);
    if ('error' in validated) return { error: validated };

    const packErr = await this.validateAgainstStatePack(
      tenantId,
      validated.stateStudentId,
      validated.stateCategoryCode,
    );
    if (packErr) return { error: packErr };

    const dup = await this.repo.findStudentByAdmission(tenantId, validated.admissionNumber);
    if (dup) return { error: { error: 'admission_number already exists', status: 409 } };

    const student = await this.repo.insertStudent({
      id: uuidv4(),
      tenantId,
      ...validated,
      createdAt: '',
      updatedAt: '',
    });

    return { student };
  }

  async getStudent(tenantId: string, id: string): Promise<Student | null> {
    return this.repo.getStudent(tenantId, id);
  }

  async listStudents(
    tenantId: string,
    query: ListStudentsQuery,
  ): Promise<{ items: Student[]; total: number }> {
    const limit = Math.min(Math.max(query.limit ?? 50, 1), 200);
    const offset = Math.max(query.offset ?? 0, 0);
    return this.repo.listStudents(tenantId, {
      status: query.status,
      classLabel: query.classLabel,
      section: query.section,
      q: query.q?.trim() || undefined,
      limit,
      offset,
    });
  }

  async patchStudent(
    tenantId: string,
    id: string,
    input: PatchStudentInput,
  ): Promise<{ student?: Student; error?: ServiceError }> {
    if (input.admissionNumber !== undefined) {
      return { error: { error: 'admission_number is immutable', status: 400 } };
    }
    const existing = await this.repo.getStudent(tenantId, id);
    if (!existing) return { error: { error: 'Student not found', status: 404 } };

    const merged: CreateStudentInput = {
      admissionNumber: existing.admissionNumber,
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      dob: input.dob ?? existing.dob,
      gender: (input.gender ?? existing.gender) as StudentGender,
      admissionDate: input.admissionDate ?? existing.admissionDate,
      status: (input.status ?? existing.status) as StudentStatus,
      category: (input.category ?? existing.category) as StudentCategory,
      stateCategoryCode:
        input.stateCategoryCode !== undefined
          ? input.stateCategoryCode
          : existing.stateCategoryCode,
      stateStudentId:
        input.stateStudentId !== undefined ? input.stateStudentId : existing.stateStudentId,
      motherName: input.motherName ?? existing.motherName,
      fatherName: input.fatherName ?? existing.fatherName,
      guardianContact: input.guardianContact ?? existing.guardianContact,
      aadhaarLast4:
        input.aadhaarLast4 !== undefined ? input.aadhaarLast4 : existing.aadhaarLast4,
      apaarId: input.apaarId !== undefined ? input.apaarId : existing.apaarId,
      penId: input.penId !== undefined ? input.penId : existing.penId,
      udiseExportOk:
        input.udiseExportOk !== undefined ? input.udiseExportOk : existing.udiseExportOk,
      isCwsn: input.isCwsn !== undefined ? input.isCwsn : existing.isCwsn,
      cwsnCategory:
        input.cwsnCategory !== undefined ? input.cwsnCategory : existing.cwsnCategory,
      cwsnDisability:
        input.cwsnDisability !== undefined ? input.cwsnDisability : existing.cwsnDisability,
      cwsnCertificate:
        input.cwsnCertificate !== undefined
          ? input.cwsnCertificate
          : existing.cwsnCertificate,
      isRte: input.isRte !== undefined ? input.isRte : existing.isRte,
      photoRef: input.photoRef !== undefined ? input.photoRef : existing.photoRef,
    };

    const validated = this.validateStudentFields(merged, true);
    if ('error' in validated) return { error: validated };

    const packErr = await this.validateAgainstStatePack(
      tenantId,
      validated.stateStudentId,
      validated.stateCategoryCode,
    );
    if (packErr) return { error: packErr };

    const student = await this.repo.updateStudent(tenantId, id, validated);
    if (!student) return { error: { error: 'Student not found', status: 404 } };
    return { student };
  }

  async enrolStudent(
    tenantId: string,
    studentId: string,
    input: EnrolStudentInput,
  ): Promise<{ enrolment?: Enrolment; error?: ServiceError }> {
    const student = await this.repo.getStudent(tenantId, studentId);
    if (!student) return { error: { error: 'Student not found', status: 404 } };

    const sessionId = (input.academicSessionId || '').trim();
    if (!sessionId) return { error: { error: 'academic_session_id is required', status: 400 } };
    const session = await this.repo.getSession(tenantId, sessionId);
    if (!session) return { error: { error: 'Academic session not found', status: 404 } };

    const classLabel = (input.classLabel || '').trim();
    const section = (input.section || '').trim();
    const rollNumber = (input.rollNumber || '').trim();
    if (!classLabel || !section || !rollNumber) {
      return { error: { error: 'class_label, section, and roll_number are required', status: 400 } };
    }

    const existing = await this.repo.findActiveEnrolment(tenantId, studentId, sessionId);
    if (existing) {
      return { error: { error: 'Active enrolment already exists for this session', status: 409 } };
    }

    const enrolledOn = (input.enrolledOn || new Date().toISOString().slice(0, 10)).trim();
    if (!ISO_DATE.test(enrolledOn)) {
      return { error: { error: 'enrolled_on must be ISO date (YYYY-MM-DD)', status: 400 } };
    }

    const enrolment = await this.repo.insertEnrolment({
      id: uuidv4(),
      tenantId,
      studentId,
      academicSessionId: sessionId,
      classLabel,
      section,
      rollNumber,
      house: input.house?.trim() || null,
      enrolledOn,
    });

    await this.events.publish({
      type: 'school.student.enrolled',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: {
        studentId,
        enrolmentId: enrolment.id,
        academicSessionId: sessionId,
        classLabel,
        section,
      },
    });

    return { enrolment };
  }

  async exitStudent(
    tenantId: string,
    studentId: string,
    input: ExitStudentInput,
  ): Promise<{ student?: Student; error?: ServiceError }> {
    const student = await this.repo.getStudent(tenantId, studentId);
    if (!student) return { error: { error: 'Student not found', status: 404 } };

    const exitedOn = (input.exitedOn || '').trim();
    const exitReason = (input.exitReason || '').trim();
    if (!ISO_DATE.test(exitedOn)) {
      return { error: { error: 'exited_on must be ISO date (YYYY-MM-DD)', status: 400 } };
    }
    if (!exitReason) return { error: { error: 'exit_reason is required', status: 400 } };
    if (!STATUSES.has(input.newStatus)) {
      return { error: { error: 'invalid new_status', status: 400 } };
    }

    const active = await this.repo.listActiveEnrolments(tenantId, studentId);
    for (const e of active) {
      await this.repo.closeEnrolment(tenantId, e.id, exitedOn, exitReason);
    }
    await this.repo.setStudentStatus(tenantId, studentId, input.newStatus);

    await this.events.publish({
      type: 'school.student.exited',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: {
        studentId,
        exitedOn,
        exitReason,
        newStatus: input.newStatus,
        closedEnrolments: active.map((e) => e.id),
      },
    });

    const updated = await this.repo.getStudent(tenantId, studentId);
    return { student: updated! };
  }

  async createGuardian(
    tenantId: string,
    input: CreateGuardianInput,
  ): Promise<{ guardian?: Guardian; error?: ServiceError }> {
    const validated = this.validateGuardianFields(input);
    if ('error' in validated) return { error: validated };

    const guardian = await this.repo.insertGuardian({
      id: uuidv4(),
      tenantId,
      ...validated,
    });
    return { guardian };
  }

  async listGuardians(tenantId: string): Promise<Guardian[]> {
    return this.repo.listGuardians(tenantId);
  }

  async getGuardian(tenantId: string, id: string): Promise<Guardian | null> {
    return this.repo.getGuardian(tenantId, id);
  }

  async patchGuardian(
    tenantId: string,
    id: string,
    input: PatchGuardianInput,
  ): Promise<{ guardian?: Guardian; error?: ServiceError }> {
    const existing = await this.repo.getGuardian(tenantId, id);
    if (!existing) return { error: { error: 'Guardian not found', status: 404 } };

    const merged: CreateGuardianInput = {
      firstName: input.firstName ?? existing.firstName,
      lastName: input.lastName ?? existing.lastName,
      relation: (input.relation ?? existing.relation) as GuardianRelation,
      phone: input.phone ?? existing.phone,
      email: input.email !== undefined ? input.email : existing.email,
      preferredLanguage: input.preferredLanguage ?? existing.preferredLanguage,
      timezone: input.timezone ?? existing.timezone,
    };
    const validated = this.validateGuardianFields(merged);
    if ('error' in validated) return { error: validated };

    const guardian = await this.repo.updateGuardian(tenantId, id, {
      ...validated,
      timezone: merged.timezone,
      accessibility: input.accessibility ?? existing.accessibility,
      privacy: input.privacy ?? existing.privacy,
    });
    if (!guardian) return { error: { error: 'Guardian not found', status: 404 } };
    return { guardian };
  }

  async linkGuardian(
    tenantId: string,
    studentId: string,
    input: LinkGuardianInput,
  ): Promise<{ link?: StudentGuardian; error?: ServiceError }> {
    const student = await this.repo.getStudent(tenantId, studentId);
    if (!student) return { error: { error: 'Student not found', status: 404 } };

    const guardianId = (input.guardianId || '').trim();
    if (!guardianId) return { error: { error: 'guardian_id is required', status: 400 } };
    const guardian = await this.repo.getGuardian(tenantId, guardianId);
    if (!guardian) return { error: { error: 'Guardian not found', status: 404 } };

    const existingLink = await this.repo.getLink(tenantId, studentId, guardianId);
    if (!existingLink) {
      const count = await this.repo.countStudentGuardians(tenantId, studentId);
      if (count >= 4) {
        return { error: { error: 'Maximum 4 guardians per student', status: 400 } };
      }
    }

    const link = await this.repo.linkGuardian(
      tenantId,
      studentId,
      guardianId,
      !!input.isPrimary,
      {
        canViewEducation: input.canViewEducation,
        canViewFinance: input.canViewFinance,
        canViewMedical: input.canViewMedical,
        canAuthorizePickup: input.canAuthorizePickup,
        isEmergencyContact: input.isEmergencyContact,
        isDelegated: input.isDelegated,
        accessStartsOn: input.accessStartsOn,
        accessEndsOn: input.accessEndsOn,
        contactRestricted: input.contactRestricted,
        custodyNotesRef: input.custodyNotesRef,
        courtOrderRef: input.courtOrderRef,
      },
    );
    await this.repo.insertLinkAudit({
      id: uuidv4(),
      tenantId,
      studentId,
      guardianId,
      action: existingLink ? 'permissions_updated' : 'linked',
      actor: 'staff',
      details: { isPrimary: !!input.isPrimary },
      at: new Date().toISOString(),
    });
    return { link };
  }

  async unlinkGuardian(
    tenantId: string,
    studentId: string,
    guardianId: string,
  ): Promise<{ error?: ServiceError }> {
    const student = await this.repo.getStudent(tenantId, studentId);
    if (!student) return { error: { error: 'Student not found', status: 404 } };

    const link = await this.repo.getLink(tenantId, studentId, guardianId);
    if (!link) return { error: { error: 'Link not found', status: 404 } };

    const count = await this.repo.countStudentGuardians(tenantId, studentId);
    if (student.status === 'active' && count <= 1) {
      return { error: { error: 'last_guardian', status: 409 } };
    }

    await this.repo.unlinkGuardian(tenantId, studentId, guardianId);
    return {};
  }

  async listGuardiansForStudent(tenantId: string, studentId: string) {
    const student = await this.repo.getStudent(tenantId, studentId);
    if (!student) return { error: { error: 'Student not found', status: 404 } as ServiceError };
    const guardians = await this.repo.listGuardiansForStudent(tenantId, studentId);
    return { guardians };
  }

  async listStudentsForGuardian(tenantId: string, guardianId: string) {
    const guardian = await this.repo.getGuardian(tenantId, guardianId);
    if (!guardian) return { error: { error: 'Guardian not found', status: 404 } as ServiceError };
    const rows = await this.repo.listStudentsForGuardianWithLinks(tenantId, guardianId);
    const enriched = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const { student: s, link } of rows) {
      if (link.accessStartsOn && link.accessStartsOn > today) continue;
      if (link.accessEndsOn && link.accessEndsOn < today) continue;
      const enrolments = await this.repo.listActiveEnrolments(tenantId, s.id);
      const active = enrolments[0] ?? null;
      enriched.push({
        ...s,
        photo_ref: s.photoRef,
        class_label: active?.classLabel ?? null,
        section: active?.section ?? null,
        classLabel: active?.classLabel ?? null,
        permissions: {
          canViewEducation: link.canViewEducation,
          canViewFinance: link.canViewFinance,
          canViewMedical: link.canViewMedical,
          canAuthorizePickup: link.canAuthorizePickup,
          isEmergencyContact: link.isEmergencyContact,
          isDelegated: link.isDelegated,
          isPrimary: link.isPrimary,
          contactRestricted: link.contactRestricted,
        },
      });
    }
    return { students: enriched };
  }

  async listStudentConsents(
    tenantId: string,
    studentId: string,
  ): Promise<{ consents?: ConsentRecord[]; error?: ServiceError }> {
    const student = await this.repo.getStudent(tenantId, studentId);
    if (!student) return { error: { error: 'Student not found', status: 404 } };
    const rows = await this.repo.listConsentRows(tenantId, studentId);
    const byKind = new Map(rows.map((r) => [r.kind, r]));
    const consents = CONSENT_KINDS.map((kind) => {
      const row = byKind.get(kind);
      if (row) return row;
      return {
        id: null,
        tenantId,
        studentId,
        kind,
        state: 'not_sought' as ConsentState,
        grantedByGuardianId: null,
        artefactRef: null,
        verificationMethod: null,
        notedBy: null,
        stateChangedAt: null,
        createdAt: null,
        updatedAt: null,
      };
    });
    return { consents };
  }

  async transitionConsent(
    tenantId: string,
    studentId: string,
    input: ConsentTransitionInput,
  ): Promise<{ consent?: ConsentRecord; error?: ServiceError }> {
    const student = await this.repo.getStudent(tenantId, studentId);
    if (!student) return { error: { error: 'Student not found', status: 404 } };

    if (!CONSENT_KINDS.includes(input.kind)) {
      return { error: { error: 'invalid kind', status: 400 } };
    }
    if (!['granted', 'refused', 'withdrawn', 'not_sought'].includes(input.state)) {
      return { error: { error: 'invalid state', status: 400 } };
    }
    const notedBy = (input.notedBy || '').trim();
    if (!notedBy) return { error: { error: 'noted_by is required', status: 400 } };

    const existing = await this.repo.getConsentRow(tenantId, studentId, input.kind);
    const fromState: ConsentState = existing?.state ?? 'not_sought';
    const toState = input.state;
    const allowed = ALLOWED_TRANSITIONS[fromState] ?? [];
    if (!allowed.includes(toState)) {
      return { error: { error: `invalid transition ${fromState}→${toState}`, status: 409 } };
    }

    if (toState === 'granted' && STRICT_GRANT_KINDS.has(input.kind)) {
      const guardianId = (input.grantedByGuardianId || '').trim();
      const artefactRef = (input.artefactRef || '').trim();
      const method = input.verificationMethod;
      if (!guardianId || !artefactRef || !method || !VERIFICATION_METHODS.has(method)) {
        return {
          error: {
            error:
              'granted for apaar|biometric|dpdp_processing requires guardian id, verification_method, and artefact_ref',
            status: 400,
          },
        };
      }
      const guardian = await this.repo.getGuardian(tenantId, guardianId);
      if (!guardian) return { error: { error: 'Guardian not found', status: 404 } };
    }

    const consent = await this.repo.upsertConsent({
      id: existing?.id ?? uuidv4(),
      tenantId,
      studentId,
      kind: input.kind,
      state: toState,
      grantedByGuardianId: input.grantedByGuardianId?.trim() || null,
      artefactRef: input.artefactRef?.trim() || null,
      verificationMethod: input.verificationMethod ?? null,
      notedBy,
    });

    await this.repo.insertConsentAudit({
      id: uuidv4(),
      tenantId,
      consentId: consent.id!,
      fromState,
      toState,
      actor: notedBy,
      reason: input.reason?.trim() || null,
    });

    await this.events.publish({
      type: 'school.consent.changed',
      tenantId,
      occurredAt: new Date().toISOString(),
      data: {
        studentId,
        consentId: consent.id,
        kind: input.kind,
        fromState,
        toState,
      },
    });

    return { consent };
  }

  async consentSummary(tenantId: string): Promise<ConsentSummary> {
    const totalStudents = await this.repo.countStudents(tenantId);
    const grouped = await this.repo.countConsentsByKindState(tenantId);
    const summary = {} as ConsentSummary;
    for (const kind of CONSENT_KINDS) {
      summary[kind] = { granted: 0, refused: 0, not_sought: 0, withdrawn: 0 };
    }
    const accounted = {} as Record<ConsentKind, number>;
    for (const kind of CONSENT_KINDS) accounted[kind] = 0;

    for (const row of grouped) {
      const kind = row.kind as ConsentKind;
      if (!summary[kind]) continue;
      const state = row.state as ConsentState;
      if (state === 'granted' || state === 'refused' || state === 'withdrawn' || state === 'not_sought') {
        summary[kind][state] += row.c;
        accounted[kind] += row.c;
      }
    }
    for (const kind of CONSENT_KINDS) {
      summary[kind].not_sought += Math.max(0, totalStudents - accounted[kind]);
    }
    return summary;
  }

  async udisePreflight(
    tenantId: string,
    sessionId: string,
    opts: { limit?: number; offset?: number } = {},
  ): Promise<
    | {
        total: number;
        passing: number;
        failing: number;
        results: Array<{
          studentId: string;
          admissionNumber: string;
          ok: boolean;
          errors: UdiseIssue[];
          infos: UdiseIssue[];
          warnings: UdiseIssue[];
        }>;
      }
    | { error: ServiceError }
  > {
    if (!sessionId?.trim()) {
      return { error: { error: 'session_id is required', status: 400 } };
    }
    const session = await this.repo.getSession(tenantId, sessionId);
    if (!session) return { error: { error: 'Academic session not found', status: 404 } };

    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);
    const offset = Math.max(opts.offset ?? 0, 0);
    const { items, total } = await this.repo.listStudents(tenantId, { limit, offset });

    const results = [];
    let passing = 0;
    let failing = 0;

    for (const student of items) {
      const enrolment = await this.repo.findActiveEnrolment(tenantId, student.id, sessionId);
      const apaar = await this.repo.getConsentRow(tenantId, student.id, 'apaar');
      const hasPriorOpenEnrolment = await this.repo.hasOpenEnrolmentOutsideSession(
        tenantId,
        student.id,
        sessionId,
      );
      const validation = validateStudentForUdise(student, enrolment, {
        apaarState: apaar?.state ?? 'not_sought',
        sessionStartsOn: session.startsOn,
        hasPriorOpenEnrolment,
      });
      if (validation.ok) passing += 1;
      else failing += 1;
      results.push({
        studentId: student.id,
        admissionNumber: student.admissionNumber,
        ok: validation.ok,
        errors: validation.errors,
        infos: validation.infos,
        warnings: validation.warnings,
      });
    }

    // Totals across the page only would under-count — compute full totals when offset=0 and page covers all,
    // otherwise scan all students for aggregate counts (still paginate results).
    if (offset === 0 && items.length >= total) {
      return { total, passing, failing, results };
    }

    let passAll = 0;
    let failAll = 0;
    const all = await this.repo.listStudents(tenantId, { limit: 10_000, offset: 0 });
    for (const student of all.items) {
      const enrolment = await this.repo.findActiveEnrolment(tenantId, student.id, sessionId);
      const apaar = await this.repo.getConsentRow(tenantId, student.id, 'apaar');
      const hasPriorOpenEnrolment = await this.repo.hasOpenEnrolmentOutsideSession(
        tenantId,
        student.id,
        sessionId,
      );
      const validation = validateStudentForUdise(student, enrolment, {
        apaarState: apaar?.state ?? 'not_sought',
        sessionStartsOn: session.startsOn,
        hasPriorOpenEnrolment,
      });
      if (validation.ok) passAll += 1;
      else failAll += 1;
    }

    return { total: all.total, passing: passAll, failing: failAll, results };
  }

  private validateGuardianFields(
    input: CreateGuardianInput,
  ):
    | {
        firstName: string;
        lastName: string;
        relation: GuardianRelation;
        phone: string;
        email: string | null;
        preferredLanguage: string;
      }
    | ServiceError {
    const firstName = (input.firstName || '').trim();
    const lastName = (input.lastName || '').trim();
    if (!firstName || !lastName) {
      return { error: 'first_name and last_name are required', status: 400 };
    }
    if (!RELATIONS.has(input.relation)) {
      return { error: 'invalid relation', status: 400 };
    }
    const phone = (input.phone || '').trim();
    if (!INDIAN_MOBILE.test(phone) && !E164.test(phone)) {
      return {
        error: 'phone must be Indian 10-digit mobile (6–9…) or E.164 with +',
        status: 400,
      };
    }
    let email: string | null = null;
    if (input.email != null && String(input.email).trim() !== '') {
      email = String(input.email).trim();
      if (!EMAIL_RE.test(email)) {
        return { error: 'invalid email', status: 400 };
      }
    }
    const preferredLanguage = (input.preferredLanguage || 'en').trim();
    if (!LANG_RE.test(preferredLanguage)) {
      return { error: 'preferred_language must be a 2–5 letter code', status: 400 };
    }
    return {
      firstName,
      lastName,
      relation: input.relation,
      phone,
      email,
      preferredLanguage,
    };
  }

  private async validateAgainstStatePack(
    tenantId: string,
    stateStudentId: string | null,
    stateCategoryCode: string | null,
  ): Promise<ServiceError | null> {
    const packCode = await this.repo.getTenantStatePackCode(tenantId);
    if (!packCode) return null;
    const pack = getStatePack(packCode);
    if (!pack) return null;

    if (stateCategoryCode) {
      const ok = pack.categories.some((c) => c.code === stateCategoryCode);
      if (!ok) {
        return { error: 'state_category_code is not valid for tenant state pack', status: 400 };
      }
    }

    if (stateStudentId && pack.studentIdField) {
      const re = new RegExp(pack.studentIdField.pattern);
      if (!re.test(stateStudentId)) {
        return {
          error: `state_student_id must match ${pack.studentIdField.label} pattern`,
          status: 400,
        };
      }
    }

    return null;
  }

  private validateStudentFields(
    input: CreateStudentInput,
    requireAdmission: boolean,
  ):
    | (Omit<Student, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>)
    | ServiceError {
    const firstName = (input.firstName || '').trim();
    const lastName = (input.lastName || '').trim();
    if (!firstName || !lastName) {
      return { error: 'first_name and last_name are required', status: 400 };
    }

    const admissionNumber = (input.admissionNumber || '').trim();
    if (requireAdmission && !admissionNumber) {
      return { error: 'admission_number is required', status: 400 };
    }

    const dob = (input.dob || '').trim();
    const admissionDate = (input.admissionDate || '').trim();
    if (!ISO_DATE.test(dob) || !ISO_DATE.test(admissionDate)) {
      return { error: 'dob and admission_date must be ISO dates (YYYY-MM-DD)', status: 400 };
    }

    const age = ageYearsAt(dob, admissionDate);
    if (age === null || age < 2 || age > 25) {
      return { error: 'age at admission must be between 2 and 25', status: 400 };
    }

    if (!GENDERS.has(input.gender)) return { error: 'invalid gender', status: 400 };
    if (!STATUSES.has(input.status)) return { error: 'invalid status', status: 400 };
    if (!CATEGORIES.has(input.category)) return { error: 'invalid category', status: 400 };

    const motherName = (input.motherName || '').trim();
    const fatherName = (input.fatherName || '').trim();
    const guardianContact = (input.guardianContact || '').trim();
    if (!motherName || !fatherName || !guardianContact) {
      return { error: 'mother_name, father_name, and guardian_contact are required', status: 400 };
    }

    let aadhaarLast4: string | null = null;
    if (input.aadhaarLast4 != null && String(input.aadhaarLast4).trim() !== '') {
      const last4 = String(input.aadhaarLast4).trim();
      if (!/^\d{4}$/.test(last4)) {
        return { error: 'aadhaar_last4 must be exactly 4 digits', status: 400 };
      }
      aadhaarLast4 = last4;
    }

    return {
      admissionNumber,
      firstName,
      lastName,
      dob,
      gender: input.gender,
      admissionDate,
      status: input.status,
      category: input.category,
      stateCategoryCode: input.stateCategoryCode?.trim() || null,
      stateStudentId: input.stateStudentId?.trim() || null,
      motherName,
      fatherName,
      guardianContact,
      aadhaarLast4,
      apaarId: input.apaarId?.trim() || null,
      penId: input.penId?.trim() || null,
      udiseExportOk: !!input.udiseExportOk,
      isCwsn: !!input.isCwsn,
      cwsnCategory: input.cwsnCategory?.trim() || null,
      cwsnDisability: input.cwsnDisability?.trim() || null,
      cwsnCertificate: !!input.cwsnCertificate,
      isRte: !!input.isRte,
      photoRef: input.photoRef?.trim() || null,
    };
  }
}

function ageYearsAt(dob: string, onDate: string): number | null {
  const [dy, dm, dd] = dob.split('-').map(Number);
  const [oy, om, od] = onDate.split('-').map(Number);
  if (!dy || !dm || !dd || !oy || !om || !od) return null;
  let age = oy - dy;
  if (om < dm || (om === dm && od < dd)) age -= 1;
  return age;
}

function containsFullAadhaar(payload: unknown): boolean {
  if (payload == null) return false;
  if (typeof payload === 'string') {
    const digits = payload.replace(/\s+/g, '');
    return /(?<!\d)\d{12}(?!\d)/.test(digits);
  }
  if (typeof payload !== 'object') return false;
  if (Array.isArray(payload)) return payload.some(containsFullAadhaar);
  for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
    if (FORBIDDEN_AADHAAR_KEYS.has(key)) return true;
    if (key === 'aadhaar_last4' || key === 'aadhaarLast4') {
      if (typeof value === 'string' && /^\d{12}$/.test(value.replace(/\s+/g, ''))) return true;
      continue;
    }
    if (containsFullAadhaar(value)) return true;
  }
  return false;
}
