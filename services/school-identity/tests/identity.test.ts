import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolIdentityApp } from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';
import type { SchoolIdentitySqlite } from '../src/db';

describe('school-identity', () => {
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

  it('health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it('creates and lists academic sessions', async () => {
    const created = await request(app).post('/api/identity/t1/sessions').set(staff('school_admin')).send({
      label: '2025-26',
      starts_on: '2025-04-01',
      ends_on: '2026-03-31',
      is_current: true,
    });
    expect(created.status).toBe(201);
    expect(created.body.label).toBe('2025-26');
    expect(created.body.isCurrent).toBe(true);
    expect(created.body.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const list = await request(app).get('/api/identity/t1/sessions').set(staff('admin'));
    expect(list.status).toBe(200);
    expect(list.body.sessions).toHaveLength(1);
    expect(list.body.sessions[0].label).toBe('2025-26');
  });

  it('enforces is_current exclusivity per tenant', async () => {
    await request(app).post('/api/identity/t1/sessions').set(staff('school_admin')).send({
      label: 'Old',
      starts_on: '2024-04-01',
      ends_on: '2025-03-31',
      is_current: true,
    });
    await request(app).post('/api/identity/t1/sessions').set(staff('school_admin')).send({
      label: 'New',
      starts_on: '2025-04-01',
      ends_on: '2026-03-31',
      is_current: true,
    });
    const list = await request(app).get('/api/identity/t1/sessions').set(staff('admin'));
    const current = list.body.sessions.filter((s: { isCurrent: boolean }) => s.isCurrent);
    expect(current).toHaveLength(1);
    expect(current[0].label).toBe('New');
  });

  it('rejects invalid dates with 400', async () => {
    const badIso = await request(app).post('/api/identity/t1/sessions').set(staff('school_admin')).send({
      label: 'X',
      starts_on: '01-04-2025',
      ends_on: '2026-03-31',
    });
    expect(badIso.status).toBe(400);

    const order = await request(app).post('/api/identity/t1/sessions').set(staff('school_admin')).send({
      label: 'X',
      starts_on: '2026-04-01',
      ends_on: '2025-03-31',
    });
    expect(order.status).toBe(400);
    expect(order.body.error).toMatch(/ends_on/i);
  });

  it('isolates tenants', async () => {
    await request(app).post('/api/identity/tenant-a/sessions').set(staff('school_admin')).send({
      label: 'A-only',
      starts_on: '2025-04-01',
      ends_on: '2026-03-31',
    });
    const b = await request(app).get('/api/identity/tenant-b/sessions').set(staff('admin'));
    expect(b.status).toBe(200);
    expect(b.body.sessions).toHaveLength(0);

    const a = await request(app).get('/api/identity/tenant-a/sessions').set(staff('admin'));
    expect(a.body.sessions).toHaveLength(1);
  });

  it('applies students migration on fresh memory db', async () => {
    const row = await db.get<{ c: number }>('SELECT count(*) as c FROM students');
    expect(row?.c).toBe(0);
  });
});
