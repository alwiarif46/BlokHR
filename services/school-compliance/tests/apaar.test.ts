import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolComplianceApp,
  classifyApaarStudent,
  detectNameDobAnomalies,
  type IdentityClient,
  type IdentityStudentRow,
  type ApaarStudentBundle,
  type SchoolComplianceSqlite,
  type UdisePreflightResult,
} from '../src/index';

const TODAY = new Date('2026-08-15T12:00:00.000Z');

describe('detectNameDobAnomalies (table-driven)', () => {
  const cases: Array<{
    name: string;
    input: { firstName: string; lastName: string; dob: string };
    expectCodes: string[];
  }> = [
    {
      name: 'clean name and dob passes',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: [],
    },
    {
      name: 'leading whitespace fails',
      input: { firstName: ' Ram', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: ['name_whitespace'],
    },
    {
      name: 'trailing whitespace fails',
      input: { firstName: 'Ram', lastName: 'Kumar ', dob: '2015-01-01' },
      expectCodes: ['name_whitespace'],
    },
    {
      name: 'trimmed name passes whitespace check',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: [],
    },
    {
      name: 'digits in name fail',
      input: { firstName: 'Ram2', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: ['name_digits'],
    },
    {
      name: 'no digits pass',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: [],
    },
    {
      name: 'double space fails',
      input: { firstName: 'Ram  Nath', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: ['name_double_space'],
    },
    {
      name: 'single spaces pass',
      input: { firstName: 'Ram Nath', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: [],
    },
    {
      name: 'ALL-CAPS vs mixed fails',
      input: { firstName: 'RAM', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: ['name_case_mismatch'],
    },
    {
      name: 'consistent casing passes',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: [],
    },
    {
      name: 'future dob fails',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '2030-01-01' },
      expectCodes: ['dob_future'],
    },
    {
      name: 'past dob under 25 passes age checks',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: [],
    },
    {
      name: 'age over 25 fails',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '1990-01-01' },
      expectCodes: ['dob_age_over_25'],
    },
    {
      name: 'age 25 or under passes age>25',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '2001-08-15' },
      expectCodes: [],
    },
    {
      name: 'invalid dob format fails',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '01-01-2015' },
      expectCodes: ['dob_invalid'],
    },
    {
      name: 'valid YYYY-MM-DD format passes format check',
      input: { firstName: 'Ram', lastName: 'Kumar', dob: '2015-01-01' },
      expectCodes: [],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      const issues = detectNameDobAnomalies(c.input, TODAY);
      expect(issues.map((i) => i.code).sort()).toEqual([...c.expectCodes].sort());
      for (const issue of issues) {
        expect(issue.field).toBeTruthy();
        expect(issue.hint).toBeTruthy();
      }
    });
  }
});

describe('classifyApaarStudent', () => {
  const base = {
    id: 's1',
    admissionNumber: 'A1',
    firstName: 'Ram',
    lastName: 'Kumar',
    dob: '2015-01-01',
    gender: 'male',
    classLabel: '5',
    section: 'A',
    guardianContact: '9999999999',
    apaarConsent: 'granted' as const,
  };

  it('ready when consent granted and fields clean', () => {
    expect(classifyApaarStudent(base, TODAY)).toEqual({ status: 'ready' });
  });

  it('blocked_refused is terminal not an error shape', () => {
    const c = classifyApaarStudent({ ...base, apaarConsent: 'refused' }, TODAY);
    expect(c).toEqual({ status: 'blocked_refused' });
    expect('issues' in c).toBe(false);
  });

  it('needs_consent when not granted', () => {
    expect(
      classifyApaarStudent({ ...base, apaarConsent: 'not_sought' }, TODAY),
    ).toEqual({ status: 'needs_consent' });
    expect(
      classifyApaarStudent({ ...base, apaarConsent: 'withdrawn' }, TODAY),
    ).toEqual({ status: 'needs_consent' });
  });

  it('needs_fix with issues when anomalies present', () => {
    const c = classifyApaarStudent(
      { ...base, firstName: 'Ram2', lastName: 'Kumar' },
      TODAY,
    );
    expect(c.status).toBe('needs_fix');
    if (c.status === 'needs_fix') {
      expect(c.issues.some((i) => i.code === 'name_digits')).toBe(true);
    }
  });

  it('refused wins over field issues', () => {
    expect(
      classifyApaarStudent(
        { ...base, apaarConsent: 'refused', firstName: '' },
        TODAY,
      ),
    ).toEqual({ status: 'blocked_refused' });
  });
});

