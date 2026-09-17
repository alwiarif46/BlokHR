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

describe('Multi-tenant isolation (three Hosts)', () => {
  const THREE_HOST_MAP = JSON.stringify({
    't1.test': 't1',
    't2.test': 't2',
    't3.test': 't3',
  });

  let app: Express;
  let db: DatabaseEngine;
  let commercial: Awaited<ReturnType<typeof createTestApp>>['commercial'];
  let directory: Awaited<ReturnType<typeof createTestApp>>['directory'];
  let broadcaster: Awaited<ReturnType<typeof createTestApp>>['broadcaster'];

  beforeEach(async () => {
    const setup = await createTestApp({
      tenantHostMap: THREE_HOST_MAP,
      allowHeaderIdentity: false,
    });
    app = setup.app;
    db = setup.db;
    commercial = setup.commercial;
    directory = setup.directory;
    broadcaster = setup.broadcaster;
  });

  afterEach(async () => {
    if (commercial) await commercial.close();
    if (directory) await directory.close();
    if (db) await db.close();
  });

  async function completeSetup(host: string, company: string, adminEmail: string) {
    await request(app).post('/api/setup/step1').set('Host', host).send({ companyName: company });
    await request(app).post('/api/setup/step2').set('Host', host).send({ authLocalEnabled: true });
    const step3 = await request(app)
      .post('/api/setup/step3')
      .set('Host', host)
      .send({ adminEmail, vertical: 'hr' });
    expect(step3.status).toBe(200);
  }

  async function login(host: string, email: string, password = 'admin'): Promise<string> {
    const res = await request(app)
      .post('/api/auth/local')
      .set('Host', host)
      .send({ email, password });
    expect(res.status).toBe(200);
    expect(res.body.sessionToken).toBeTruthy();
    return res.body.sessionToken as string;
  }

  it('rejects spoofed X-Blok-Tenant on direct backend without internal secret', async () => {
    await completeSetup('t1.test', 'One Co', 'admin@t1.test');
    await completeSetup('t2.test', 'Two Co', 'admin@t2.test');

    // Without Host map match and without X-Blok-Internal, client cannot force t2 via header
    const spoof = await request(app)
      .get('/api/setup/status')
      .set('X-Blok-Tenant', 't2')
      .set('Host', 'unknown.host');
    expect(spoof.status).toBe(200);
    expect(spoof.body.tenantId).toBe('default');
    expect(spoof.body.setupComplete).toBe(false);
  });

  it('rejects Bearer session from t1 when used on t2 Host', async () => {
    await completeSetup('t1.test', 'One Co', 'admin@t1.test');
    await completeSetup('t2.test', 'Two Co', 'admin@t2.test');

    const tokenT1 = await login('t1.test', 'admin@t1.test');

    const cross = await request(app)
      .get('/api/user-roles?email=admin@t1.test')
      .set('Host', 't2.test')
      .set('Authorization', `Bearer ${tokenT1}`);
    expect(cross.status).toBe(403);
    expect(cross.body.error).toBe('tenant_mismatch');
  });

  it('scheduler absence marking stays per-tenant across three tenants', async () => {
    const { SchedulerService } = await import('../../src/scheduler/scheduler-service');
    const { ClockRepository } = await import('../../src/repositories/clock-repository');
    const { runWithTenant } = await import('../../src/tenant/context');
    const { testLogger } = await import('../helpers/setup');

    await completeSetup('t1.test', 'One Co', 'admin@t1.test');
    await completeSetup('t2.test', 'Two Co', 'admin@t2.test');
    await completeSetup('t3.test', 'Three Co', 'admin@t3.test');

    // Ensure branding registry has all three (setup creates branding rows)
    const tenants = await db.all<{ tenant_id: string }>(
      "SELECT tenant_id FROM branding WHERE tenant_id IN ('t1','t2','t3') ORDER BY tenant_id",
    );
    expect(tenants.map((t) => t.tenant_id)).toEqual(['t1', 't2', 't3']);

    const clockRepo = new ClockRepository(db);
    const service = new SchedulerService(db, clockRepo, null, testLogger);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    for (const tid of ['t1', 't2', 't3']) {
      await runWithTenant(tid, async () => {
        await service.markAbsences(yesterday);
      });
    }

    for (const tid of ['t1', 't2', 't3']) {
      const rows = await db.all<{ email: string; tenant_id: string }>(
        'SELECT email, tenant_id FROM attendance_daily WHERE tenant_id = ? AND date = ?',
        [tid, yesterday],
      );
      expect(rows.every((r) => r.tenant_id === tid)).toBe(true);
      expect(rows.some((r) => r.email === `admin@${tid}.test`)).toBe(true);
    }

    // No cross-tenant rows for shared email patterns
    const leaked = await db.all(
      `SELECT * FROM attendance_daily WHERE tenant_id = 't1' AND email = 'admin@t2.test'`,
    );
    expect(leaked).toHaveLength(0);
  });

  it('SSE broadcast delivers only to same-tenant clients', async () => {
    const { PassThrough } = await import('stream');
    const { runWithTenant } = await import('../../src/tenant/context');

    const chunks: Record<string, string[]> = { t1: [], t2: [], t3: [] };

    function fakeRes(tid: string) {
      const stream = new PassThrough();
      const written: string[] = [];
      const res = {
        writeHead: () => undefined,
        write: (chunk: string) => {
          written.push(String(chunk));
          chunks[tid].push(String(chunk));
          return true;
        },
        end: () => undefined,
        on: (ev: string, cb: () => void) => {
          if (ev === 'close') stream.on('close', cb);
          return res;
        },
      } as unknown as import('express').Response;
      return { res, written };
    }

    broadcaster.addClient(fakeRes('t1').res, 't1');
    broadcaster.addClient(fakeRes('t2').res, 't2');
    broadcaster.addClient(fakeRes('t3').res, 't3');

    runWithTenant('t2', () => {
      broadcaster.broadcast('attendance-update', { ping: true });
    });

    expect(chunks.t2.some((c) => c.includes('attendance-update'))).toBe(true);
    expect(chunks.t1.some((c) => c.includes('attendance-update'))).toBe(false);
    expect(chunks.t3.some((c) => c.includes('attendance-update'))).toBe(false);
  });
});
