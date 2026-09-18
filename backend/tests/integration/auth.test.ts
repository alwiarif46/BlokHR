import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';

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
    it('rejects unsigned SSO tokens', async () => {
      const token = fakeJwt({
        preferred_username: 'alice@shaavir.onmicrosoft.com',
        name: 'Alice Alwi',
      });

      const res = await request(app).post('/api/auth/teams-sso').send({ ssoToken: token });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/verif/i);
    });

    it('rejects missing ssoToken', async () => {
      const res = await request(app).post('/api/auth/teams-sso').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/ssoToken/i);
    });

    it('rejects empty ssoToken', async () => {
      const res = await request(app).post('/api/auth/teams-sso').send({ ssoToken: '' });
      expect(res.status).toBe(400);
    });

    it('rejects malformed JWT (not 3 parts)', async () => {
      const res = await request(app)
        .post('/api/auth/teams-sso')
        .send({ ssoToken: 'not.a.valid.jwt.too.many.parts' });
      expect(res.status).toBe(401);
    });
  });
});
