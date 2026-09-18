import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolIdentityApp,
  type SchoolIdentitySqlite,
} from '../src/index';
import { staff, guardian, SECRET, internalOnly } from './helpers/auth';

function guardianPayload(overrides: Record<string, unknown> = {}) {
  return {
    first_name: 'Meera',
    last_name: 'Rao',
    relation: 'mother',
    phone: '9876543210',
    email: 'meera@example.com',
    preferred_language: 'en',
    ...overrides,
  };
}

describe('school-identity family hub (invitations, OTP, profile, section)', () => {
  let app: Express;
  let db: SchoolIdentitySqlite;
  let nowMs: number;

  beforeEach(async () => {
    nowMs = Date.parse('2026-03-01T12:00:00.000Z');
    const created = await createSchoolIdentityApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      clock: () => new Date(nowMs),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  async function createGuardian(
    tenant: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app)
      .post(`/api/identity/${tenant}/guardians`)
      .set(staff('admin'))
      .send(guardianPayload(overrides));
    expect(res.status).toBe(201);
    return res.body as { id: string; phone: string };
  }

  it('creates invitation and claims with password', async () => {
    const g = await createGuardian('t1', { phone: '9111111111' });
    const invite = await request(app)
      .post(`/api/identity/t1/guardians/${g.id}/invitations`)
      .set(staff('admin'))
      .send({ invited_by: 'admin-1' });
    expect(invite.status).toBe(201);
    expect(invite.body.claim_token || invite.body.claimToken).toBeTruthy();

    const claimToken = invite.body.claim_token || invite.body.claimToken;
    const claim = await request(app)
      .post('/api/identity/guardian-auth/claim')
      .send({
        claim_token: claimToken,
        password: 'secret123',
      });
    expect(claim.status).toBe(200);
    expect(claim.body.token).toMatch(/^[a-f0-9]{96}$/);
    expect(claim.body.tenant_id).toBe('t1');
    expect(claim.body.guardian_id).toBe(g.id);
  });

  it('OTP request/verify for password reset', async () => {
    const g = await createGuardian('t1', { phone: '9222222222' });
    await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({ tenant_id: 't1', guardian_id: g.id, password: 'oldpass12' });

    const reqOtp = await request(app)
      .post('/api/identity/guardian-auth/otp/request')
      .send({ phone: g.phone, purpose: 'reset', tenant_id: 't1' });
    expect(reqOtp.status).toBe(200);
    expect(reqOtp.body.debug_otp).toMatch(/^\d{6}$/);

    const verify = await request(app)
      .post('/api/identity/guardian-auth/otp/verify')
      .send({
        phone: g.phone,
        purpose: 'reset',
        otp: reqOtp.body.debug_otp,
        new_password: 'newpass99',
        tenant_id: 't1',
      });
    expect(verify.status).toBe(200);

    const login = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: g.phone, password: 'newpass99', tenant_id: 't1' });
    expect(login.status).toBe(200);
  });

  it('ambiguous phone returns tenants; tenant hint resolves login', async () => {
    const a = await createGuardian('t1', { phone: '9333333333' });
    const b = await createGuardian('t2', {
      phone: '9333333333',
      first_name: 'Other',
    });
    await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({ tenant_id: 't1', guardian_id: a.id, password: 'secret123' });
    await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({ tenant_id: 't2', guardian_id: b.id, password: 'secret456' });

    const ambiguous = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: '9333333333', password: 'secret123' });
    expect(ambiguous.status).toBe(409);
    expect(ambiguous.body.error).toBe('ambiguous_phone');
    expect(ambiguous.body.tenants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ tenantId: 't1' }),
        expect.objectContaining({ tenantId: 't2' }),
      ]),
    );

    const resolved = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({
        phone: '9333333333',
        password: 'secret123',
        tenant_id: 't1',
      });
    expect(resolved.status).toBe(200);
    expect(resolved.body.tenant_id).toBe('t1');
  });

  it('guardian can patch profile preferences', async () => {
    const g = await createGuardian('t1', { phone: '9444444444' });
    const patch = await request(app)
      .patch(`/api/identity/t1/guardians/${g.id}/profile`)
      .set(guardian(g.id))
      .send({
        preferred_language: 'hi',
        timezone: 'Asia/Kolkata',
        accessibility: { large_text: true },
      });
    expect(patch.status).toBe(200);
    expect(patch.body.preferredLanguage || patch.body.preferred_language).toBe(
      'hi',
    );

    const get = await request(app)
      .get(`/api/identity/t1/guardians/${g.id}/profile`)
      .set(guardian(g.id));
    expect(get.status).toBe(200);
    expect(get.body.timezone).toBe('Asia/Kolkata');
  });

  it('persists accessibility.theme on guardian profile round-trip', async () => {
    const g = await createGuardian('t1', { phone: '9666666666' });
    const patch = await request(app)
      .patch(`/api/identity/t1/guardians/${g.id}/profile`)
      .set(guardian(g.id))
      .send({
        accessibility: { large_text: true, theme: 'neural' },
      });
    expect(patch.status).toBe(200);
    expect(patch.body.accessibility).toEqual(
      expect.objectContaining({ large_text: true, theme: 'neural' }),
    );

    const merged = await request(app)
      .patch(`/api/identity/t1/guardians/${g.id}/profile`)
      .set(guardian(g.id))
      .send({
        accessibility: { large_text: true, theme: 'holodeck' },
      });
    expect(merged.status).toBe(200);
    expect(merged.body.accessibility).toEqual(
      expect.objectContaining({ large_text: true, theme: 'holodeck' }),
    );

    const get = await request(app)
      .get(`/api/identity/t1/guardians/${g.id}/profile`)
      .set(guardian(g.id));
    expect(get.status).toBe(200);
    expect(get.body.accessibility).toEqual(
      expect.objectContaining({ large_text: true, theme: 'holodeck' }),
    );
  });

  it('lists guardians for section_ref (internal)', async () => {
    const g = await createGuardian('t1', { phone: '9555555555' });
    const session = await request(app)
      .post('/api/identity/t1/sessions')
      .set(staff('admin'))
      .send({
        label: '2025-26',
        starts_on: '2025-04-01',
        ends_on: '2026-03-31',
        is_current: true,
      });
    expect(session.status).toBe(201);
    const student = await request(app)
      .post('/api/identity/t1/students')
      .set(staff('admin'))
      .send({
        admission_number: 'ADM-FH-1',
        first_name: 'Asha',
        last_name: 'Rao',
        dob: '2015-06-15',
        gender: 'female',
        admission_date: '2025-04-01',
        status: 'active',
        category: 'GEN',
        mother_name: 'Meera',
        father_name: 'Ravi',
        guardian_contact: '9555555555',
      });
    expect(student.status).toBe(201);
    const enrol = await request(app)
      .post(`/api/identity/t1/students/${student.body.id}/enrol`)
      .set(staff('admin'))
      .send({
        academic_session_id: session.body.id,
        class_label: '5',
        section: 'A',
        roll_number: '1',
        enrolled_on: '2025-04-01',
      });
    expect(enrol.status).toBe(201);
    const link = await request(app)
      .post(`/api/identity/t1/students/${student.body.id}/guardians`)
      .set(staff('admin'))
      .send({ guardian_id: g.id, is_primary: true });
    expect(link.status).toBe(201);

    const listed = await request(app)
      .get('/api/identity/t1/internal/sections/5%7CA/guardians')
      .set({ 'X-Blok-Internal': SECRET });
    expect(listed.status).toBe(200);
    expect(listed.body.guardians).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guardianId: g.id,
          studentId: student.body.id,
        }),
      ]),
    );

    const byStudent = await request(app)
      .get(`/api/identity/t1/internal/students/${student.body.id}/guardians`)
      .set({ 'X-Blok-Internal': SECRET });
    expect(byStudent.status).toBe(200);
    expect(byStudent.body.guardians).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          guardianId: g.id,
          studentId: student.body.id,
        }),
      ]),
    );
  });
});
