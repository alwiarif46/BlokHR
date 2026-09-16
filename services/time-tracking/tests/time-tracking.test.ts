import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import { createTimeTrackingApp } from '../src/index';
import { asRole } from '../src/role-guard';
import type { Express } from 'express';
import type { TimeTrackingSqlite } from '../src/db';

const logger = pino({ level: 'silent' });
const SECRET = 'test-internal-secret';

describe('time-tracking service', () => {
  let app: Express;
  let db: TimeTrackingSqlite;

  beforeEach(async () => {
    const created = await createTimeTrackingApp({
      dbPath: ':memory:',
      logger,
      internalSecret: SECRET,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.ok === true || res.body.service === 'time-tracking').toBe(true);
  });

  it('creates client, project, entry and summary for employee self', async () => {
    const admin = asRole('admin', { secret: SECRET, tenantId: 't1', email: 'admin@t.test' });
    const clientRes = await request(app)
      .post('/api/time-tracking/t1/clients')
      .set(admin)
      .send({ id: 'acme', name: 'Acme Corp', billingRate: 100 });
    expect([200, 201]).toContain(clientRes.status);

    const projRes = await request(app)
      .post('/api/time-tracking/t1/projects')
      .set(admin)
      .send({ id: 'p1', clientId: 'acme', name: 'Website', billable: true });
    expect([200, 201]).toContain(projRes.status);

    const emp = asRole('employee', { secret: SECRET, tenantId: 't1', email: 'emp@t.test' });
    const log = await request(app)
      .post('/api/time-tracking/t1/time-entries')
      .set(emp)
      .send({ projectId: 'p1', date: '2026-08-15', hours: 4, description: 'Work' });
    expect([200, 201]).toContain(log.status);
    const entry = log.body.entry || log.body;
    expect(entry.email).toBe('emp@t.test');

    const list = await request(app).get('/api/time-tracking/t1/time-entries').set(emp);
    expect(list.body.entries).toHaveLength(1);

    const summary = await request(app).get('/api/time-tracking/t1/time-summary').set(emp);
    expect(summary.body.totalHours).toBe(4);
  });

  it('employee cannot read another email and cannot approve', async () => {
    const admin = asRole('admin', { secret: SECRET, tenantId: 't1', email: 'admin@t.test' });
    await request(app)
      .post('/api/time-tracking/t1/clients')
      .set(admin)
      .send({ id: 'internal', name: 'Internal' });
    await request(app)
      .post('/api/time-tracking/t1/projects')
      .set(admin)
      .send({ id: 'admin-overhead', clientId: 'internal', name: 'Admin', billable: false });

    const created = await request(app)
      .post('/api/time-tracking/t1/time-entries')
      .set(admin)
      .send({ email: 'other@t.test', projectId: 'admin-overhead', date: '2026-08-15', hours: 2 });
    expect([200, 201]).toContain(created.status);
    const createdEntry = created.body.entry || created.body;
    expect(createdEntry.id).toBeTruthy();

    const emp = asRole('employee', { secret: SECRET, tenantId: 't1', email: 'emp@t.test' });
    const list = await request(app)
      .get('/api/time-tracking/t1/time-entries?email=other@t.test')
      .set(emp);
    expect(list.body.entries).toHaveLength(0);

    const approve = await request(app)
      .post(`/api/time-tracking/t1/time-entries/${createdEntry.id}/approve`)
      .set(emp);
    expect(approve.status).toBe(403);
  });

  it('isolates tenants', async () => {
    const a1 = asRole('admin', { secret: SECRET, tenantId: 't1', email: 'a@t.test' });
    const a2 = asRole('admin', { secret: SECRET, tenantId: 't2', email: 'a@t.test' });
    await request(app)
      .post('/api/time-tracking/t1/clients')
      .set(a1)
      .send({ id: 'only-t1', name: 'T1 Client' });
    const t2 = await request(app).get('/api/time-tracking/t2/clients').set(a2);
    expect(t2.status).toBe(200);
    expect(t2.body.clients.find((c: { id: string }) => c.id === 'only-t1')).toBeFalsy();
  });

  it('denies employee creating clients', async () => {
    const emp = asRole('employee', { secret: SECRET, tenantId: 't1' });
    const res = await request(app)
      .post('/api/time-tracking/t1/clients')
      .set(emp)
      .send({ id: 'x', name: 'X' });
    expect(res.status).toBe(403);
  });
});
