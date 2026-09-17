import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';

const HOST_MAP = JSON.stringify({
  'tenant-a.test': 'tenant-a',
  'tenant-b.test': 'tenant-b',
});

describe('Tenant isolation (setup + members)', () => {
  let app: Express;
  let db: DatabaseEngine;
  let commercial: Awaited<ReturnType<typeof createTestApp>>['commercial'];
  let directory: Awaited<ReturnType<typeof createTestApp>>['directory'];

  beforeEach(async () => {
    const setup = await createTestApp({ tenantHostMap: HOST_MAP });
    app = setup.app;
    db = setup.db;
    commercial = setup.commercial;
    directory = setup.directory;
  });

  afterEach(async () => {
    if (commercial) await commercial.close();
    if (directory) await directory.close();
    if (db) await db.close();
  });

  async function completeSetup(host: string, company: string, adminEmail: string) {
    await request(app)
      .post('/api/setup/step1')
      .set('Host', host)
      .send({ companyName: company });
    await request(app)
      .post('/api/setup/step2')
      .set('Host', host)
      .send({ authLocalEnabled: true });
    const step3 = await request(app)
      .post('/api/setup/step3')
      .set('Host', host)
      .send({ adminEmail, vertical: 'hr' });
    expect(step3.status).toBe(200);
    expect(step3.body.success).toBe(true);
  }

  it('keeps setupComplete isolated across Host-mapped tenants', async () => {
    const beforeB = await request(app).get('/api/setup/status').set('Host', 'tenant-b.test');
    expect(beforeB.status).toBe(200);
    expect(beforeB.body.setupComplete).toBe(false);
    expect(beforeB.body.tenantId).toBe('tenant-b');

    await completeSetup('tenant-a.test', 'Alpha Co', 'admin@alpha.test');

    const afterA = await request(app).get('/api/setup/status').set('Host', 'tenant-a.test');
    expect(afterA.body.setupComplete).toBe(true);
    expect(afterA.body.tenantId).toBe('tenant-a');
    expect(afterA.body.branding.companyName).toBe('Alpha Co');

    const afterB = await request(app).get('/api/setup/status').set('Host', 'tenant-b.test');
    expect(afterB.body.setupComplete).toBe(false);
    expect(afterB.body.tenantId).toBe('tenant-b');
    expect(afterB.body.branding.companyName || '').toBe('');
  });

  it('does not leak directory members across tenants', async () => {
    await completeSetup('tenant-a.test', 'Alpha Co', 'admin@alpha.test');
    await completeSetup('tenant-b.test', 'Beta Co', 'admin@beta.test');

    const membersA = await directory.service.listMembers('tenant-a');
    const membersB = await directory.service.listMembers('tenant-b');
    const emailsA = membersA.map((m) => m.email);
    const emailsB = membersB.map((m) => m.email);

    expect(emailsA).toContain('admin@alpha.test');
    expect(emailsA).not.toContain('admin@beta.test');
    expect(emailsB).toContain('admin@beta.test');
    expect(emailsB).not.toContain('admin@alpha.test');
  });

  it('does not leak attendance team roster across Host tenants', async () => {
    await completeSetup('tenant-a.test', 'Alpha Co', 'admin@alpha.test');
    await completeSetup('tenant-b.test', 'Beta Co', 'admin@beta.test');

    const today = new Date().toISOString().slice(0, 10);
    const boardA = await request(app)
      .get(`/api/attendance?date=${today}`)
      .set('Host', 'tenant-a.test');
    const boardB = await request(app)
      .get(`/api/attendance?date=${today}`)
      .set('Host', 'tenant-b.test');

    expect(boardA.status).toBe(200);
    expect(boardB.status).toBe(200);

    const emailsA = (boardA.body.people || []).map((p: { email: string }) => p.email);
    const emailsB = (boardB.body.people || []).map((p: { email: string }) => p.email);

    expect(emailsA).toContain('admin@alpha.test');
    expect(emailsA).not.toContain('admin@beta.test');
    expect(emailsB).toContain('admin@beta.test');
    expect(emailsB).not.toContain('admin@alpha.test');
  });

  it('local DEFAULT_TENANT_ID still boots wizard once', async () => {
    const res = await request(app).get('/api/setup/status');
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('default');
    expect(res.body.setupComplete).toBe(false);
  });
});
