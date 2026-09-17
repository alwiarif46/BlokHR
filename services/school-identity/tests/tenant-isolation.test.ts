/**
 * school-identity physical tenant DB isolation when TENANT_DB_SPLIT=1.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pino from 'pino';
import { createSchoolIdentityApp } from '../src/index';
import { asRole } from '../src/role-guard';
import {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
} from '../src/tenant-db';

describe('school-identity tenant db helpers', () => {
  it('legacy path when split off', () => {
    expect(
      resolveTenantDbPath({
        tenantId: 'a',
        serviceFile: 'school-identity.db',
        legacyPath: '/data/identity.db',
        env: {},
      }),
    ).toBe('/data/identity.db');
    expect(isTenantDbSplitEnabled({})).toBe(false);
  });
});

describe('school-identity two-tenant physical isolation', () => {
  const root = path.join(os.tmpdir(), `blokhr-id-iso-${Date.now()}`);
  let prevSplit: string | undefined;
  let prevRoot: string | undefined;
  let closeFn: (() => Promise<void>) | undefined;

  beforeEach(() => {
    prevSplit = process.env.TENANT_DB_SPLIT;
    prevRoot = process.env.TENANT_DATA_ROOT;
    process.env.TENANT_DB_SPLIT = '1';
    process.env.TENANT_DATA_ROOT = root;
    fs.mkdirSync(root, { recursive: true });
  });

  afterEach(async () => {
    if (closeFn) await closeFn();
    closeFn = undefined;
    if (prevSplit === undefined) delete process.env.TENANT_DB_SPLIT;
    else process.env.TENANT_DB_SPLIT = prevSplit;
    if (prevRoot === undefined) delete process.env.TENANT_DATA_ROOT;
    else process.env.TENANT_DATA_ROOT = prevRoot;
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('does not leak students across tenant DB files', async () => {
    const created = await createSchoolIdentityApp({
      dbPath: path.join(root, '_fallback.db'),
      migrationsDir: path.resolve(__dirname, '..', 'migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: 'test-internal-secret',
    });
    closeFn = created.close;

    const headersA = {
      ...asRole('admin', { secret: 'test-internal-secret', tenantId: 'tenant-a' }),
    };
    const headersB = {
      ...asRole('admin', { secret: 'test-internal-secret', tenantId: 'tenant-b' }),
    };

    const create = await request(created.app)
      .post('/api/identity/tenant-a/students')
      .set(headersA)
      .send({
        admission_number: 'A-1',
        first_name: 'Ada',
        last_name: 'Alpha',
        dob: '2015-06-15',
        gender: 'female',
        admission_date: '2025-04-01',
        status: 'active',
        category: 'GEN',
        mother_name: 'Meera',
        father_name: 'Ravi',
        guardian_contact: '9876543210',
        aadhaar_last4: '1234',
      });
    expect(create.status).toBe(201);

    const listA = await request(created.app)
      .get('/api/identity/tenant-a/students')
      .set(headersA);
    expect(listA.status).toBe(200);
    const namesA = JSON.stringify(listA.body);
    expect(namesA).toMatch(/Ada|A-1/);

    const listB = await request(created.app)
      .get('/api/identity/tenant-b/students')
      .set(headersB);
    expect(listB.status).toBe(200);
    const namesB = JSON.stringify(listB.body);
    expect(namesB).not.toMatch(/Ada/);

    expect(fs.existsSync(path.join(root, 'tenant-a', 'school-identity.db'))).toBe(
      true,
    );
  });
});
