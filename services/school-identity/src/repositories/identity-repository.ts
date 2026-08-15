import type { SchoolIdentityDb } from '../db';
import type {
  AcademicSession,
  ConsentKind,
  ConsentRecord,
  ConsentState,
  ConsentVerificationMethod,
  Enrolment,
  Guardian,
  Student,
  StudentGuardian,
} from '../types';

interface SessionRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  is_current: number;
  created_at: string;
  updated_at: string;
}

interface StudentRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  admission_number: string;
  first_name: string;
  last_name: string;
  dob: string;
  gender: string;
  admission_date: string;
  status: string;
  category: string;
  state_category_code: string | null;
  state_student_id: string | null;
  mother_name: string;
  father_name: string;
  guardian_contact: string;
  aadhaar_last4: string | null;
  apaar_id: string | null;
  pen_id: string | null;
  udise_export_ok: number;
  is_cwsn: number;
  cwsn_category: string | null;
  cwsn_disability: string | null;
  cwsn_certificate: number;
  is_rte: number;
  photo_ref: string | null;
  created_at: string;
  updated_at: string;
}

interface EnrolmentRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_id: string;
  academic_session_id: string;
  class_label: string;
  section: string;
  roll_number: string;
  house: string | null;
  enrolled_on: string;
  exited_on: string | null;
  exit_reason: string | null;
  created_at: string;
  updated_at: string;
}

