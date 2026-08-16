import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolComplianceApp,
  addDaysIso,
  DEFAULT_SLA_DAYS,
  ERASURE_REQUIRED_SERVICES,
  type DomainEvent,
  type EventPublisher,
  type SchoolComplianceSqlite,
  type DsrService,
} from '../src/index';

const CREATED = new Date('2026-01-01T10:00:00.000Z');

describe('school-compliance DSR (P8-04)', () => {
  let app: Express;
  let db: SchoolComplianceSqlite;
  let dsr: DsrService;
  let events: DomainEvent[];

  beforeEach(async () => {
    events = [];
    const publisher: EventPublisher = {
      publish: async (e) => {
        events.push(e);
      },
    };
    const created = await createSchoolComplianceApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      clock: () => CREATED,
      events: publisher,
    });
    app = created.app;
    db = created.db;
    dsr = created.dsr;
  });

  afterEach(async () => {
    await db.close();
  });

  async function createRequest(
    tenant: string,
    body: Record<string, unknown> = {},
  ) {
    return request(app)
      .post(`/api/compliance/${tenant}/data-requests`)
      .send({
        student_ref: 'stu-1',
        guardian_ref: 'g-1',
        kind: 'access',
        ...body,
      });
  }

  async function advance(
    tenant: string,
    id: string,
    state: string,
    extra: Record<string, unknown> = {},
  ) {
    return request(app)
      .patch(`/api/compliance/${tenant}/data-requests/${id}`)
      .send({ state, handled_by: 'clerk', ...extra });
  }

  it('SLA defaults to 30 days and respects tenant_config', async () => {
    expect(addDaysIso('2026-01-01', DEFAULT_SLA_DAYS)).toBe('2026-01-31');

    const a = await createRequest('t1');
    expect(a.status).toBe(201);
    expect(a.body.slaDueOn).toBe('2026-01-31');
    expect(events.some((e) => e.type === 'school.dsr.received')).toBe(true);

    await dsr.setSlaDays('t1', 14);
    const b = await createRequest('t1', { student_ref: 'stu-2' });
    expect(b.status).toBe(201);
    expect(b.body.slaDueOn).toBe('2026-01-15');

    await dsr.setSlaDays('t2', 7);
    const c = await createRequest('t2');
    expect(c.body.slaDueOn).toBe('2026-01-08');
  });

  it('enforces transition chain and audits each step', async () => {
    const created = await createRequest('t1', { kind: 'correction' });
    const id = created.body.id as string;

    expect(
      (await advance('t1', id, 'in_progress')).status,
    ).toBe(400);

    expect((await advance('t1', id, 'verifying')).status).toBe(200);
    expect((await advance('t1', id, 'in_progress')).status).toBe(200);

    const rejectNoNote = await advance('t1', id, 'rejected');
    expect(rejectNoNote.status).toBe(400);

    const rejected = await advance('t1', id, 'rejected', {
      resolution_note: 'identity mismatch',
    });
    expect(rejected.status).toBe(200);
    expect(rejected.body.state).toBe('rejected');

    const detail = await request(app).get(
      `/api/compliance/t1/data-requests/${id}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.audit.map((a: { toState: string }) => a.toState)).toEqual(
      ['verifying', 'in_progress', 'rejected'],
    );
  });

  it('erasure completion requires services_confirmed checklist', async () => {
    const created = await createRequest('t1', { kind: 'erasure' });
    const id = created.body.id as string;
    await advance('t1', id, 'verifying');
    await advance('t1', id, 'in_progress');

    const incomplete = await advance('t1', id, 'completed', {
      details: { services_confirmed: ['identity', 'attendance'] },
    });
    expect(incomplete.status).toBe(400);
    expect(incomplete.body.error).toContain('assessment');
    expect(incomplete.body.error).toContain('engagement');

    const ok = await advance('t1', id, 'completed', {
      details: {
        services_confirmed: [...ERASURE_REQUIRED_SERVICES],
      },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.state).toBe('completed');
  });

  it('overdue list + sweep emits once per request', async () => {
    const created = await createRequest('t1');
    const id = created.body.id as string;

    const overdueList = await request(app).get(
      '/api/compliance/t1/data-requests?overdue=true&today=2026-02-01',
    );
    expect(overdueList.status).toBe(200);
    expect(overdueList.body.requests).toHaveLength(1);
    expect(overdueList.body.requests[0].id).toBe(id);

    events.length = 0;
    const sweep1 = await request(app)
      .post('/api/compliance/t1/data-requests/sweep-overdue')
      .send({ today: '2026-02-01' });
    expect(sweep1.status).toBe(200);
    expect(sweep1.body.emitted).toEqual([{ requestId: id }]);
    expect(events.filter((e) => e.type === 'school.dsr.overdue')).toHaveLength(1);

    events.length = 0;
    const sweep2 = await request(app)
      .post('/api/compliance/t1/data-requests/sweep-overdue')
      .send({ today: '2026-02-01' });
    expect(sweep2.body.emitted).toEqual([]);
    expect(events.filter((e) => e.type === 'school.dsr.overdue')).toHaveLength(0);
  });

  it('isolates tenants', async () => {
    const a = await createRequest('t1');
    const b = await createRequest('t2', { student_ref: 'other' });

    const listA = await request(app).get('/api/compliance/t1/data-requests');
    expect(listA.body.requests).toHaveLength(1);
    expect(listA.body.requests[0].id).toBe(a.body.id);

    const cross = await request(app).get(
      `/api/compliance/t1/data-requests/${b.body.id}`,
    );
    expect(cross.status).toBe(404);
  });
});
