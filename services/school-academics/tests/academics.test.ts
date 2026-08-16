import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAcademicsApp,
  SAMPLE_NCERT_SEED_COUNT,
  type SchoolAcademicsSqlite,
} from '../src/index';

describe('school-academics outcomes (P3-01)', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;

  beforeEach(async () => {
    const created = await createSchoolAcademicsApp({
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

  it('health ok', async () => {
    const res = await request(app).get('/health').set(staff('school_admin'));
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('SAMPLE NCERT seed visible to all tenants', async () => {
    const t1 = await request(app).get('/api/academics/t1/outcomes').set(staff('school_admin'));
    const t2 = await request(app).get('/api/academics/t2/outcomes').set(staff('school_admin'));
    expect(t1.status).toBe(200);
    expect(t1.body.outcomes).toHaveLength(SAMPLE_NCERT_SEED_COUNT);
    expect(t2.body.outcomes).toHaveLength(SAMPLE_NCERT_SEED_COUNT);
    expect(t1.body.outcomes.every((o: { tenantId: string | null }) => o.tenantId == null)).toBe(
      true,
    );
    expect(t1.body.outcomes.some((o: { code: string }) => o.code === '8.Sc.LO1')).toBe(true);
  });

  it('search filters by class, subject, framework, q', async () => {
    const byClass = await request(app).get('/api/academics/t1/outcomes?class=8&subject=Sc').set(staff('school_admin'));
    expect(byClass.body.outcomes.length).toBe(3);
    expect(
      byClass.body.outcomes.every(
        (o: { classLabel: string; subjectCode: string }) =>
          o.classLabel === '8' && o.subjectCode === 'Sc',
      ),
    ).toBe(true);

    const byFw = await request(app).get('/api/academics/t1/outcomes?framework=ncert&q=LO4').set(staff('school_admin'));
    expect(byFw.body.outcomes.length).toBeGreaterThan(0);
    expect(byFw.body.outcomes.every((o: { code: string }) => o.code.includes('LO4'))).toBe(
      true,
    );
  });

  it('custom code must use CUST. prefix; tenant isolation', async () => {
    const bad = await request(app).post('/api/academics/t1/outcomes').set(staff('school_admin')).send({
      code: '8.Sc.LO99',
      class_label: '8',
      subject_code: 'Sc',
      description: 'not allowed',
    });
    expect(bad.status).toBe(400);

    const ok = await request(app).post('/api/academics/t1/outcomes').set(staff('school_admin')).send({
      code: 'CUST.8.Sc.extra',
      class_label: '8',
      subject_code: 'Sc',
      description: 'Tenant custom outcome',
    });
    expect(ok.status).toBe(201);
    expect(ok.body.tenantId).toBe('t1');
    expect(ok.body.framework).toBe('custom');

    const t1 = await request(app).get('/api/academics/t1/outcomes?q=CUST.').set(staff('school_admin'));
    const t2 = await request(app).get('/api/academics/t2/outcomes?q=CUST.').set(staff('school_admin'));
    expect(t1.body.outcomes).toHaveLength(1);
    expect(t2.body.outcomes).toHaveLength(0);
  });

  it('crosswalk CRUD with tenant isolation', async () => {
    const outcomes = await request(app).get('/api/academics/t1/outcomes?class=1&subject=M').set(staff('school_admin'));
    const a = outcomes.body.outcomes[0].id as string;
    const b = outcomes.body.outcomes[1].id as string;

    const created = await request(app).post('/api/academics/t1/crosswalk').set(staff('school_admin')).send({
      from_outcome_id: a,
      to_outcome_id: b,
      relation: 'prerequisite',
      note: 'build-up',
    });
    expect(created.status).toBe(201);
    expect(created.body.relation).toBe('prerequisite');

    const patched = await request(app)
      .patch(`/api/academics/t1/crosswalk/${created.body.id}`).set(staff('school_admin'))
      .send({ relation: 'partial', note: null });
    expect(patched.status).toBe(200);
    expect(patched.body.relation).toBe('partial');
    expect(patched.body.note).toBeNull();

    const list1 = await request(app).get('/api/academics/t1/crosswalk').set(staff('school_admin'));
    const list2 = await request(app).get('/api/academics/t2/crosswalk').set(staff('school_admin'));
    expect(list1.body.crosswalk).toHaveLength(1);
    expect(list2.body.crosswalk).toHaveLength(0);

    const del = await request(app).delete(
      `/api/academics/t1/crosswalk/${created.body.id}`,
    ).set(staff('school_admin'));
    expect(del.status).toBe(204);
    const empty = await request(app).get('/api/academics/t1/crosswalk').set(staff('school_admin'));
    expect(empty.body.crosswalk).toHaveLength(0);
  });
});
