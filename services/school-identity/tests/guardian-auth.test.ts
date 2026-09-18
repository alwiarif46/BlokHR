import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import {
  createSchoolIdentityApp,
  hashToken,
  LOCKOUT_ATTEMPTS,
  type GuardianAuthRepository,
  type SchoolIdentitySqlite,
} from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';

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

describe('school-identity guardian-auth (P9-01)', () => {
  let app: Express;
  let db: SchoolIdentitySqlite;
  let authRepo: GuardianAuthRepository;
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
    authRepo = created.guardianAuthRepo;
  });

  afterEach(async () => {
    await db.close();
  });

  async function createGuardian(
    tenant: string,
    overrides: Record<string, unknown> = {},
  ) {
    const res = await request(app)
      .post(`/api/identity/${tenant}/guardians`).set(staff('admin'))
      .send(guardianPayload(overrides));
    expect(res.status).toBe(201);
    return res.body as { id: string; phone: string };
  }

  it('rejects set-password without internal secret', async () => {
    const g = await createGuardian('t1');
    const set = await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .send({
        tenant_id: 't1',
        guardian_id: g.id,
        password: 'secret123',
      });
    expect(set.status).toBe(401);
  });

  it('set-password + login happy path; raw token not stored', async () => {
    const g = await createGuardian('t1');
    const set = await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({
        tenant_id: 't1',
        guardian_id: g.id,
        password: 'secret123',
      });
    expect(set.status).toBe(200);

    const login = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: g.phone, password: 'secret123', tenant_id: 't1' });
    expect(login.status).toBe(200);
    expect(login.body.token).toMatch(/^[a-f0-9]{96}$/);
    expect(login.body.tenant_id).toBe('t1');
    expect(login.body.guardian_id).toBe(g.id);
    expect(login.body.expires_at).toBeTruthy();

    const hashes = await authRepo.listAllTokenHashes();
    expect(hashes).toHaveLength(1);
    expect(hashes[0]).not.toBe(login.body.token);
    expect(hashes[0]).toBe(hashToken(login.body.token));
  });

  it('wrong password, lockout, unlock after expiry', async () => {
    const g = await createGuardian('t1');
    await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({
        tenant_id: 't1',
        guardian_id: g.id,
        password: 'secret123',
      });

    for (let i = 0; i < LOCKOUT_ATTEMPTS - 1; i++) {
      const bad = await request(app)
        .post('/api/identity/guardian-auth/login')
        .send({ phone: g.phone, password: 'wrongpass', tenant_id: 't1' });
      expect(bad.status).toBe(401);
    }

    const locked = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: g.phone, password: 'wrongpass', tenant_id: 't1' });
    expect(locked.status).toBe(423);

    const stillLocked = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: g.phone, password: 'secret123', tenant_id: 't1' });
    expect(stillLocked.status).toBe(423);

    nowMs += 16 * 60 * 1000;
    const unlocked = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: g.phone, password: 'secret123', tenant_id: 't1' });
    expect(unlocked.status).toBe(200);
    expect(unlocked.body.token).toBeTruthy();
  });

  it('ambiguous phone across tenants → 409', async () => {
    const a = await createGuardian('t1', { phone: '9000000001' });
    const b = await createGuardian('t2', {
      phone: '9000000001',
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

    const login = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: '9000000001', password: 'secret123' });
    expect(login.status).toBe(409);
    expect(login.body.error).toBe('ambiguous_phone');
  });

  it('introspect valid / expired / revoked / unknown', async () => {
    const g = await createGuardian('t1');
    await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({
        tenant_id: 't1',
        guardian_id: g.id,
        password: 'secret123',
      });
    const login = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: g.phone, password: 'secret123', tenant_id: 't1' });
    const token = login.body.token as string;

    const valid = await request(app)
      .post('/api/identity/guardian-auth/introspect')
      .send({ token });
    expect(valid.status).toBe(200);
    expect(valid.body).toEqual({
      active: true,
      tenant_id: 't1',
      guardian_id: g.id,
    });

    const unknown = await request(app)
      .post('/api/identity/guardian-auth/introspect')
      .send({ token: 'a'.repeat(96) });
    expect(unknown.status).toBe(200);
    expect(unknown.body).toEqual({ active: false });

    await request(app)
      .post('/api/identity/guardian-auth/logout')
      .send({ token });
    const revoked = await request(app)
      .post('/api/identity/guardian-auth/introspect')
      .send({ token });
    expect(revoked.body).toEqual({ active: false });

    const login2 = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: g.phone, password: 'secret123', tenant_id: 't1' });
    const token2 = login2.body.token as string;
    nowMs += 31 * 24 * 60 * 60 * 1000;
    const expired = await request(app)
      .post('/api/identity/guardian-auth/introspect')
      .send({ token: token2 });
    expect(expired.body).toEqual({ active: false });
  });

  it('logout revokes session', async () => {
    const g = await createGuardian('t1');
    await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({
        tenant_id: 't1',
        guardian_id: g.id,
        password: 'secret123',
      });
    const login = await request(app)
      .post('/api/identity/guardian-auth/login')
      .send({ phone: g.phone, password: 'secret123', tenant_id: 't1' });
    const token = login.body.token as string;

    const out = await request(app)
      .post('/api/identity/guardian-auth/logout')
      .send({ token });
    expect(out.status).toBe(200);

    const again = await request(app)
      .post('/api/identity/guardian-auth/introspect')
      .send({ token });
    expect(again.body.active).toBe(false);
  });

  it('set-password is tenant-isolated', async () => {
    const g = await createGuardian('t1');
    const cross = await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({
        tenant_id: 't2',
        guardian_id: g.id,
        password: 'secret123',
      });
    expect(cross.status).toBe(404);

    const ok = await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({
        tenant_id: 't1',
        guardian_id: g.id,
        password: 'secret123',
      });
    expect(ok.status).toBe(200);

    const short = await request(app)
      .post('/api/identity/guardian-auth/set-password')
      .set(internalOnly())
      .send({
        tenant_id: 't1',
        guardian_id: g.id,
        password: 'short',
      });
    expect(short.status).toBe(400);
  });
});