function mapSession(row: SessionRow): AcademicSession {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    label: row.label,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    isCurrent: row.is_current === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapStudent(row: StudentRow): Student {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    admissionNumber: row.admission_number,
    firstName: row.first_name,
    lastName: row.last_name,
    dob: row.dob,
    gender: row.gender as Student['gender'],
    admissionDate: row.admission_date,
    status: row.status as Student['status'],
    category: row.category as Student['category'],
    stateCategoryCode: row.state_category_code,
    stateStudentId: row.state_student_id ?? null,
    motherName: row.mother_name,
    fatherName: row.father_name,
    guardianContact: row.guardian_contact,
    aadhaarLast4: row.aadhaar_last4,
    apaarId: row.apaar_id,
    penId: row.pen_id,
    udiseExportOk: row.udise_export_ok === 1,
    isCwsn: row.is_cwsn === 1,
    cwsnCategory: row.cwsn_category,
    cwsnDisability: row.cwsn_disability,
    cwsnCertificate: row.cwsn_certificate === 1,
    isRte: row.is_rte === 1,
    photoRef: row.photo_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEnrolment(row: EnrolmentRow): Enrolment {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    academicSessionId: row.academic_session_id,
    classLabel: row.class_label,
    section: row.section,
    rollNumber: row.roll_number,
    house: row.house,
    enrolledOn: row.enrolled_on,
    exitedOn: row.exited_on,
    exitReason: row.exit_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class IdentityRepository {
  constructor(private readonly db: SchoolIdentityDb) {}

  async listSessions(tenantId: string): Promise<AcademicSession[]> {
    const rows = await this.db.all<SessionRow>(
      `SELECT * FROM academic_sessions WHERE tenant_id = ? ORDER BY starts_on DESC`,
      [tenantId],
    );
    return rows.map(mapSession);
  }

  async getSession(tenantId: string, id: string): Promise<AcademicSession | null> {
    const row = await this.db.get<SessionRow>(
      'SELECT * FROM academic_sessions WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapSession(row) : null;
  }

  async clearCurrent(tenantId: string): Promise<void> {
    await this.db.run(
      `UPDATE academic_sessions SET is_current = 0, updated_at = datetime('now')
       WHERE tenant_id = ? AND is_current = 1`,
      [tenantId],
    );
  }

  async insertSession(session: {
    id: string;
    tenantId: string;
    label: string;
    startsOn: string;
    endsOn: string;
    isCurrent: boolean;
  }): Promise<AcademicSession> {
    await this.db.run(
      `INSERT INTO academic_sessions (id, tenant_id, label, starts_on, ends_on, is_current)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.tenantId,
        session.label,
        session.startsOn,
        session.endsOn,
        session.isCurrent ? 1 : 0,
      ],
    );
    const row = await this.db.get<SessionRow>(
      'SELECT * FROM academic_sessions WHERE id = ? AND tenant_id = ?',
      [session.id, session.tenantId],
    );
    if (!row) throw new Error('Failed to read inserted session');
    return mapSession(row);
  }

  async findStudentByAdmission(
    tenantId: string,
    admissionNumber: string,
  ): Promise<Student | null> {
    const row = await this.db.get<StudentRow>(
      'SELECT * FROM students WHERE tenant_id = ? AND admission_number = ?',
      [tenantId, admissionNumber],
    );
    return row ? mapStudent(row) : null;
  }

  async getStudent(tenantId: string, id: string): Promise<Student | null> {
    const row = await this.db.get<StudentRow>(
      'SELECT * FROM students WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapStudent(row) : null;
  }

  async getTenantStatePackCode(tenantId: string): Promise<string | null> {
    const row = await this.db.get<{ pack_code: string }>(
      'SELECT pack_code FROM tenant_state_pack WHERE tenant_id = ?',
      [tenantId],
    );
    return row?.pack_code ?? null;
  }

  async setTenantStatePack(tenantId: string, packCode: string): Promise<void> {
    await this.db.run(
      `INSERT INTO tenant_state_pack (tenant_id, pack_code, updated_at)
       VALUES (?, ?, datetime('now'))
       ON CONFLICT(tenant_id) DO UPDATE SET
         pack_code = excluded.pack_code,
         updated_at = datetime('now')`,
      [tenantId, packCode],
    );
  }

  async insertStudent(s: Student): Promise<Student> {
    await this.db.run(
      `INSERT INTO students (
         id, tenant_id, admission_number, first_name, last_name, dob, gender,
         admission_date, status, category, state_category_code, state_student_id,
         mother_name, father_name, guardian_contact, aadhaar_last4, apaar_id, pen_id,
         udise_export_ok, is_cwsn, cwsn_category, cwsn_disability, cwsn_certificate,
         is_rte, photo_ref
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        s.id,
        s.tenantId,
        s.admissionNumber,
        s.firstName,
        s.lastName,
        s.dob,
        s.gender,
        s.admissionDate,
        s.status,
        s.category,
        s.stateCategoryCode,
        s.stateStudentId,
        s.motherName,
        s.fatherName,
        s.guardianContact,
        s.aadhaarLast4,
        s.apaarId,
        s.penId,
        s.udiseExportOk ? 1 : 0,
        s.isCwsn ? 1 : 0,
        s.cwsnCategory,
        s.cwsnDisability,
        s.cwsnCertificate ? 1 : 0,
        s.isRte ? 1 : 0,
        s.photoRef,
      ],
    );
    const created = await this.getStudent(s.tenantId, s.id);
    if (!created) throw new Error('Failed to read inserted student');
    return created;
  }

  async updateStudent(tenantId: string, id: string, patch: Record<string, unknown>): Promise<Student | null> {
    const existing = await this.getStudent(tenantId, id);
    if (!existing) return null;
    const next: Student = {
      ...existing,
      firstName: (patch.firstName as string) ?? existing.firstName,
      lastName: (patch.lastName as string) ?? existing.lastName,
      dob: (patch.dob as string) ?? existing.dob,
      gender: (patch.gender as Student['gender']) ?? existing.gender,
      admissionDate: (patch.admissionDate as string) ?? existing.admissionDate,
      status: (patch.status as Student['status']) ?? existing.status,
      category: (patch.category as Student['category']) ?? existing.category,
      stateCategoryCode:
        patch.stateCategoryCode !== undefined
          ? (patch.stateCategoryCode as string | null)
          : existing.stateCategoryCode,
      stateStudentId:
        patch.stateStudentId !== undefined
          ? (patch.stateStudentId as string | null)
          : existing.stateStudentId,
      motherName: (patch.motherName as string) ?? existing.motherName,
      fatherName: (patch.fatherName as string) ?? existing.fatherName,
      guardianContact: (patch.guardianContact as string) ?? existing.guardianContact,
      aadhaarLast4:
        patch.aadhaarLast4 !== undefined
          ? (patch.aadhaarLast4 as string | null)
          : existing.aadhaarLast4,
      apaarId: patch.apaarId !== undefined ? (patch.apaarId as string | null) : existing.apaarId,
      penId: patch.penId !== undefined ? (patch.penId as string | null) : existing.penId,
      udiseExportOk:
        patch.udiseExportOk !== undefined ? !!patch.udiseExportOk : existing.udiseExportOk,
      isCwsn: patch.isCwsn !== undefined ? !!patch.isCwsn : existing.isCwsn,
      cwsnCategory:
        patch.cwsnCategory !== undefined
          ? (patch.cwsnCategory as string | null)
          : existing.cwsnCategory,
      cwsnDisability:
        patch.cwsnDisability !== undefined
          ? (patch.cwsnDisability as string | null)
          : existing.cwsnDisability,
      cwsnCertificate:
        patch.cwsnCertificate !== undefined ? !!patch.cwsnCertificate : existing.cwsnCertificate,
      isRte: patch.isRte !== undefined ? !!patch.isRte : existing.isRte,
      photoRef: patch.photoRef !== undefined ? (patch.photoRef as string | null) : existing.photoRef,
    };
    await this.db.run(
      `UPDATE students SET
         first_name = ?, last_name = ?, dob = ?, gender = ?, admission_date = ?, status = ?,
         category = ?, state_category_code = ?, state_student_id = ?, mother_name = ?, father_name = ?,
         guardian_contact = ?, aadhaar_last4 = ?, apaar_id = ?, pen_id = ?,
         udise_export_ok = ?, is_cwsn = ?, cwsn_category = ?, cwsn_disability = ?,
         cwsn_certificate = ?, is_rte = ?, photo_ref = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        next.firstName,
        next.lastName,
        next.dob,
        next.gender,
        next.admissionDate,
        next.status,
        next.category,
        next.stateCategoryCode,
        next.stateStudentId,
        next.motherName,
        next.fatherName,
        next.guardianContact,
        next.aadhaarLast4,
        next.apaarId,
        next.penId,
        next.udiseExportOk ? 1 : 0,
        next.isCwsn ? 1 : 0,
        next.cwsnCategory,
        next.cwsnDisability,
        next.cwsnCertificate ? 1 : 0,
        next.isRte ? 1 : 0,
        next.photoRef,
        tenantId,
        id,
      ],
    );
    return this.getStudent(tenantId, id);
  }

  async listStudents(
    tenantId: string,
    opts: {
      status?: string;
      classLabel?: string;
      section?: string;
      q?: string;
      limit: number;
      offset: number;
    },
  ): Promise<{ items: Student[]; total: number }> {
    const where: string[] = ['s.tenant_id = ?'];
    const params: unknown[] = [tenantId];

    if (opts.status) {
      where.push('s.status = ?');
      params.push(opts.status);
    }
    if (opts.q) {
      where.push(
        `(s.first_name LIKE ? OR s.last_name LIKE ? OR s.admission_number LIKE ? OR (s.first_name || ' ' || s.last_name) LIKE ?)`,
      );
      const like = `%${opts.q}%`;
      params.push(like, like, like, like);
    }
    if (opts.classLabel || opts.section) {
      where.push(`EXISTS (
        SELECT 1 FROM enrolments e
        WHERE e.tenant_id = s.tenant_id AND e.student_id = s.id AND e.exited_on IS NULL
        ${opts.classLabel ? 'AND e.class_label = ?' : ''}
        ${opts.section ? 'AND e.section = ?' : ''}
      )`);
      if (opts.classLabel) params.push(opts.classLabel);
      if (opts.section) params.push(opts.section);
    }

    const whereSql = where.join(' AND ');
    const countRow = await this.db.get<{ c: number }>(
      `SELECT count(*) as c FROM students s WHERE ${whereSql}`,
      params,
    );
    const rows = await this.db.all<StudentRow>(
      `SELECT s.* FROM students s WHERE ${whereSql}
       ORDER BY s.last_name, s.first_name
       LIMIT ? OFFSET ?`,
      [...params, opts.limit, opts.offset],
    );
    return { items: rows.map(mapStudent), total: countRow?.c ?? 0 };
  }

  async findActiveEnrolment(
    tenantId: string,
    studentId: string,
    academicSessionId: string,
  ): Promise<Enrolment | null> {
    const row = await this.db.get<EnrolmentRow>(
      `SELECT * FROM enrolments
       WHERE tenant_id = ? AND student_id = ? AND academic_session_id = ? AND exited_on IS NULL`,
      [tenantId, studentId, academicSessionId],
    );
    return row ? mapEnrolment(row) : null;
  }

  async listActiveEnrolments(tenantId: string, studentId: string): Promise<Enrolment[]> {
    const rows = await this.db.all<EnrolmentRow>(
      `SELECT * FROM enrolments
       WHERE tenant_id = ? AND student_id = ? AND exited_on IS NULL
       ORDER BY enrolled_on DESC`,
      [tenantId, studentId],
    );
    return rows.map(mapEnrolment);
  }

  async hasOpenEnrolmentOutsideSession(
    tenantId: string,
    studentId: string,
    sessionId: string,
  ): Promise<boolean> {
    const row = await this.db.get<{ c: number }>(
      `SELECT count(*) as c FROM enrolments
       WHERE tenant_id = ? AND student_id = ? AND exited_on IS NULL
         AND academic_session_id != ?`,
      [tenantId, studentId, sessionId],
    );
    return (row?.c ?? 0) > 0;
  }

  async insertEnrolment(e: {
    id: string;
    tenantId: string;
    studentId: string;
    academicSessionId: string;
    classLabel: string;
    section: string;
    rollNumber: string;
    house: string | null;
    enrolledOn: string;
  }): Promise<Enrolment> {
    await this.db.run(
      `INSERT INTO enrolments (
         id, tenant_id, student_id, academic_session_id, class_label, section,
         roll_number, house, enrolled_on
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        e.id,
        e.tenantId,
        e.studentId,
        e.academicSessionId,
        e.classLabel,
        e.section,
        e.rollNumber,
        e.house,
        e.enrolledOn,
      ],
    );
    const row = await this.db.get<EnrolmentRow>(
      'SELECT * FROM enrolments WHERE id = ? AND tenant_id = ?',
      [e.id, e.tenantId],
    );
    if (!row) throw new Error('Failed to read enrolment');
    return mapEnrolment(row);
  }

  async closeEnrolment(
    tenantId: string,
    enrolmentId: string,
    exitedOn: string,
    exitReason: string,
  ): Promise<void> {
    await this.db.run(
      `UPDATE enrolments SET exited_on = ?, exit_reason = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [exitedOn, exitReason, tenantId, enrolmentId],
    );
  }

  async setStudentStatus(tenantId: string, studentId: string, status: string): Promise<void> {
    await this.db.run(
      `UPDATE students SET status = ?, updated_at = datetime('now') WHERE tenant_id = ? AND id = ?`,
      [status, tenantId, studentId],
    );
  }

  async insertGuardian(g: {
    id: string;
    tenantId: string;
    firstName: string;
    lastName: string;
    relation: string;
    phone: string;
    email: string | null;
    preferredLanguage: string;
  }): Promise<Guardian> {
    await this.db.run(
      `INSERT INTO guardians (
         id, tenant_id, first_name, last_name, relation, phone, email, preferred_language
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        g.id,
        g.tenantId,
        g.firstName,
        g.lastName,
        g.relation,
        g.phone,
        g.email,
        g.preferredLanguage,
      ],
    );
    const row = await this.getGuardian(g.tenantId, g.id);
    if (!row) throw new Error('Failed to read guardian');
    return row;
  }

  async getGuardian(tenantId: string, id: string): Promise<Guardian | null> {
    const row = await this.db.get<GuardianRow>(
      'SELECT * FROM guardians WHERE tenant_id = ? AND id = ?',
      [tenantId, id],
    );
    return row ? mapGuardian(row) : null;
  }

  async listGuardians(tenantId: string): Promise<Guardian[]> {
    const rows = await this.db.all<GuardianRow>(
      `SELECT * FROM guardians WHERE tenant_id = ? ORDER BY last_name, first_name`,
      [tenantId],
    );
    return rows.map(mapGuardian);
  }

  async updateGuardian(
    tenantId: string,
    id: string,
    patch: {
      firstName: string;
      lastName: string;
      relation: string;
      phone: string;
      email: string | null;
      preferredLanguage: string;
    },
  ): Promise<Guardian | null> {
    const existing = await this.getGuardian(tenantId, id);
    if (!existing) return null;
    await this.db.run(
      `UPDATE guardians SET
         first_name = ?, last_name = ?, relation = ?, phone = ?, email = ?,
         preferred_language = ?, updated_at = datetime('now')
       WHERE tenant_id = ? AND id = ?`,
      [
        patch.firstName,
        patch.lastName,
        patch.relation,
        patch.phone,
        patch.email,
        patch.preferredLanguage,
        tenantId,
        id,
      ],
    );
    return this.getGuardian(tenantId, id);
  }

  async countStudentGuardians(tenantId: string, studentId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      `SELECT count(*) as c FROM student_guardians WHERE tenant_id = ? AND student_id = ?`,
      [tenantId, studentId],
    );
    return row?.c ?? 0;
  }

  async getLink(
    tenantId: string,
    studentId: string,
    guardianId: string,
  ): Promise<StudentGuardian | null> {
    const row = await this.db.get<LinkRow>(
      `SELECT * FROM student_guardians
       WHERE tenant_id = ? AND student_id = ? AND guardian_id = ?`,
      [tenantId, studentId, guardianId],
    );
    return row ? mapLink(row) : null;
  }

  async clearPrimaryGuardians(tenantId: string, studentId: string): Promise<void> {
    await this.db.run(
      `UPDATE student_guardians SET is_primary = 0
       WHERE tenant_id = ? AND student_id = ?`,
      [tenantId, studentId],
    );
  }

  async linkGuardian(
    tenantId: string,
    studentId: string,
    guardianId: string,
    isPrimary: boolean,
  ): Promise<StudentGuardian> {
    if (isPrimary) {
      await this.clearPrimaryGuardians(tenantId, studentId);
    }
    const existing = await this.getLink(tenantId, studentId, guardianId);
    if (existing) {
      await this.db.run(
        `UPDATE student_guardians SET is_primary = ?
         WHERE tenant_id = ? AND student_id = ? AND guardian_id = ?`,
        [isPrimary ? 1 : 0, tenantId, studentId, guardianId],
      );
    } else {
      await this.db.run(
        `INSERT INTO student_guardians (student_id, guardian_id, tenant_id, is_primary)
         VALUES (?, ?, ?, ?)`,
        [studentId, guardianId, tenantId, isPrimary ? 1 : 0],
      );
    }
    return (await this.getLink(tenantId, studentId, guardianId))!;
  }

  async unlinkGuardian(tenantId: string, studentId: string, guardianId: string): Promise<boolean> {
    const existing = await this.getLink(tenantId, studentId, guardianId);
    if (!existing) return false;
    await this.db.run(
      `DELETE FROM student_guardians
       WHERE tenant_id = ? AND student_id = ? AND guardian_id = ?`,
      [tenantId, studentId, guardianId],
    );
    return true;
  }

  async listGuardiansForStudent(
    tenantId: string,
    studentId: string,
  ): Promise<Array<Guardian & { isPrimary: boolean }>> {
    const rows = await this.db.all<GuardianRow & { is_primary: number }>(
      `SELECT g.*, sg.is_primary FROM guardians g
       INNER JOIN student_guardians sg
         ON sg.guardian_id = g.id AND sg.tenant_id = g.tenant_id
       WHERE sg.tenant_id = ? AND sg.student_id = ?
       ORDER BY sg.is_primary DESC, g.last_name, g.first_name`,
      [tenantId, studentId],
    );
    return rows.map((r) => ({ ...mapGuardian(r), isPrimary: r.is_primary === 1 }));
  }

  async listStudentsForGuardian(tenantId: string, guardianId: string): Promise<Student[]> {
    const rows = await this.db.all<StudentRow>(
      `SELECT s.* FROM students s
       INNER JOIN student_guardians sg
         ON sg.student_id = s.id AND sg.tenant_id = s.tenant_id
       WHERE sg.tenant_id = ? AND sg.guardian_id = ?
       ORDER BY s.last_name, s.first_name`,
      [tenantId, guardianId],
    );
    return rows.map(mapStudent);
  }

  async countStudents(tenantId: string): Promise<number> {
    const row = await this.db.get<{ c: number }>(
      'SELECT count(*) as c FROM students WHERE tenant_id = ?',
      [tenantId],
    );
    return row?.c ?? 0;
  }

  async getConsentRow(
    tenantId: string,
    studentId: string,
    kind: ConsentKind,
  ): Promise<ConsentRecord | null> {
    const row = await this.db.get<ConsentRow>(
      `SELECT * FROM consents WHERE tenant_id = ? AND student_id = ? AND kind = ?`,
      [tenantId, studentId, kind],
    );
    return row ? mapConsent(row) : null;
  }

  async listConsentRows(tenantId: string, studentId: string): Promise<ConsentRecord[]> {
    const rows = await this.db.all<ConsentRow>(
      `SELECT * FROM consents WHERE tenant_id = ? AND student_id = ?`,
      [tenantId, studentId],
    );
    return rows.map(mapConsent);
  }

  async upsertConsent(input: {
    id: string;
    tenantId: string;
    studentId: string;
    kind: ConsentKind;
    state: ConsentState;
    grantedByGuardianId: string | null;
    artefactRef: string | null;
    verificationMethod: ConsentVerificationMethod | null;
    notedBy: string | null;
  }): Promise<ConsentRecord> {
    const existing = await this.getConsentRow(input.tenantId, input.studentId, input.kind);
    if (existing?.id) {
      await this.db.run(
        `UPDATE consents SET
           state = ?, granted_by_guardian_id = ?, artefact_ref = ?, verification_method = ?,
           noted_by = ?, state_changed_at = datetime('now'), updated_at = datetime('now')
         WHERE tenant_id = ? AND id = ?`,
        [
          input.state,
          input.grantedByGuardianId,
          input.artefactRef,
          input.verificationMethod,
          input.notedBy,
          input.tenantId,
          existing.id,
        ],
      );
      return (await this.getConsentRow(input.tenantId, input.studentId, input.kind))!;
    }
    await this.db.run(
      `INSERT INTO consents (
         id, tenant_id, student_id, kind, state, granted_by_guardian_id,
         artefact_ref, verification_method, noted_by, state_changed_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        input.id,
        input.tenantId,
        input.studentId,
        input.kind,
        input.state,
        input.grantedByGuardianId,
        input.artefactRef,
        input.verificationMethod,
        input.notedBy,
      ],
    );
    return (await this.getConsentRow(input.tenantId, input.studentId, input.kind))!;
  }

  async insertConsentAudit(input: {
    id: string;
    tenantId: string;
    consentId: string;
    fromState: string;
    toState: string;
    actor: string;
    reason: string | null;
  }): Promise<void> {
    await this.db.run(
      `INSERT INTO consent_audit (id, tenant_id, consent_id, from_state, to_state, actor, reason)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.tenantId,
        input.consentId,
        input.fromState,
        input.toState,
        input.actor,
        input.reason,
      ],
    );
  }

  async listConsentAudits(tenantId: string, consentId: string): Promise<
    Array<{
      id: string;
      fromState: string;
      toState: string;
      actor: string;
      reason: string | null;
      at: string;
    }>
  > {
    const rows = await this.db.all<{
      id: string;
      from_state: string;
      to_state: string;
      actor: string;
      reason: string | null;
      at: string;
    } & Record<string, unknown>>(
      `SELECT * FROM consent_audit WHERE tenant_id = ? AND consent_id = ? ORDER BY at`,
      [tenantId, consentId],
    );
    return rows.map((r) => ({
      id: r.id,
      fromState: r.from_state,
      toState: r.to_state,
      actor: r.actor,
      reason: r.reason,
      at: r.at,
    }));
  }

  async countConsentsByKindState(
    tenantId: string,
  ): Promise<Array<{ kind: string; state: string; c: number }>> {
    return this.db.all<{ kind: string; state: string; c: number } & Record<string, unknown>>(
      `SELECT kind, state, count(*) as c FROM consents WHERE tenant_id = ?
       GROUP BY kind, state`,
      [tenantId],
    );
  }
}

interface ConsentRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  student_id: string;
  kind: string;
  state: string;
  granted_by_guardian_id: string | null;
  artefact_ref: string | null;
  verification_method: string | null;
  noted_by: string | null;
  state_changed_at: string;
  created_at: string;
  updated_at: string;
}

function mapConsent(row: ConsentRow): ConsentRecord {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    studentId: row.student_id,
    kind: row.kind as ConsentKind,
    state: row.state as ConsentState,
    grantedByGuardianId: row.granted_by_guardian_id,
    artefactRef: row.artefact_ref,
    verificationMethod: row.verification_method as ConsentVerificationMethod | null,
    notedBy: row.noted_by,
    stateChangedAt: row.state_changed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

interface GuardianRow extends Record<string, unknown> {
  id: string;
  tenant_id: string;
  first_name: string;
  last_name: string;
  relation: string;
  phone: string;
  email: string | null;
  preferred_language: string;
  created_at: string;
  updated_at: string;
}

interface LinkRow extends Record<string, unknown> {
  student_id: string;
  guardian_id: string;
  tenant_id: string;
  is_primary: number;
}

function mapGuardian(row: GuardianRow): Guardian {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    firstName: row.first_name,
    lastName: row.last_name,
    relation: row.relation as Guardian['relation'],
    phone: row.phone,
    email: row.email,
    preferredLanguage: row.preferred_language,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapLink(row: LinkRow): StudentGuardian {
  return {
    studentId: row.student_id,
    guardianId: row.guardian_id,
    tenantId: row.tenant_id,
    isPrimary: row.is_primary === 1,
  };
}
