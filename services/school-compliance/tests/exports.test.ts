import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolComplianceApp,
  escapeCsv,
  buildCsv,
  UDISE_COLUMNS,
  groupPreflightErrors,
  type DomainEvent,
  type EventPublisher,
  type IdentityClient,
  type IdentityStudentRow,
  type SchoolComplianceSqlite,
  type StorageClient,
  type UdisePreflightResult,
} from '../src/index';

describe('csv escape', () => {
  it('quotes commas quotes and newlines', () => {
    expect(escapeCsv('a,b')).toBe('"a,b"');
    expect(escapeCsv('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsv('a\nb')).toBe('"a\nb"');
    expect(escapeCsv('plain')).toBe('plain');
  });

  it('header row matches UDISE_COLUMNS', () => {
    const csv = buildCsv(UDISE_COLUMNS, [['Ram Kumar', '2015-01-01']]);
    expect(csv.split('\n')[0]).toBe(UDISE_COLUMNS.join(','));
  });
});

describe('groupPreflightErrors', () => {
  it('groups by code with first 20 refs', () => {
    const groups = groupPreflightErrors([
      {
        studentId: '1',
        admissionNumber: 'A1',
        ok: false,
        errors: [{ field: 'name', code: 'name_required', message: 'x' }],
        infos: [],
        warnings: [],
      },
      {
        studentId: '2',
        admissionNumber: 'A2',
        ok: false,
        errors: [
          { field: 'name', code: 'name_required', message: 'x' },
          { field: 'dob', code: 'dob_invalid', message: 'y' },
        ],
        infos: [],
        warnings: [],
      },
    ]);
    const name = groups.find((g) => g.code === 'name_required')!;
    expect(name.count).toBe(2);
    expect(name.studentRefs).toEqual(['A1', 'A2']);
  });
});

describe('school-compliance udise export (P8-02)', () => {
  let app: Express;
  let db: SchoolComplianceSqlite;
  let events: DomainEvent[];
  let storedBodies: string[];
  let identity: {
    preflight: UdisePreflightResult;
    students: IdentityStudentRow[];
    fail?: boolean;
  };

  function student(partial: Partial<IdentityStudentRow> & { id: string }): IdentityStudentRow {
    return {
      admissionNumber: partial.admissionNumber ?? partial.id,
      firstName: partial.firstName ?? 'Ram',
      lastName: partial.lastName ?? 'Kumar',
      dob: partial.dob ?? '2015-01-01',
      gender: partial.gender ?? 'male',
      admissionDate: partial.admissionDate ?? '2020-06-01',
      category: partial.category ?? 'GEN',
      motherName: partial.motherName ?? 'Sita',
      guardianContact: partial.guardianContact ?? '9999999999',
      apaarId: partial.apaarId ?? null,
      isCwsn: partial.isCwsn ?? false,
      cwsnCategory: partial.cwsnCategory ?? null,
      cwsnDisability: partial.cwsnDisability ?? null,
      cwsnCertificate: partial.cwsnCertificate ?? false,
      isRte: partial.isRte ?? false,
      classLabel: partial.classLabel ?? '5',
      section: partial.section ?? 'A',
      id: partial.id,
    };
  }

  beforeEach(async () => {
    events = [];
    storedBodies = [];
    identity = {
      preflight: { total: 0, passing: 0, failing: 0, results: [] },
      students: [],
    };
    const identityClient: IdentityClient = {
      udisePreflight: async () => {
        if (identity.fail) throw new Error('identity down');
        return identity.preflight;
      },
      listStudentsForUdise: async () => identity.students,
      listStudentsWithApaarConsent: async () =>
        identity.students.map((s) => ({
          student: s,
          apaarConsent: 'not_sought' as const,
        })),
    };
    const storage: StorageClient = {
      store: async ({ body }) => {
        storedBodies.push(body);
        return { fileRef: 'file://udise-test.csv' };
      },
    };
    const publisher: EventPublisher = {
      publish: async (e) => {
        events.push(e);
      },
    };
    const created = await createSchoolComplianceApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      identity: identityClient,
      storage,
      events: publisher,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('failing preflight blocks file + groups errors', async () => {
    identity.preflight = {
      total: 2,
      passing: 1,
      failing: 1,
      results: [
        {
          studentId: 's1',
          admissionNumber: 'ADM1',
          ok: true,
          errors: [],
          infos: [],
          warnings: [],
        },
        {
          studentId: 's2',
          admissionNumber: 'ADM2',
          ok: false,
          errors: [{ field: 'dob', code: 'dob_invalid', message: 'bad' }],
          infos: [],
          warnings: [],
        },
      ],
    };
    const res = await request(app).post('/api/compliance/t1/exports/udise').set(staff('school_admin')).send({
      session_ref: '2025-26',
      created_by: 'clerk',
    });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('failed');
    expect(res.body.fileRef).toBeNull();
    expect(res.body.errors[0].code).toBe('dob_invalid');
    expect(res.body.errors[0].studentRefs).toContain('ADM2');
    expect(storedBodies).toHaveLength(0);
    expect(events).toHaveLength(0);
  });

  it('passing produces header + escaping; emits ready', async () => {
    identity.students = [
      student({
        id: 's1',
        admissionNumber: 'ADM1',
        firstName: 'Asha',
        lastName: 'Sharma, Jr',
      }),
    ];
    identity.preflight = {
      total: 1,
      passing: 1,
      failing: 0,
      results: [
        {
          studentId: 's1',
          admissionNumber: 'ADM1',
          ok: true,
          errors: [],
          infos: [],
          warnings: [],
        },
      ],
    };
    const res = await request(app).post('/api/compliance/t1/exports/udise').set(staff('school_admin')).send({
      session_ref: '2025-26',
      created_by: 'clerk',
    });
    expect(res.status).toBe(201);
    expect(res.body.state).toBe('passed');
    expect(res.body.fileRef).toBe('file://udise-test.csv');
    expect(storedBodies[0]!.split('\n')[0]).toBe(UDISE_COLUMNS.join(','));
    expect(storedBodies[0]).toContain('"Asha Sharma, Jr"');
    expect(events.some((e) => e.type === 'school.compliance.export_ready')).toBe(true);

    const list = await request(app).get('/api/compliance/t1/exports?kind=udise_sdms').set(staff('school_admin'));
    expect(list.body.runs).toHaveLength(1);
    const one = await request(app).get(
      `/api/compliance/t1/exports/${res.body.id}`,
    ).set(staff('school_admin'));
    expect(one.body.id).toBe(res.body.id);
  });

  it('client failure → failed run not crash; tenant isolation', async () => {
    identity.fail = true;
    const res = await request(app).post('/api/compliance/t1/exports/udise').set(staff('school_admin')).send({
      session_ref: '2025-26',
      created_by: 'clerk',
    });
    expect(res.status).toBe(200);
    expect(res.body.state).toBe('failed');
    expect(res.body.errors[0].code).toBe('client_error');

    const other = await request(app).get('/api/compliance/t2/exports').set(staff('school_admin'));
    expect(other.body.runs).toEqual([]);
  });
});
