import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Multi-Provider Auth Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'admin@shaavir.com', name: 'Admin' });
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice' });
  });

  afterEach(async () => { await db.close(); });

  // ── Provider discovery ──

  describe('GET /api/auth/providers', () => {
    it('returns local auth as enabled by default', async () => {
      const res = await request(app).get('/api/auth/providers');
      expect(res.status).toBe(200);
      const local = res.body.providers.find((p: { id: string }) => p.id === 'local');
      expect(local).toBeTruthy();
      expect(local.type).toBe('local');
    });

    it('includes Microsoft provider when msal_client_id is set', async () => {
      await db.run("UPDATE branding SET msal_client_id = 'test-msal-id' WHERE id = 1");
      const res = await request(app).get('/api/auth/providers');
      const ms = res.body.providers.find((p: { id: string }) => p.id === 'microsoft');
      expect(ms).toBeTruthy();
    });

    it('includes OIDC provider when configured', async () => {
      await db.run(
        "UPDATE branding SET oidc_enabled = 1, oidc_client_id = 'oidc-id', oidc_issuer_url = 'https://idp.example.com' WHERE id = 1",
      );
      const res = await request(app).get('/api/auth/providers');
      const oidc = res.body.providers.find((p: { id: string }) => p.id === 'oidc');
      expect(oidc).toBeTruthy();
      expect(oidc.type).toBe('oidc');
    });
  });

  // ── Email/Password auth ──

  describe('POST /api/auth/local', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/local/register')
        .send({ email: 'alice@shaavir.com', password: 'securepass123' })
        .set('X-User-Email', 'admin@shaavir.com');
    });

    it('authenticates with correct credentials', async () => {
      const res = await request(app).post('/api/auth/local')
        .send({ email: 'alice@shaavir.com', password: 'securepass123' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe('alice@shaavir.com');
      expect(res.body.sessionToken).toBeTruthy();
    });

    it('rejects wrong password', async () => {
      const res = await request(app).post('/api/auth/local')
        .send({ email: 'alice@shaavir.com', password: 'wrongpass' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/[Ii]nvalid/);
    });

    it('rejects nonexistent email', async () => {
      const res = await request(app).post('/api/auth/local')
        .send({ email: 'nobody@shaavir.com', password: 'whatever' });
      expect(res.status).toBe(401);
    });

    it('locks account after 5 failed attempts', async () => {
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/auth/local')
          .send({ email: 'alice@shaavir.com', password: 'wrong' });
      }
      const res = await request(app).post('/api/auth/local')
        .send({ email: 'alice@shaavir.com', password: 'securepass123' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/[Ll]ocked/);
    });
  });

  describe('POST /api/auth/local/register', () => {
    it('creates credentials', async () => {
      const res = await request(app).post('/api/auth/local/register')
        .send({ email: 'alice@shaavir.com', password: 'password123' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
    });

    it('rejects duplicate registration', async () => {
      await request(app).post('/api/auth/local/register')
        .send({ email: 'alice@shaavir.com', password: 'password123' })
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app).post('/api/auth/local/register')
        .send({ email: 'alice@shaavir.com', password: 'other123456' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Aa]lready/);
    });

    it('rejects short password', async () => {
      const res = await request(app).post('/api/auth/local/register')
        .send({ email: 'alice@shaavir.com', password: 'short' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/8 characters/);
    });
  });

  // ── Password management ──

  describe('Password change and reset', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/local/register')
        .send({ email: 'alice@shaavir.com', password: 'oldpass12345' })
        .set('X-User-Email', 'admin@shaavir.com');
    });

    it('changes password with correct old password', async () => {
      const res = await request(app).post('/api/auth/change-password')
        .send({ oldPassword: 'oldpass12345', newPassword: 'newpass12345' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);

      // Verify new password works
      const login = await request(app).post('/api/auth/local')
        .send({ email: 'alice@shaavir.com', password: 'newpass12345' });
      expect(login.body.success).toBe(true);
    });

    it('rejects change with wrong old password', async () => {
      const res = await request(app).post('/api/auth/change-password')
        .send({ oldPassword: 'wrongold', newPassword: 'newpass12345' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('admin resets password without old password', async () => {
      const res = await request(app).post('/api/auth/reset-password')
        .send({ email: 'alice@shaavir.com', newPassword: 'resetpass123' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const login = await request(app).post('/api/auth/local')
        .send({ email: 'alice@shaavir.com', password: 'resetpass123' });
      expect(login.body.success).toBe(true);
      expect(login.body.mustChangePassword).toBe(true);
    });
  });

  // ── Magic link ──

  describe('Magic link auth', () => {
    it('generates a magic link for existing member', async () => {
      const res = await request(app).post('/api/auth/magic-link/request')
        .send({ email: 'alice@shaavir.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('returns success even for nonexistent email (no leak)', async () => {
      const res = await request(app).post('/api/auth/magic-link/request')
        .send({ email: 'nobody@shaavir.com' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('verifies a valid magic link token', async () => {
      // Get the token directly from DB after generation
      await request(app).post('/api/auth/magic-link/request')
        .send({ email: 'alice@shaavir.com' });
      const row = await db.get<{ token: string; [key: string]: unknown }>(
        "SELECT token FROM magic_link_tokens WHERE email = 'alice@shaavir.com' AND used = 0",
      );

      const res = await request(app).post('/api/auth/magic-link/verify')
        .send({ token: row!.token });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe('alice@shaavir.com');
    });

    it('rejects used magic link token', async () => {
      await request(app).post('/api/auth/magic-link/request')
        .send({ email: 'alice@shaavir.com' });
      const row = await db.get<{ token: string; [key: string]: unknown }>(
        "SELECT token FROM magic_link_tokens WHERE email = 'alice@shaavir.com' AND used = 0",
      );

      await request(app).post('/api/auth/magic-link/verify')
        .send({ token: row!.token });
      const res = await request(app).post('/api/auth/magic-link/verify')
        .send({ token: row!.token });
      expect(res.status).toBe(401);
    });

    it('rejects invalid token', async () => {
      const res = await request(app).post('/api/auth/magic-link/verify')
        .send({ token: 'bogus-token-value' });
      expect(res.status).toBe(401);
    });
  });

  // ── Microsoft MSAL ──

  describe('POST /api/auth/teams-sso (multi-auth)', () => {
    it('decodes a valid SSO token', async () => {
      const payload = { preferred_username: 'alice@shaavir.com', name: 'Alice' };
      const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
      const res = await request(app).post('/api/auth/teams-sso')
        .send({ ssoToken: token });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@shaavir.com');
    });
  });

  // ── Google OAuth ──

  describe('POST /api/auth/google', () => {
    it('decodes a valid Google ID token', async () => {
      const payload = { email: 'alice@shaavir.com', name: 'Alice' };
      const token = `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
      const res = await request(app).post('/api/auth/google')
        .send({ idToken: token });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@shaavir.com');
    });
  });

  // ── OIDC ──

  describe('OIDC auth', () => {
    it('returns auth URL when configured', async () => {
      await db.run(
        "UPDATE branding SET oidc_enabled = 1, oidc_client_id = 'client-123', oidc_issuer_url = 'https://idp.example.com', oidc_redirect_uri = 'https://app.shaavir.com/callback' WHERE id = 1",
      );
      const res = await request(app).get('/api/auth/oidc/authorize');
      expect(res.status).toBe(200);
      expect(res.body.authUrl).toContain('https://idp.example.com/authorize');
      expect(res.body.authUrl).toContain('client_id=client-123');
    });

    it('rejects when not configured', async () => {
      const res = await request(app).get('/api/auth/oidc/authorize');
      expect(res.status).toBe(400);
    });

    it('decodes OIDC callback token', async () => {
      const payload = { email: 'alice@shaavir.com', name: 'Alice', sub: 'user-123' };
      const token = `h.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.s`;
      const res = await request(app).post('/api/auth/oidc/callback')
        .send({ idToken: token });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@shaavir.com');
    });
  });

  // ── SAML ──

  describe('SAML auth', () => {
    it('returns login URL when configured', async () => {
      await db.run(
        "UPDATE branding SET saml_enabled = 1, saml_entry_point = 'https://idp.corp.com/saml', saml_issuer = 'shaavir-app', saml_callback_url = 'https://app.shaavir.com/saml/callback' WHERE id = 1",
      );
      const res = await request(app).get('/api/auth/saml/login');
      expect(res.status).toBe(200);
      expect(res.body.loginUrl).toContain('https://idp.corp.com/saml');
    });

    it('processes SAML callback assertion', async () => {
      const res = await request(app).post('/api/auth/saml/callback')
        .send({ email: 'alice@shaavir.com', name: 'Alice' });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@shaavir.com');
    });

    it('rejects callback without email', async () => {
      const res = await request(app).post('/api/auth/saml/callback')
        .send({ name: 'Alice' });
      expect(res.status).toBe(400);
    });
  });

  // ── LDAP ──

  describe('POST /api/auth/ldap', () => {
    beforeEach(async () => {
      await db.run(
        "UPDATE branding SET ldap_enabled = 1, ldap_url = 'ldap://dc.corp.com:389', ldap_search_base = 'DC=corp,DC=com' WHERE id = 1",
      );
      // Seed local credentials as LDAP fallback in dev mode
      await request(app).post('/api/auth/local/register')
        .send({ email: 'alice@shaavir.com', password: 'ldappass123' })
        .set('X-User-Email', 'admin@shaavir.com');
    });

    it('authenticates via LDAP (dev fallback to local credentials)', async () => {
      const res = await request(app).post('/api/auth/ldap')
        .send({ email: 'alice@shaavir.com', password: 'ldappass123' });
      expect(res.status).toBe(200);
      expect(res.body.email).toBe('alice@shaavir.com');
    });

    it('rejects when LDAP not configured', async () => {
      await db.run("UPDATE branding SET ldap_enabled = 0, ldap_url = '' WHERE id = 1");
      const res = await request(app).post('/api/auth/ldap')
        .send({ email: 'alice@shaavir.com', password: 'pass' });
      expect(res.status).toBe(401);
      expect(res.body.error).toMatch(/not configured/);
    });
  });
});
