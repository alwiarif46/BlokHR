/**
 * End-to-end two-tenant isolation: logical (path/header) + physical (TENANT_DB_SPLIT).
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import path from 'path';
import fs from 'fs';
import os from 'os';
import pino from 'pino';
import { createDirectoryApp } from '../src/index';
import {
  resolveTenantDbPath,
  isTenantDbSplitEnabled,
  getTenantDataRoot,
} from '../src/tenant-db';
import { staff } from './helpers/auth';

const logger = pino({ level: 'silent' });

describe('directory tenant db helpers', () => {
  it('resolves legacy path when split is off', () => {
    const p = resolveTenantDbPath({
      tenantId: 'si',
      serviceFile: 'directory.db',
      legacyPath: '/tmp/legacy.db',
      env: {},
    });
    expect(p).toBe('/tmp/legacy.db');
    expect(isTenantDbSplitEnabled({})).toBe(false);
  });

  it('resolves under TENANT_DATA_ROOT when split is on', () => {
    const root = path.join(os.tmpdir(), `blokhr-tenants-${Date.now()}`);
    const p = resolveTenantDbPath({
      tenantId: 'si',
      serviceFile: 'directory.db',
      legacyPath: '/tmp/legacy.db',
      env: { TENANT_DB_SPLIT: '1', TENANT_DATA_ROOT: root },
    });
    expect(p).toBe(path.join(root, 'si', 'directory.db'));
    expect(fs.existsSync(path.join(root, 'si'))).toBe(true);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('rejects unsafe tenant ids', () => {
    expect(() =>
      resolveTenantDbPath({
        tenantId: '../etc',
        serviceFile: 'directory.db',
        legacyPath: '/tmp/x.db',
        env: { TENANT_DB_SPLIT: '1', TENANT_DATA_ROOT: os.tmpdir() },
      }),
    ).toThrow(/invalid_tenant_id/);
  });

  it('defaults getTenantDataRoot', () => {
    expect(getTenantDataRoot({})).toMatch(/data[/\\]tenants$/);
  });
});

describe('directory two-tenant physical isolation', () => {
  const root = path.join(os.tmpdir(), `blokhr-dir-iso-${Date.now()}`);
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

  it('keeps members in separate tenant DB files', async () => {
    const migrationsDir = path.resolve(__dirname, '..', 'migrations');
    const created = await createDirectoryApp({
      dbPath: path.join(root, '_fallback.db'),
      migrationsDir,
      logger,
      tenantId: 'tenant-a',
    });
    closeFn = created.close;

    const addA = await request(created.app)
      .post('/api/directory/members')
      .set(staff('admin', undefined))
      .set('X-Blok-Tenant', 'tenant-a')
      .send({
        email: 'a@tenant-a.test',
        name: 'Alice A',
        temporaryPassword: 'TempPass1',
      });
    expect(addA.status).toBe(201);

    const listA = await request(created.app)
      .get('/api/directory/members')
      .set(staff('admin'))
      .set('X-Blok-Tenant', 'tenant-a');
    expect(listA.status).toBe(200);
    const emailsA = (listA.body.members || [])
      .map((m: { email?: string }) => m.email)
      .filter(Boolean);
    expect(emailsA).toContain('a@tenant-a.test');

    const listB = await request(created.app)
      .get('/api/directory/members')
      .set(staff('admin'))
      .set('X-Blok-Tenant', 'tenant-b');
    expect(listB.status).toBe(200);
    const emailsB = (listB.body.members || [])
      .map((m: { email?: string }) => m.email)
      .filter(Boolean);
    expect(emailsB).not.toContain('a@tenant-a.test');

    expect(fs.existsSync(path.join(root, 'tenant-a', 'directory.db'))).toBe(true);
  });
});
