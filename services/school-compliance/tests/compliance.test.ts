import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolComplianceApp,
  daysUntilDue,
  SAMPLE_COMPLIANCE_ITEM_COUNT,
  type SchoolComplianceSqlite,
} from '../src/index';

describe('due-math', () => {
  it('fixed date and window end', () => {
    const today = new Date('2025-09-01T00:00:00.000Z');
    expect(daysUntilDue({ month: 9, day: 30 }, today)).toBe(29);
    expect(
      daysUntilDue(
        { window_start: { m: 7, d: 1 }, window_end: { m: 9, d: 30 } },
        today,
      ),
    ).toBe(29);
    expect(daysUntilDue({ month: 8, day: 15 }, today)).toBe(-17);
  });
});

describe('school-compliance calendar (P8-01)', () => {
  let app: Express;
  let db: SchoolComplianceSqlite;

  beforeEach(async () => {
    const created = await createSchoolComplianceApp({
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

  it('health + seed visibility', async () => {
    expect((await request(app).get('/health')).body.ok).toBe(true);
    const cal = await request(app).get(
      '/api/compliance/t1/calendar?session=2025-26&today=2025-09-01',
    );
    expect(cal.status).toBe(200);
    expect(cal.body.entries.length).toBe(SAMPLE_COMPLIANCE_ITEM_COUNT);
    const udise = cal.body.entries.find(
      (e: { item: { key: string } }) => e.item.key === 'udise_freeze',
    );
    expect(udise.daysUntilDue).toBe(29);
    expect(udise.item.guidance).toContain('VERIFY DATES ANNUALLY');
  });

  it('status transitions forward and backward-with-note', async () => {
    const fwd = await request(app).put('/api/compliance/t1/status').send({
      item_key: 'udise_freeze',
      academic_session_ref: '2025-26',
      state: 'in_progress',
      updated_by: 'admin',
    });
    expect(fwd.status).toBe(200);
    expect(fwd.body.state).toBe('in_progress');

    const backNoNote = await request(app).put('/api/compliance/t1/status').send({
      item_key: 'udise_freeze',
      academic_session_ref: '2025-26',
      state: 'not_started',
      updated_by: 'admin',
    });
    expect(backNoNote.status).toBe(400);

    const back = await request(app).put('/api/compliance/t1/status').send({
      item_key: 'udise_freeze',
      academic_session_ref: '2025-26',
      state: 'not_started',
      note: 'Reset for rework',
      updated_by: 'admin',
    });
    expect(back.status).toBe(200);
    expect(back.body.state).toBe('not_started');
    expect(back.body.note).toBe('Reset for rework');
  });

  it('overdue list excludes submitted/closed', async () => {
    await request(app).put('/api/compliance/t1/status').send({
      item_key: 'udise_freeze',
      academic_session_ref: '2025-26',
      state: 'submitted',
      updated_by: 'admin',
    });
    const overdue = await request(app).get(
      '/api/compliance/t1/overdue?session=2025-26&today=2025-10-15',
    );
    expect(overdue.status).toBe(200);
    expect(
      overdue.body.entries.every(
        (e: { item: { key: string } }) => e.item.key !== 'udise_freeze',
      ),
    ).toBe(true);
    expect(overdue.body.entries.length).toBeGreaterThan(0);
  });

  it('tenant isolation', async () => {
    await request(app).put('/api/compliance/t1/status').send({
      item_key: 'cbse_loc',
      academic_session_ref: '2025-26',
      state: 'ready',
      updated_by: 'a',
    });
    const other = await request(app).get(
      '/api/compliance/t2/calendar?session=2025-26&today=2025-09-01',
    );
    const loc = other.body.entries.find(
      (e: { item: { key: string } }) => e.item.key === 'cbse_loc',
    );
    expect(loc.status).toBeNull();
  });
});
