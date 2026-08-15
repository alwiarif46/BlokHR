import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createConsentApp } from '../src/index';
import type { ConsentSqlite } from '../src/db';

const logger = pino({ level: 'silent' });

describe('@blokhr/consent', () => {
  let app: Express;
  let db: ConsentSqlite;

  beforeEach(async () => {
    const created = await createConsentApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger,
      tenantId: 'default',
      routerOptions: { isAdmin: async (e) => e === 'admin@acme.com' },
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('creates staff biometric consent with alternative acknowledgement', async () => {
    const res = await request(app)
      .post('/api/consent/consents')
      .send({
        subject_ref: 'mem_1',
        subject_type: 'staff',
        modality: 'fingerprint',
        alternative_acknowledged: true,
      })
      .set('X-User-Email', 'admin@acme.com');
    expect(res.status).toBe(200);
    expect(res.body.consent.id).toMatch(/^cns_/);
  });

  it('rejects student face without guardian and DPIA', async () => {
    const res = await request(app)
      .post('/api/consent/consents')
      .send({
        subject_ref: 'stu_1',
        subject_type: 'student',
        modality: 'face',
        alternative_acknowledged: true,
      })
      .set('X-User-Email', 'admin@acme.com');
    expect(res.status).toBe(400);
  });

  it('validates active consent', async () => {
    const created = await request(app)
      .post('/api/consent/consents')
      .send({
        subject_ref: 'mem_1',
        subject_type: 'staff',
        modality: 'face',
        alternative_acknowledged: true,
      })
      .set('X-User-Email', 'admin@acme.com');
    const id = created.body.consent.id as string;
    const ok = await request(app).get(`/api/consent/consents/${id}/validate?modality=face`);
    expect(ok.body.valid).toBe(true);
  });

  it('rejects student fingerprint without guardian and DPIA', async () => {
    const res = await request(app)
      .post('/api/consent/consents')
      .send({
        subject_ref: 'stu_1',
        subject_type: 'student',
        modality: 'fingerprint',
        alternative_acknowledged: true,
      })
      .set('X-User-Email', 'admin@acme.com');
    expect(res.status).toBe(400);
  });

  it('creates student fingerprint consent with guardian and DPIA', async () => {
    const res = await request(app)
      .post('/api/consent/consents')
      .send({
        subject_ref: 'stu_1',
        subject_type: 'student',
        modality: 'fingerprint',
        alternative_acknowledged: true,
        guardian_ref: 'guard_1',
        dpia_ref: 'dpia_1',
      })
      .set('X-User-Email', 'admin@acme.com');
    expect(res.status).toBe(200);
    expect(res.body.consent.id).toMatch(/^cns_/);
  });
});