describe('school-compliance APAAR readiness (P8-03)', () => {
  let app: Express;
  let db: SchoolComplianceSqlite;
  let bundlesByTenant: Record<string, ApaarStudentBundle[]>;

  function student(
    partial: Partial<IdentityStudentRow> & { id: string },
  ): IdentityStudentRow {
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
    bundlesByTenant = {};
    const identityClient: IdentityClient = {
      udisePreflight: async (): Promise<UdisePreflightResult> => ({
        total: 0,
        passing: 0,
        failing: 0,
        results: [],
      }),
      listStudentsForUdise: async (tenantId) =>
        (bundlesByTenant[tenantId] ?? []).map((b) => b.student),
      listStudentsWithApaarConsent: async (tenantId) =>
        bundlesByTenant[tenantId] ?? [],
    };
    const created = await createSchoolComplianceApp({
      dbPath: path.join(
        process.cwd(),
        `test-apaar-${Date.now()}-${Math.random()}.sqlite`,
      ),
      logger: pino({ level: 'silent' }),
      clock: () => TODAY,
      identity: identityClient,
      storage: {
        store: async () => ({ fileRef: 'noop' }),
      },
    });
    app = created.app;
    db = created.db;
  });

  afterEach(() => {
    db.close();
  });

  it('classifies readiness counts and pagination', async () => {
    bundlesByTenant['t1'] = [
      {
        student: student({ id: '1', classLabel: '5', admissionNumber: 'A1' }),
        apaarConsent: 'granted',
      },
      {
        student: student({
          id: '2',
          classLabel: '5',
          admissionNumber: 'A2',
          firstName: 'Bad2',
        }),
        apaarConsent: 'granted',
      },
      {
        student: student({ id: '3', classLabel: '6', admissionNumber: 'A3' }),
        apaarConsent: 'refused',
      },
      {
        student: student({ id: '4', classLabel: '6', admissionNumber: 'A4' }),
        apaarConsent: 'not_sought',
      },
    ];

    const res = await request(app)
      .get('/api/compliance/t1/apaar/readiness').set(staff('school_admin'))
      .query({ session: '2025-26', limit: 2, offset: 0 });
    expect(res.status).toBe(200);
    expect(res.body.totals).toMatchObject({
      ready: 1,
      needs_fix: 1,
      blocked_refused: 1,
      needs_consent: 1,
      total: 4,
    });
    expect(res.body.students).toHaveLength(2);
    expect(res.body.total).toBe(4);
    expect(res.body.limit).toBe(2);
    expect(res.body.offset).toBe(0);

    const page2 = await request(app)
      .get('/api/compliance/t1/apaar/readiness').set(staff('school_admin'))
      .query({ session: '2025-26', limit: 2, offset: 2 });
    expect(page2.body.students).toHaveLength(2);
    expect(page2.body.offset).toBe(2);
  });

  it('form-list returns only needs_fix with issues', async () => {
    bundlesByTenant['t1'] = [
      {
        student: student({ id: '1', admissionNumber: 'OK' }),
        apaarConsent: 'granted',
      },
      {
        student: student({
          id: '2',
          admissionNumber: 'FIX',
          firstName: 'X1',
        }),
        apaarConsent: 'granted',
      },
      {
        student: student({ id: '3', admissionNumber: 'REF' }),
        apaarConsent: 'refused',
      },
    ];

    const res = await request(app)
      .get('/api/compliance/t1/apaar/form-list').set(staff('school_admin'))
      .query({ session: '2025-26' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(1);
    expect(res.body.students).toHaveLength(1);
    expect(res.body.students[0].admissionNumber).toBe('FIX');
    expect(res.body.students[0].issues.length).toBeGreaterThan(0);
  });

  it('requires session', async () => {
    const res = await request(app).get('/api/compliance/t1/apaar/readiness').set(staff('school_admin'));
    expect(res.status).toBe(400);
  });

  it('isolates tenants via stubbed identity', async () => {
    bundlesByTenant['t1'] = [
      {
        student: student({ id: '1', admissionNumber: 'T1' }),
        apaarConsent: 'granted',
      },
    ];
    bundlesByTenant['t2'] = [
      {
        student: student({
          id: '2',
          admissionNumber: 'T2',
          firstName: 'Bad2',
        }),
        apaarConsent: 'granted',
      },
    ];

    const a = await request(app)
      .get('/api/compliance/t1/apaar/readiness').set(staff('school_admin'))
      .query({ session: '2025-26' });
    const b = await request(app)
      .get('/api/compliance/t2/apaar/form-list').set(staff('school_admin'))
      .query({ session: '2025-26' });

    expect(a.body.totals.ready).toBe(1);
    expect(a.body.totals.total).toBe(1);
    expect(b.body.total).toBe(1);
    expect(b.body.students[0].admissionNumber).toBe('T2');
  });
});
