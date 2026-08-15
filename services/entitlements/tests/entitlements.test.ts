import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import { createEntitlementsApp, LicenseSigner } from '../src/index';
import type { Express } from 'express';
import type { EntitlementsSqlite } from '../src/db';

describe('Entitlements service', () => {
  let app: Express;
  let db: EntitlementsSqlite;
  const secret = 'test-license-signing-secret';

  beforeEach(async () => {
    const created = await createEntitlementsApp({
      dbPath: ':memory:',
      licenseSigningSecret: secret,
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('starts a cloud trial', async () => {
    const res = await request(app).post('/api/entitlements/default/trial').send({});
    expect(res.status).toBe(201);
    expect(res.body.plan).toBe('trial');
    expect(res.body.status).toBe('trialing');
    expect(res.body.channel).toBe('cloud');
    expect(res.body.seatLimit).toBe(25);
    expect(res.body.currency).toBe('INR');
    expect(res.body.trialEndsAt).toBeTruthy();
  });

  it('applies a Razorpay subscription update', async () => {
    await request(app).post('/api/entitlements/default/trial').send({});
    const res = await request(app).put('/api/entitlements/default/subscription').send({
      plan: 'starter',
      status: 'active',
      seatLimit: 50,
      source: 'razorpay',
      renewsAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    });
    expect(res.status).toBe(200);
    expect(res.body.plan).toBe('starter');
    expect(res.body.status).toBe('active');
    expect(res.body.source).toBe('razorpay');
  });

  it('issues and activates a signed enterprise license', async () => {
    const validFrom = new Date(Date.now() - 86400000).toISOString();
    const validTo = new Date(Date.now() + 180 * 86400000).toISOString();
    const issue = await request(app).post('/api/entitlements/licenses/issue').send({
      tenantId: 'acme',
      plan: 'enterprise',
      seatLimit: 500,
      modules: ['attendance', 'leaves', 'analytics'],
      validFrom,
      validTo,
    });
    expect(issue.status).toBe(201);
    expect(issue.body.licenseToken).toContain('.');

    const activate = await request(app)
      .post('/api/entitlements/acme/activate-license')
      .send({ licenseToken: issue.body.licenseToken });
    expect(activate.status).toBe(200);
    expect(activate.body.channel).toBe('self_hosted');
    expect(activate.body.plan).toBe('enterprise');
    expect(activate.body.source).toBe('signed_license');
  });

  it('rejects tampered licenses', async () => {
    const signer = new LicenseSigner(secret);
    const token = signer.sign({
      tenantId: 'acme',
      plan: 'enterprise',
      seatLimit: 100,
      modules: [],
      validFrom: new Date(Date.now() - 86400000).toISOString(),
      validTo: new Date(Date.now() + 86400000).toISOString(),
    });
    const tampered = token.slice(0, -4) + 'xxxx';
    const res = await request(app)
      .post('/api/entitlements/acme/activate-license')
      .send({ licenseToken: tampered });
    expect(res.status).toBe(400);
  });

  it('enforces seat limits', async () => {
    await request(app).post('/api/entitlements/default/trial').send({ seatLimit: 2 });
    const ok = await request(app)
      .post('/api/entitlements/default/check-seats')
      .send({ activeSeats: 2 });
    expect(ok.status).toBe(200);
    expect(ok.body.allowed).toBe(true);

    const over = await request(app)
      .post('/api/entitlements/default/check-seats')
      .send({ activeSeats: 3 });
    expect(over.status).toBe(403);
    expect(over.body.allowed).toBe(false);
  });

  it('checks module access', async () => {
    await request(app).post('/api/entitlements/default/trial').send({});
    const allowed = await request(app)
      .post('/api/entitlements/default/check-module')
      .send({ moduleId: 'attendance' });
    expect(allowed.status).toBe(200);

    const denied = await request(app)
      .post('/api/entitlements/default/check-module')
      .send({ moduleId: 'iris_scan' });
    expect(denied.status).toBe(403);
  });

  it('starts a school trial with school modules and vertical', async () => {
    const res = await request(app)
      .post('/api/entitlements/school-t1/trial')
      .send({ vertical: 'school' });
    expect(res.status).toBe(201);
    expect(res.body.vertical).toBe('school');
    expect(res.body.modules).toEqual([
      'school_identity',
      'school_timetable',
      'school_attendance',
      'school_academics',
      'school_engagement',
    ]);
    expect(res.body.modules).not.toContain('school_biometrics');
    expect(res.body.modules).not.toContain('attendance');

    const attendanceOk = await request(app)
      .post('/api/entitlements/school-t1/check-module')
      .send({ moduleId: 'school_attendance' });
    expect(attendanceOk.status).toBe(200);
    expect(attendanceOk.body.allowed).toBe(true);

    const biometricsDenied = await request(app)
      .post('/api/entitlements/school-t1/check-module')
      .send({ moduleId: 'school_biometrics' });
    expect(biometricsDenied.status).toBe(403);
    expect(biometricsDenied.body.allowed).toBe(false);

    const hrAttendanceDenied = await request(app)
      .post('/api/entitlements/school-t1/check-module')
      .send({ moduleId: 'attendance' });
    expect(hrAttendanceDenied.status).toBe(403);
  });

  it('HR trial unchanged when vertical omitted', async () => {
    const res = await request(app).post('/api/entitlements/hr-t1/trial').send({});
    expect(res.status).toBe(201);
    expect(res.body.vertical).toBe('hr');
    expect(res.body.modules).toContain('attendance');
    expect(res.body.modules).not.toContain('school_identity');
  });
});
