import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolIdentityApp,
  IDENTITY_ROUTE_POLICIES,
  type Role,
} from '../src/index';
import type { SchoolIdentitySqlite } from '../src/db';
import { staff, guardian, SECRET } from './helpers/auth';

function samplePath(pattern: RegExp): string {
  return (
    '/' +
    pattern.source
      .replace(/^\^\\?\//, '')
      .replace(/\/\?\$/, '')
      .replace(/\$/, '')
      .replace(/\\\//g, '/')
      .replace(/\[\^\/\]\+/g, 't1')
      .replace(/\/\?/g, '')
  );
}

describe('school-identity P12-03 role guard', () => {
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

  it('table-driven allow/deny from IDENTITY_ROUTE_POLICIES', async () => {
    const roles: Role[] = [
      'employee',
      'teacher',
      'office',
      'school_admin',
      'admin',
    ];
    for (const policy of IDENTITY_ROUTE_POLICIES) {
      if (policy.internalOnly) continue;
      const url = `/api/identity${samplePath(policy.pattern)}`;
      const method = policy.method.toLowerCase() as
        | 'get'
        | 'post'
        | 'put'
        | 'patch'
        | 'delete';

      for (const role of roles) {
        if (policy.guardianOk && role === 'employee') continue;
        const res = await request(app)[method](url).set(staff(role));
        if (policy.roles.includes(role)) {
          expect(res.status, `${method} ${url} role=${role}`).not.toBe(403);
          expect(res.body?.error).not.toBe('no_policy');
          expect(res.body?.error).not.toBe('role_denied');
        } else if (!policy.guardianOk) {
          expect(res.status, `${method} ${url} role=${role}`).toBe(403);
          expect(res.body.error).toBe('role_denied');
        }
      }
    }
  });

  it('deny-by-default on unregistered path', async () => {
    const res = await request(app)
      .get('/api/identity/t1/no-such-route')
      .set(staff('admin'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('no_policy');
  });

  it('teacher student GET redacts aadhaarLast4 and guardianContact', async () => {
    await request(app)
      .post('/api/identity/t1/students')
      .set(staff('office'))
      .send({
        admission_number: 'ADM-R',
        first_name: 'R',
        last_name: 'S',
        dob: '2015-01-01',
        gender: 'female',
        admission_date: '2025-04-01',
        status: 'active',
        category: 'GEN',
        mother_name: 'M',
        father_name: 'F',
        guardian_contact: '9876543210',
        aadhaar_last4: '9999',
      });
    const list = await request(app)
      .get('/api/identity/t1/students')
      .set(staff('teacher'));
    expect(list.status).toBe(200);
    expect(list.body.items[0]).not.toHaveProperty('aadhaarLast4');
    expect(list.body.items[0]).not.toHaveProperty('guardianContact');
    expect(list.body.items[0].firstName).toBe('R');

    const id = list.body.items[0].id as string;
    const one = await request(app)
      .get(`/api/identity/t1/students/${id}`)
      .set(staff('teacher'));
    expect(one.body).not.toHaveProperty('aadhaarLast4');
    expect(one.body).not.toHaveProperty('guardianContact');
  });

  it('missing internal secret → 401; role without principal → 403', async () => {
    const noSecret = await request(app).get('/api/identity/t1/sessions');
    expect(noSecret.status).toBe(401);

    const forged = await request(app)
      .get('/api/identity/t1/sessions')
      .set('X-Blok-Internal', SECRET)
      .set('X-Blok-Role', 'admin');
    expect(forged.status).toBe(403);
  });

  it('guardian bypass on guardians/:id/students only', async () => {
    const g = await request(app)
      .post('/api/identity/t1/guardians')
      .set(staff('office'))
      .send({
        first_name: 'G',
        last_name: 'P',
        relation: 'mother',
        phone: '9000000001',
      });
    const ok = await request(app)
      .get(`/api/identity/t1/guardians/${g.body.id}/students`)
      .set(guardian(g.body.id));
    expect(ok.status).toBe(200);

    const denied = await request(app)
      .get('/api/identity/t1/students')
      .set(guardian(g.body.id));
    expect(denied.status).toBe(403);
  });

  it('guardian-auth routes stay outside identity role table', async () => {
    const res = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: '1', password: 'x' });
    expect(res.body?.error).not.toBe('no_policy');
    expect(res.body?.error).not.toBe('role_denied');
  });
});
