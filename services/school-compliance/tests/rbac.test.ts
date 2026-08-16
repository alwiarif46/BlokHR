import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolComplianceApp,
  COMPLIANCE_ROUTE_POLICIES,
  type Role,
} from '../src/index';
import { staff, SECRET, internalOnly } from './helpers/auth';

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

describe('school-compliance P12-04 role guard', () => {
  let app: Express;
  let db: { close: () => Promise<void> };

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

  it('table-driven allow/deny', async () => {
    const roles: Role[] = [
      'employee',
      'teacher',
      'office',
      'school_admin',
      'admin',
      'manager',
      'hr',
    ];
    for (const policy of COMPLIANCE_ROUTE_POLICIES) {
      if (policy.internalOnly) continue;
      const url = `/api/compliance${samplePath(policy.pattern)}`;
      const method = policy.method.toLowerCase() as
        | 'get'
        | 'post'
        | 'put'
        | 'patch'
        | 'delete';

      for (const role of roles) {
        if (policy.guardianOk && role === 'employee') continue;
        const headers =
          policy.requireMemberBinding && role === 'teacher'
            ? staff(role, 't1')
            : staff(role);
        const res = await request(app)[method](url).set(headers);
        if (policy.roles.includes(role)) {
          expect(res.body?.error, `${method} ${url} role=${role}`).not.toBe(
            'no_policy',
          );
          // Handler memberId body checks may still 403; middleware must allow.
          if (!(policy.requireMemberBinding && role === 'teacher')) {
            expect(res.status, `${method} ${url} role=${role}`).not.toBe(403);
            expect(res.body?.error).not.toBe('role_denied');
          }
        } else if (!policy.guardianOk) {
          expect(res.status, `${method} ${url} role=${role}`).toBe(403);
          expect(res.body.error).toBe('role_denied');
        }
      }
    }
  });

  it('deny-by-default on unregistered path', async () => {
    const res = await request(app)
      .get('/api/compliance/t1/__no_policy__/deep')
      .set(staff('admin'));
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('no_policy');
  });

  it('missing internal secret → 401', async () => {
    const first = COMPLIANCE_ROUTE_POLICIES.find((p) => !p.internalOnly && p.method === 'GET' && p.roles.length > 0);
    const url = first
      ? `/api/compliance${samplePath(first.pattern)}`
      : '/api/compliance/t1/no-such-route';
    const res = await request(app)
      .get(url)
      .set({
        'X-Blok-Principal': 'staff',
        'X-Blok-Role': 'admin',
        'X-Blok-Email': 'a@t.com',
      });
    expect(res.status).toBe(401);
  });

});
