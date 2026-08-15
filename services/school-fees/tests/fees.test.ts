import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolFeesApp, type SchoolFeesSqlite } from '../src/index';

describe('school-fees structures (P6-01)', () => {
  let app: Express;
  let db: SchoolFeesSqlite;

  beforeEach(async () => {
    const created = await createSchoolFeesApp({
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
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('fee heads CRUD + unique code', async () => {
    const created = await request(app).post('/api/fees/t1/heads').send({
      code: 'TUITION',
      label: 'Tuition',
      kind: 'tuition',
      taxable: false,
    });
    expect(created.status).toBe(201);
    expect(created.body.code).toBe('TUITION');
    const id = created.body.id as string;

    const dup = await request(app).post('/api/fees/t1/heads').send({
      code: 'TUITION',
      label: 'Dup',
      kind: 'tuition',
    });
    expect(dup.status).toBe(409);

    const patched = await request(app).patch(`/api/fees/t1/heads/${id}`).send({
      label: 'Tuition Fee',
    });
    expect(patched.body.label).toBe('Tuition Fee');

    const listed = await request(app).get('/api/fees/t1/heads');
    expect(listed.body.heads).toHaveLength(1);

    const del = await request(app).delete(`/api/fees/t1/heads/${id}`);
    expect(del.status).toBe(200);
    expect((await request(app).get('/api/fees/t1/heads')).body.heads).toEqual([]);
  });

  it('structures validate amounts and head refs', async () => {
    const head = await request(app).post('/api/fees/t1/heads').send({
      code: 'LAB',
      label: 'Lab',
      kind: 'lab',
    });
    const headId = head.body.id as string;

    const badAmt = await request(app).post('/api/fees/t1/structures').send({
      academic_session_ref: '2025-26',
      class_label: '5-A',
      label: 'Class 5',
      lines: [{ fee_head_id: headId, amount_paise: 0, schedule: 'annual' }],
    });
    expect(badAmt.status).toBe(400);

    const badHead = await request(app).post('/api/fees/t1/structures').send({
      academic_session_ref: '2025-26',
      class_label: '5-A',
      label: 'Class 5',
      lines: [{ fee_head_id: 'missing', amount_paise: 10000, schedule: 'term' }],
    });
    expect(badHead.status).toBe(400);

    const ok = await request(app).post('/api/fees/t1/structures').send({
      academic_session_ref: '2025-26',
      class_label: '5-A',
      label: 'Class 5 fees',
      lines: [{ fee_head_id: headId, amount_paise: 500000, schedule: 'monthly' }],
    });
    expect(ok.status).toBe(201);
    expect(ok.body.lines[0].amountPaise).toBe(500000);
    expect(ok.body.active).toBe(true);
  });

  it('concessions pct/flat validation + CRUD', async () => {
    const head = await request(app).post('/api/fees/t1/heads').send({
      code: 'TUITION',
      label: 'Tuition',
      kind: 'tuition',
    });
    const headId = head.body.id as string;

    const badPct = await request(app).post('/api/fees/t1/concessions').send({
      code: 'SIB',
      label: 'Sibling',
      kind: 'pct',
      value: 150,
    });
    expect(badPct.status).toBe(400);

    const pct = await request(app).post('/api/fees/t1/concessions').send({
      code: 'SIB',
      label: 'Sibling',
      kind: 'pct',
      value: 25,
      applies_to_heads: [headId],
    });
    expect(pct.status).toBe(201);
    expect(pct.body.appliesToHeads).toEqual([headId]);

    const flat = await request(app).post('/api/fees/t1/concessions').send({
      code: 'STAFF',
      label: 'Staff',
      kind: 'flat',
      value: 100000,
    });
    expect(flat.status).toBe(201);
    expect(flat.body.appliesToHeads).toBeNull();

    const listed = await request(app).get('/api/fees/t1/concessions');
    expect(listed.body.concessions).toHaveLength(2);
  });

  it('tenant isolation', async () => {
    const head = await request(app).post('/api/fees/t1/heads').send({
      code: 'EXAM',
      label: 'Exam',
      kind: 'exam',
    });
    const other = await request(app).get(`/api/fees/t2/heads/${head.body.id}`);
    expect(other.status).toBe(404);
    expect((await request(app).get('/api/fees/t2/heads')).body.heads).toEqual([]);
  });
});
