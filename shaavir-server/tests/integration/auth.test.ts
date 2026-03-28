import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';

/** Build a fake JWT with the given payload (no signature verification in our service). */
function fakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = Buffer.from('fake-signature').toString('base64url');
  return `${header}.${body}.${sig}`;
}

describe('Auth — Teams SSO', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
  });

  afterEach(async () => {
    await db.close();
  });

  describe('POST /api/auth/teams-sso', () => {
    it('resolves user identity from a valid SSO token', async () => {
      const token = fakeJwt({
        preferred_username: 'alice@shaavir.onmicrosoft.com',
        name: 'Alice Alwi',
        oid: 'oid-123',
        tid: 'tenant-456',
      });

      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({ ssoToken: token });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@shaavir.onmicrosoft.com');
      expect(res.body.name).toBe('Alice Alwi');
      expect(res.body.oid).toBe('oid-123');
      expect(res.body.tid).toBe('tenant-456');
    });

    it('falls back to upn when preferred_username is missing', async () => {
      const token = fakeJwt({
        upn: 'bob@shaavir.com',
        name: 'Bob',
      });

      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({ ssoToken: token });
      expect(res.body.email).toBe('bob@shaavir.com');
    });

    it('falls back to email claim', async () => {
      const token = fakeJwt({ email: 'charlie@shaavir.com' });

      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({ ssoToken: token });
      expect(res.body.email).toBe('charlie@shaavir.com');
      expect(res.body.name).toBe('charlie@shaavir.com');
    });

    it('normalizes email to lowercase', async () => {
      const token = fakeJwt({
        preferred_username: 'ALICE@Shaavir.COM',
        name: 'Alice',
      });

      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({ ssoToken: token });
      expect(res.body.email).toBe('alice@shaavir.com');
    });

    it('rejects missing ssoToken', async () => {
      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ssoToken/i);
    });

    it('rejects empty ssoToken', async () => {
      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({ ssoToken: '' });
      expect(res.status).toBe(400);
    });

    it('rejects malformed JWT (not 3 parts)', async () => {
      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({ ssoToken: 'not.a.valid.jwt.too.many.parts' });
      expect(res.status).toBe(401);
    });

    it('rejects JWT with no email in claims', async () => {
      const token = fakeJwt({ name: 'NoEmail', oid: '123' });

      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({ ssoToken: token });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/[Nn]o email/);
    });

    it('rejects garbled base64 payload', async () => {
      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({ ssoToken: 'aaa.!!!notbase64!!!.ccc' });
      expect(res.status).toBe(401);
    });
  });
});
