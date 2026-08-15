import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolIdentityApp,
  validateStudentForUdise,
  type Enrolment,
  type Student,
} from '../src/index';
import type { SchoolIdentitySqlite } from '../src/db';

function baseStudent(overrides: Partial<Student> = {}): Student {
  return {
    id: 's1',
    tenantId: 't1',
    admissionNumber: 'ADM-1',
    firstName: 'Asha',
    lastName: 'Rao',
    dob: '2015-06-15',
    gender: 'female',
    admissionDate: '2025-04-01',
    status: 'active',
    category: 'GEN',
    stateCategoryCode: null,
    stateStudentId: null,
    motherName: 'Meera',
    fatherName: 'Ravi',
    guardianContact: '9876543210',
    aadhaarLast4: null,
    apaarId: null,
    penId: null,
    udiseExportOk: false,
    isCwsn: false,
    cwsnCategory: null,
    cwsnDisability: null,
    cwsnCertificate: false,
    isRte: false,
    photoRef: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

function baseEnrolment(overrides: Partial<Enrolment> = {}): Enrolment {
  return {
    id: 'e1',
    tenantId: 't1',
    studentId: 's1',
    academicSessionId: 'sess1',
    classLabel: '5',
    section: 'A',
    rollNumber: '1',
    house: null,
    enrolledOn: '2025-04-01',
    exitedOn: null,
    exitReason: null,
    createdAt: '',
    updatedAt: '',
    ...overrides,
  };
}

describe('validateStudentForUdise (pure)', () => {
  it('passes a complete student', () => {
    const r = validateStudentForUdise(baseStudent(), baseEnrolment());
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('fails missing name, class, mother, guardian', () => {
    const r = validateStudentForUdise(
      baseStudent({ firstName: '', motherName: '', guardianContact: '' }),
      null,
    );
    expect(r.ok).toBe(false);
    expect(r.errors.map((e) => e.code)).toEqual(
      expect.arrayContaining([
        'name_required',
        'class_section_required',
        'mother_name_required',
        'guardian_contact_required',
      ]),
    );
  });

  it('fails implausible age for class', () => {
    const r = validateStudentForUdise(
      baseStudent({ dob: '2005-01-01' }),
      baseEnrolment({ classLabel: '1' }),
    );
    expect(r.errors.some((e) => e.code === 'age_implausible_for_class')).toBe(true);
  });

  it('apaar refused with empty id is info not error', () => {
    const r = validateStudentForUdise(baseStudent({ apaarId: null }), baseEnrolment(), {
      apaarState: 'refused',
    });
    expect(r.ok).toBe(true);
    expect(r.errors).toHaveLength(0);
    expect(r.infos.some((i) => i.code === 'apaar_refused')).toBe(true);
  });

  it('apaar granted requires 12-digit id', () => {
    const fail = validateStudentForUdise(baseStudent({ apaarId: '123' }), baseEnrolment(), {
      apaarState: 'granted',
    });
    expect(fail.ok).toBe(false);
    expect(fail.errors.some((e) => e.code === 'apaar_id_required')).toBe(true);

    const ok = validateStudentForUdise(
      baseStudent({ apaarId: '123456789012' }),
      baseEnrolment(),
      { apaarState: 'granted' },
    );
    expect(ok.ok).toBe(true);
  });

  it('requires cwsn details when isCwsn', () => {
    const r = validateStudentForUdise(baseStudent({ isCwsn: true }), baseEnrolment());
    expect(r.errors.some((e) => e.code === 'cwsn_details_required')).toBe(true);
  });

  it('emits progression_before_admission warning', () => {
    const r = validateStudentForUdise(
      baseStudent({ admissionDate: '2025-06-01' }),
      baseEnrolment(),
      { sessionStartsOn: '2025-04-01', hasPriorOpenEnrolment: true },
    );
    expect(r.ok).toBe(true);
    expect(r.warnings.some((w) => w.code === 'progression_before_admission')).toBe(true);
  });
});

describe('udise preflight API', () => {
  let app: Express;
  let db: SchoolIdentitySqlite;

  beforeEach(async () => {
    const created = await createSchoolIdentityApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('aggregates and paginates preflight results', async () => {
    const session = await request(app).post('/api/identity/t1/sessions').send({
      label: '2025-26',
      starts_on: '2025-04-01',
      ends_on: '2026-03-31',
    });
    const sessionId = session.body.id as string;

    for (let i = 0; i < 3; i++) {
      const s = await request(app)
        .post('/api/identity/t1/students')
        .send({
          admission_number: `U-${i}`,
          first_name: `Kid${i}`,
          last_name: 'Test',
          dob: '2015-06-15',
          gender: 'female',
          admission_date: '2025-04-01',
          status: 'active',
          category: 'GEN',
          mother_name: 'M',
          father_name: 'F',
          guardian_contact: '9876543210',
        });
      if (i < 2) {
        await request(app)
          .post(`/api/identity/t1/students/${s.body.id}/enrol`)
          .send({
            academic_session_id: sessionId,
            class_label: '5',
            section: 'A',
            roll_number: String(i + 1),
          });
      }
    }

    const page = await request(app).get(
      `/api/identity/t1/udise/preflight?session_id=${sessionId}&limit=2&offset=0`,
    );
    expect(page.status).toBe(200);
    expect(page.body.total).toBe(3);
    expect(page.body.results).toHaveLength(2);
    expect(page.body.passing + page.body.failing).toBe(3);
    expect(page.body.failing).toBeGreaterThanOrEqual(1);
  });
});
