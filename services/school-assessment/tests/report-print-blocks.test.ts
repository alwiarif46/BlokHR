import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolAssessmentApp,
  type SchoolAssessmentSqlite,
} from '../src/index';

describe('school-assessment report print blocks (Phase 3)', () => {
  let app: Express;
  let db: SchoolAssessmentSqlite;

  beforeEach(async () => {
    const created = await createSchoolAssessmentApp({
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

  async function promotePrintTemplate(definition: unknown[]) {
    const created = await request(app)
      .post('/api/assessment/t1/templates')
      .set(staff('school_admin'))
      .send({
        label: 'Print Card',
        board_format: 'cbse_9pt',
        definition,
      });
    expect(created.status).toBe(201);
    const promoted = await request(app)
      .post(`/api/assessment/t1/templates/${created.body.id}/promote`)
      .set(staff('school_admin'));
    expect(promoted.status).toBe(200);
    return promoted.body.id as string;
  }

  it('accepts new block types on createReportTemplate', async () => {
    const created = await request(app)
      .post('/api/assessment/t1/templates')
      .set(staff('school_admin'))
      .send({
        label: 'Layout',
        board_format: 'cbse_9pt',
        definition: [
          { type: 'header', config: { school_name: 'Blok High', logo_ref: 'media/logo-1' } },
          { type: 'footer', config: { text: 'Confidential' } },
          { type: 'signatures', config: { lines: [{ role: 'Principal' }] } },
          { type: 'health', config: {} },
          { type: 'co_scholastic', config: {} },
          { type: 'marks_table', config: { aggregation: 'avg' } },
        ],
      });
    expect(created.status).toBe(201);
    expect(created.body.definition.map((b: { type: string }) => b.type)).toEqual([
      'header',
      'footer',
      'signatures',
      'health',
      'co_scholastic',
      'marks_table',
    ]);

    const bad = await request(app)
      .post('/api/assessment/t1/templates')
      .set(staff('school_admin'))
      .send({
        label: 'Bad',
        board_format: 'cbse_9pt',
        definition: [{ type: 'watermark_blob', config: {} }],
      });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toMatch(/invalid block type/i);
  });

  it('generate with header/signatures/health/co_scholastic stores refs only', async () => {
    const templateId = await promotePrintTemplate([
      {
        type: 'header',
        config: { school_name: 'Blok High', logo_ref: 'storage://logos/school-a.png' },
      },
      { type: 'signatures', config: {} },
      { type: 'health', config: {} },
      { type: 'co_scholastic', config: {} },
      { type: 'hpc_summary', config: {} },
    ]);

    const generated = await request(app)
      .post('/api/assessment/t1/report-cards/generate')
      .set(staff('school_admin'))
      .send({
        template_id: templateId,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [
          {
            student_id: 's1',
            health: { height_cm: 140, weight_kg: 35, notes_ref: 'health/s1-term1' },
            co_scholastic: { art: 'A', sports: 'B', evidence_ref: 'coschol/s1' },
            signatures: [
              { role: 'Class Teacher', image_ref: 'sig/teacher-1' },
              { role: 'Principal', name: 'Dr. Rao' },
            ],
          },
        ],
      });
    expect(generated.status).toBe(201);
    const blocks = generated.body.cards[0].payload.blocks as Array<{
      type: string;
      data: Record<string, unknown>;
    }>;

    const header = blocks.find((b) => b.type === 'header')!;
    expect(header.data.logoRef ?? header.data.logo_ref).toBe(
      'storage://logos/school-a.png',
    );
    expect(JSON.stringify(header)).not.toMatch(/base64|data:image/i);

    const signatures = blocks.find((b) => b.type === 'signatures')!;
    const lines = signatures.data.lines as Array<Record<string, unknown>>;
    expect(lines).toHaveLength(2);
    expect(lines[0]!.image_ref ?? lines[0]!.imageRef).toBe('sig/teacher-1');
    expect(JSON.stringify(signatures)).not.toMatch(/base64|data:image/i);

    const health = blocks.find((b) => b.type === 'health')!;
    expect(health.data.notes_ref).toBe('health/s1-term1');
    expect(health.data.height_cm).toBe(140);

    const co = blocks.find((b) => b.type === 'co_scholastic')!;
    expect(co.data.evidence_ref).toBe('coschol/s1');
  });

  it('generate without health succeeds', async () => {
    const templateId = await promotePrintTemplate([
      { type: 'header', config: { school_name: 'Blok High', logo_ref: 'logo-1' } },
      { type: 'health', config: {} },
      { type: 'marks_table', config: { aggregation: 'avg' } },
    ]);

    const generated = await request(app)
      .post('/api/assessment/t1/report-cards/generate')
      .set(staff('school_admin'))
      .send({
        template_id: templateId,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [{ student_id: 's1', remarks: 'ok' }],
      });
    expect(generated.status).toBe(201);
    const health = generated.body.cards[0].payload.blocks.find(
      (b: { type: string }) => b.type === 'health',
    );
    expect(health).toBeTruthy();
    expect(health.data).toEqual({});
  });

  it('HPC block does not insert assessment_inputs', async () => {
    const before = await db.get<{ c: number }>(
      'SELECT COUNT(*) AS c FROM assessment_inputs WHERE tenant_id = ?',
      ['t1'],
    );
    const templateId = await promotePrintTemplate([
      { type: 'hpc_summary', config: {} },
      { type: 'remarks', config: {} },
    ]);

    const generated = await request(app)
      .post('/api/assessment/t1/report-cards/generate')
      .set(staff('school_admin'))
      .send({
        template_id: templateId,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [{ student_id: 's1' }],
      });
    expect(generated.status).toBe(201);
    expect(
      generated.body.cards[0].payload.blocks.find(
        (b: { type: string }) => b.type === 'hpc_summary',
      ),
    ).toBeTruthy();

    const after = await db.get<{ c: number }>(
      'SELECT COUNT(*) AS c FROM assessment_inputs WHERE tenant_id = ?',
      ['t1'],
    );
    expect(after?.c ?? 0).toBe(before?.c ?? 0);
  });

  it('regeneration creates new row; old payload unchanged', async () => {
    const templateId = await promotePrintTemplate([
      {
        type: 'header',
        config: { school_name: 'Blok High', logo_ref: 'logo-v1' },
      },
      { type: 'remarks', config: {} },
    ]);

    const first = await request(app)
      .post('/api/assessment/t1/report-cards/generate')
      .set(staff('school_admin'))
      .send({
        template_id: templateId,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [{ student_id: 's1', remarks: 'first' }],
      });
    expect(first.status).toBe(201);
    const cardId = first.body.cards[0].id as string;
    const firstPayload = structuredClone(first.body.cards[0].payload);

    const second = await request(app)
      .post('/api/assessment/t1/report-cards/generate')
      .set(staff('school_admin'))
      .send({
        template_id: templateId,
        session: 'ay-2025',
        generated_by: 'admin',
        students: [{ student_id: 's1', remarks: 'second' }],
      });
    expect(second.status).toBe(201);
    expect(second.body.cards[0].id).not.toBe(cardId);

    const old = await request(app)
      .get(`/api/assessment/t1/report-cards/${cardId}`)
      .set(staff('school_admin'));
    expect(old.status).toBe(200);
    expect(old.body.payload).toEqual(firstPayload);
    expect(old.body.payload.blocks.find((b: { type: string }) => b.type === 'remarks').data.remarks).toBe(
      'first',
    );
  });
});
