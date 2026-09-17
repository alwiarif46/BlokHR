import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import pino from 'pino';
import request from 'supertest';
import type { Express } from 'express';
import { SqliteEngine } from '../../src/db/sqlite-engine';
import { MigrationRunner } from '../../src/db/migration-runner';
import { wipeAllTenantOrgData, WIPE_KV_KEY } from '../../src/db/wipe-tenant-org-data';
import { createTestApp } from '../helpers/setup';
import type { DatabaseEngine } from '../../src/db/engine';

describe('Migration 063 — wipe all tenants', () => {
  let engine: SqliteEngine;

  beforeEach(async () => {
    engine = new SqliteEngine(':memory:');
    await engine.initialize();
    const migDir = path.resolve(__dirname, '../../migrations');
    const runner = new MigrationRunner(engine, migDir, pino({ level: 'silent' }));
    await runner.run();
  });

  afterEach(async () => {
    await engine.close();
  });

  it('empties org data and leaves only empty default branding', async () => {
    await engine.run(
      `UPDATE branding SET company_name = 'Hanfia', setup_complete = 1 WHERE tenant_id = 'default'`,
    );
    await engine.run(
      `INSERT OR IGNORE INTO branding (tenant_id, company_name, setup_complete) VALUES ('si', 'SI', 1)`,
    );
    await engine.run(
      `INSERT OR IGNORE INTO members (tenant_id, id, email, name, role, active)
       VALUES ('default', 'm1', 'a@x.test', 'A', 'admin', 1)`,
    );

    // Simulate pending flag from 063
    await engine.run(
      `INSERT OR REPLACE INTO kv_store (key, value_json) VALUES ('pending_full_tenant_wipe', '"1"')`,
    );
    // Clear wipe kv so wipe runs (fresh DB may already have wiped via createDatabase path — here we call directly)
    await engine.run(`DELETE FROM kv_store WHERE key = ?`, [WIPE_KV_KEY]);

    const result = await wipeAllTenantOrgData(engine, pino({ level: 'silent' }));
    expect(result.wiped).toBe(true);

    const branding = await engine.all<{ tenant_id: string; company_name: string; setup_complete: number }>(
      'SELECT tenant_id, company_name, setup_complete FROM branding ORDER BY tenant_id',
    );
    expect(branding).toHaveLength(1);
    expect(branding[0].tenant_id).toBe('default');
    expect(branding[0].setup_complete).toBe(0);
    expect(branding[0].company_name || '').toBe('');

    const members = await engine.all('SELECT * FROM members');
    expect(members).toHaveLength(0);

    const again = await wipeAllTenantOrgData(engine, pino({ level: 'silent' }));
    expect(again.wiped).toBe(false);
  });
});

describe('Setup already_configured guard', () => {
  const HOST_MAP = JSON.stringify({
    'tenant-a.test': 'tenant-a',
    'tenant-b.test': 'tenant-b',
  });

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
    await request(app).post('/api/setup/step1').set('Host', host).send({ companyName: company });
    await request(app).post('/api/setup/step2').set('Host', host).send({ authLocalEnabled: true });
    const step3 = await request(app)
      .post('/api/setup/step3')
      .set('Host', host)
      .send({ adminEmail, vertical: 'hr' });
    expect(step3.status).toBe(200);
  }

  it('returns 409 when setup POST runs after setupComplete on same Host', async () => {
    await completeSetup('tenant-a.test', 'Alpha Co', 'admin@alpha.test');

    const again = await request(app)
      .post('/api/setup/step1')
      .set('Host', 'tenant-a.test')
      .send({ companyName: 'Hijack Co' });
    expect(again.status).toBe(409);
    expect(again.body.error || again.body.message || '').toMatch(/already_configured/i);

    const statusB = await request(app).get('/api/setup/status').set('Host', 'tenant-b.test');
    expect(statusB.body.setupComplete).toBe(false);
  });

  it('keeps attendance rosters isolated across two Hosts', async () => {
    await completeSetup('tenant-a.test', 'Alpha Co', 'admin@alpha.test');
    await completeSetup('tenant-b.test', 'Beta Co', 'admin@beta.test');

    const today = new Date().toISOString().slice(0, 10);
    const boardA = await request(app)
      .get(`/api/attendance?date=${today}`)
      .set('Host', 'tenant-a.test');
    const boardB = await request(app)
      .get(`/api/attendance?date=${today}`)
      .set('Host', 'tenant-b.test');

    const emailsA = (boardA.body.people || []).map((p: { email: string }) => p.email);
    const emailsB = (boardB.body.people || []).map((p: { email: string }) => p.email);
    expect(emailsA).toContain('admin@alpha.test');
    expect(emailsA).not.toContain('admin@beta.test');
    expect(emailsB).toContain('admin@beta.test');
    expect(emailsB).not.toContain('admin@alpha.test');
  });
});
