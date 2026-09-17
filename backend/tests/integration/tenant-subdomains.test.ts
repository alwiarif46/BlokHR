import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { createTestApp } from '../helpers/setup';
import type { DatabaseEngine } from '../../src/db/engine';

describe('Self-serve tenant subdomains', () => {
  const SUBDOMAIN_BASE = '13blok.com';
  const APEX = 'www.13blok.com';

  let app: Express;
  let db: DatabaseEngine;
  let commercial: Awaited<ReturnType<typeof createTestApp>>['commercial'];
  let directory: Awaited<ReturnType<typeof createTestApp>>['directory'];

  beforeEach(async () => {
    const setup = await createTestApp({
      tenantSubdomainBase: SUBDOMAIN_BASE,
      tenantApexHosts: `${APEX},13blok.com`,
      tenantHostMap: JSON.stringify({
        'blokhr.vercel.app': 'default',
      }),
    });
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

  it('resolves acme.13blok.com to tenant acme via Host', async () => {
    const res = await request(app)
      .get('/api/setup/status')
      .set('Host', 'acme.13blok.com');
    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe('acme');
    expect(res.body.signupPortal).toBe(false);
  });

  it('marks apex Host as signupPortal and blocks setup POSTs', async () => {
    const status = await request(app).get('/api/setup/status').set('Host', APEX);
    expect(status.status).toBe(200);
    expect(status.body.signupPortal).toBe(true);
    expect(status.body.subdomainBase).toBe(SUBDOMAIN_BASE);

    const step1 = await request(app)
      .post('/api/setup/step1')
      .set('Host', APEX)
      .send({ companyName: 'Should Fail' });
    expect(step1.status).toBe(400);
    expect(step1.body.error).toBe('use_workspace_subdomain');
  });

  it('claims two slugs and isolates setup across subdomains', async () => {
    const a = await request(app).post('/api/tenants').send({ slug: 'alpha-co' });
    expect(a.status).toBe(201);
    expect(a.body.tenantId).toBe('alpha-co');
    expect(a.body.workspaceUrl).toContain('alpha-co.13blok.com');

    const b = await request(app).post('/api/tenants').send({ slug: 'beta-co' });
    expect(b.status).toBe(201);
    expect(b.body.tenantId).toBe('beta-co');

    await request(app)
      .post('/api/setup/step1')
      .set('Host', 'alpha-co.13blok.com')
      .send({ companyName: 'Alpha Co' });
    await request(app)
      .post('/api/setup/step2')
      .set('Host', 'alpha-co.13blok.com')
      .send({ authLocalEnabled: true });
    const a3 = await request(app)
      .post('/api/setup/step3')
      .set('Host', 'alpha-co.13blok.com')
      .send({ adminEmail: 'admin@alpha.test', vertical: 'hr' });
    expect(a3.status).toBe(200);

    await request(app)
      .post('/api/setup/step1')
      .set('Host', 'beta-co.13blok.com')
      .send({ companyName: 'Beta Co' });
    await request(app)
      .post('/api/setup/step2')
      .set('Host', 'beta-co.13blok.com')
      .send({ authLocalEnabled: true });
    const b3 = await request(app)
      .post('/api/setup/step3')
      .set('Host', 'beta-co.13blok.com')
      .send({ adminEmail: 'admin@beta.test', vertical: 'hr' });
    expect(b3.status).toBe(200);

    const today = new Date().toISOString().slice(0, 10);
    const boardA = await request(app)
      .get(`/api/attendance?date=${today}`)
      .set('Host', 'alpha-co.13blok.com');
    const boardB = await request(app)
      .get(`/api/attendance?date=${today}`)
      .set('Host', 'beta-co.13blok.com');
    const emailsA = (boardA.body.people || []).map((p: { email: string }) => p.email);
    const emailsB = (boardB.body.people || []).map((p: { email: string }) => p.email);
    expect(emailsA).toContain('admin@alpha.test');
    expect(emailsA).not.toContain('admin@beta.test');
    expect(emailsB).toContain('admin@beta.test');
    expect(emailsB).not.toContain('admin@alpha.test');
  });

  it('returns 409 slug_taken for existing branding tenant', async () => {
    await db.run(
      `INSERT OR IGNORE INTO branding (tenant_id, company_name, setup_complete)
       VALUES ('hanfia', 'Hanfia High School', 1)`,
    );
    const res = await request(app).post('/api/tenants').send({ slug: 'hanfia' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('slug_taken');
    const row = await db.get<{ company_name: string }>(
      'SELECT company_name FROM branding WHERE tenant_id = ?',
      ['hanfia'],
    );
    expect(row?.company_name).toBe('Hanfia High School');
  });

  it('returns 409 on concurrent claim of the same slug (second loses)', async () => {
    const [r1, r2] = await Promise.all([
      request(app).post('/api/tenants').send({ slug: 'race-co' }),
      request(app).post('/api/tenants').send({ slug: 'race-co' }),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([201, 409]);
    const winners = [r1, r2].filter((r) => r.status === 201);
    expect(winners).toHaveLength(1);
    expect(winners[0].body.tenantId).toBe('race-co');
  });

  it('still returns 409 already_configured after setup on a slug', async () => {
    await request(app).post('/api/tenants').send({ slug: 'done-co' });
    await request(app)
      .post('/api/setup/step1')
      .set('Host', 'done-co.13blok.com')
      .send({ companyName: 'Done Co' });
    await request(app)
      .post('/api/setup/step2')
      .set('Host', 'done-co.13blok.com')
      .send({ authLocalEnabled: true });
    await request(app)
      .post('/api/setup/step3')
      .set('Host', 'done-co.13blok.com')
      .send({ adminEmail: 'admin@done.test', vertical: 'hr' });

    const again = await request(app)
      .post('/api/setup/step1')
      .set('Host', 'done-co.13blok.com')
      .send({ companyName: 'Hijack' });
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('already_configured');
  });

  it('GET check reports available / taken / incomplete', async () => {
    const open = await request(app).get('/api/tenants/check/fresh-co');
    expect(open.status).toBe(200);
    expect(open.body.status).toBe('available');

    await request(app).post('/api/tenants').send({ slug: 'fresh-co' });
    const mid = await request(app).get('/api/tenants/check/fresh-co');
    expect(mid.body.status).toBe('incomplete');

    await request(app)
      .post('/api/setup/step1')
      .set('Host', 'fresh-co.13blok.com')
      .send({ companyName: 'Fresh' });
    await request(app)
      .post('/api/setup/step2')
      .set('Host', 'fresh-co.13blok.com')
      .send({ authLocalEnabled: true });
    await request(app)
      .post('/api/setup/step3')
      .set('Host', 'fresh-co.13blok.com')
      .send({ adminEmail: 'a@fresh.test', vertical: 'hr' });

    const done = await request(app).get('/api/tenants/check/fresh-co');
    expect(done.body.status).toBe('taken');
  });
});
