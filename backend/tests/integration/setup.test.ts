import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import { DEFAULT_SCHOOL_MODULES } from '@blokhr/entitlements';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';
import { SCHOOL_TERMINOLOGY_DEFAULTS } from '../../src/services/vertical-defaults';

describe('Setup Wizard Module', () => {
  let app: Express;
  let db: DatabaseEngine;
  let commercial: Awaited<ReturnType<typeof createTestApp>>['commercial'];

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    commercial = setup.commercial;
  });

  afterEach(async () => {
    if (commercial) await commercial.close();
    if (db) await db.close();
  });

  // ── GET /api/setup/status ──

  describe('GET /api/setup/status', () => {
    it('returns setupComplete false on fresh install', async () => {
      const res = await request(app).get('/api/setup/status');
      expect(res.status).toBe(200);
      expect(res.body.setupComplete).toBe(false);
      expect(res.body.currentStep).toBe(1);
      expect(res.body.vertical).toBeNull();
    });

    it('returns branding state in response', async () => {
      const res = await request(app).get('/api/setup/status');
      expect(res.body.branding).toBeDefined();
      expect(res.body.branding.companyName).toBe('');
    });

    it('advances to step 2 after step 1 is saved', async () => {
      await request(app).post('/api/setup/step1').send({ companyName: 'Acme Corp' });

      const res = await request(app).get('/api/setup/status');
      expect(res.body.currentStep).toBe(2);
      expect(res.body.branding.companyName).toBe('Acme Corp');
    });

    it('advances to step 3 after step 2 is saved', async () => {
      await request(app).post('/api/setup/step1').send({ companyName: 'Acme Corp' });
      await request(app)
        .post('/api/setup/step2')
        .send({ msalClientId: 'abc-123', msalTenantId: 'tenant-456' });

      const res = await request(app).get('/api/setup/status');
      expect(res.body.currentStep).toBe(3);
    });

    it('shows setupComplete true after step 3', async () => {
      await request(app).post('/api/setup/step1').send({ companyName: 'Acme Corp' });
      await request(app).post('/api/setup/step2').send({ msalClientId: 'abc-123' });
      await request(app)
        .post('/api/setup/step3')
        .send({ adminEmail: 'admin@acme.com' });

      const res = await request(app).get('/api/setup/status');
      expect(res.body.setupComplete).toBe(true);
      expect(res.body.currentStep).toBe(3);
      expect(res.body.deploymentMode).toBe('cloud');
    });
  });

  // ── POST /api/setup/step1 ──

  describe('POST /api/setup/step1', () => {
    it('saves company name and branding', async () => {
      const res = await request(app).post('/api/setup/step1').send({
        companyName: 'Shaavir Technologies',
        tagline: 'Empowering your tech',
        primaryColor: '#3B82F6',
        emailFromName: 'Shaavir HR',
        emailFromAddress: 'hr@shaavir.com',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.companyName).toBe('Shaavir Technologies');
      expect(status.body.branding.tagline).toBe('Empowering your tech');
      expect(status.body.branding.primaryColor).toBe('#3B82F6');
    });

    it('rejects missing company name', async () => {
      const res = await request(app).post('/api/setup/step1').send({ tagline: 'No name given' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/companyName/i);
    });

    it('defaults card footer and email from name to company name', async () => {
      await request(app).post('/api/setup/step1').send({ companyName: 'DefaultTest Inc' });

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.cardFooterText).toBe('DefaultTest Inc');
      expect(status.body.branding.emailFromName).toBe('DefaultTest Inc');
    });

    it('trims whitespace', async () => {
      await request(app).post('/api/setup/step1').send({ companyName: '  Trimmed Corp  ' });

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.companyName).toBe('Trimmed Corp');
    });
  });

  // ── POST /api/setup/step2 ──

  describe('POST /api/setup/step2', () => {
    it('saves Microsoft auth config', async () => {
      const res = await request(app).post('/api/setup/step2').send({
        msalClientId: 'client-abc-123',
        msalTenantId: 'tenant-xyz-789',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.msalClientId).toBe('client-abc-123');
      expect(status.body.branding.msalTenantId).toBe('tenant-xyz-789');
    });

    it('saves Google auth config', async () => {
      const res = await request(app)
        .post('/api/setup/step2')
        .send({ googleOAuthClientId: 'google-client-id.apps.googleusercontent.com' });
      expect(res.body.success).toBe(true);

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.googleOAuthClientId).toBe(
        'google-client-id.apps.googleusercontent.com',
      );
    });

    it('rejects when no auth provider is configured', async () => {
      const res = await request(app).post('/api/setup/step2').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/auth provider/i);
    });

    it('rejects when all sign-in methods are disabled', async () => {
      const res = await request(app).post('/api/setup/step2').send({
        authLocalEnabled: false,
        authMagicLinkEnabled: false,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/auth provider/i);
    });

    it('accepts local email/password only (small-team path)', async () => {
      const res = await request(app).post('/api/setup/step2').send({
        authLocalEnabled: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.authLocalEnabled).toBe(true);
      expect(status.body.branding.authMagicLinkEnabled).toBe(false);
      expect(status.body.branding.msalClientId).toBe('');
      expect(status.body.branding.googleOAuthClientId).toBe('');
      expect(status.body.currentStep).toBe(3);
    });

    it('accepts magic link only', async () => {
      const res = await request(app).post('/api/setup/step2').send({
        authLocalEnabled: false,
        authMagicLinkEnabled: true,
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.authLocalEnabled).toBe(false);
      expect(status.body.branding.authMagicLinkEnabled).toBe(true);
    });

    it('accepts both providers simultaneously', async () => {
      const res = await request(app).post('/api/setup/step2').send({
        msalClientId: 'ms-id',
        msalTenantId: 'ms-tenant',
        googleOAuthClientId: 'google-id',
      });
      expect(res.body.success).toBe(true);
    });

    it('accepts local auth plus Google SSO', async () => {
      const res = await request(app).post('/api/setup/step2').send({
        authLocalEnabled: true,
        googleOAuthClientId: 'google-id.apps.googleusercontent.com',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.authLocalEnabled).toBe(true);
      expect(status.body.branding.googleOAuthClientId).toBe(
        'google-id.apps.googleusercontent.com',
      );
    });

    it('exposes auth toggles on setup status', async () => {
      await request(app).post('/api/setup/step2').send({
        authLocalEnabled: true,
        authMagicLinkEnabled: true,
      });

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.authLocalEnabled).toBe(true);
      expect(status.body.branding.authMagicLinkEnabled).toBe(true);
    });
  });

  // ── POST /api/setup/step3 ──

  describe('POST /api/setup/step3', () => {
    it('starts cloud trial, creates admin, and marks setup complete', async () => {
      const res = await request(app).post('/api/setup/step3').send({
        adminEmail: 'boss@acme.com',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.entitlement.plan).toBe('trial');
      expect(res.body.entitlement.status).toBe('trialing');
      expect(res.body.entitlement.vertical).toBe('hr');

      const status = await request(app).get('/api/setup/status');
      expect(status.body.setupComplete).toBe(true);
      expect(status.body.deploymentMode).toBe('cloud');
      expect(status.body.vertical).toBe('hr');
      expect(status.body.branding.licenseValid).toBe(true);
      expect(status.body.branding.entitlement.plan).toBe('trial');

      const row = await db.get<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
        'boss@acme.com',
      ]);
      expect(row).toBeTruthy();
      expect(row!.email).toBe('boss@acme.com');
    });

    it('starts school vertical trial with school modules and terminology seed', async () => {
      const res = await request(app).post('/api/setup/step3').send({
        adminEmail: 'principal@school.edu',
        vertical: 'school',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.entitlement.vertical).toBe('school');
      expect(res.body.entitlement.modules).toEqual([...DEFAULT_SCHOOL_MODULES]);

      const status = await request(app).get('/api/setup/status');
      expect(status.body.vertical).toBe('school');

      const settingsRow = await db.get<{ settings_json: string }>(
        "SELECT settings_json FROM tenant_settings WHERE id = 'default'",
      );
      expect(settingsRow).toBeTruthy();
      const settings = JSON.parse(settingsRow!.settings_json) as {
        vertical?: string;
        terminology?: Record<string, string>;
        dataRetention?: { attendancePhotoDays?: number; attendanceGeoDays?: number };
      };
      expect(settings.vertical).toBe('school');
      expect(settings.terminology).toMatchObject({ ...SCHOOL_TERMINOLOGY_DEFAULTS });
      expect(settings.dataRetention?.attendancePhotoDays).toBe(45);
      expect(settings.dataRetention?.attendanceGeoDays).toBe(45);
    });

    it('rejects invalid vertical on step3', async () => {
      const res = await request(app).post('/api/setup/step3').send({
        adminEmail: 'boss@acme.com',
        vertical: 'clinic',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/vertical/i);
    });

    it('returns 409 when vertical is changed after it was set', async () => {
      await request(app).post('/api/setup/step3').send({
        adminEmail: 'boss@acme.com',
        vertical: 'hr',
      });
      const res = await request(app).post('/api/setup/step3').send({
        adminEmail: 'boss@acme.com',
        vertical: 'school',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('vertical_immutable');
    });

    it('rejects missing admin email', async () => {
      const res = await request(app).post('/api/setup/step3').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/adminEmail/i);
    });

    it('normalizes admin email to lowercase', async () => {
      await request(app).post('/api/setup/step3').send({ adminEmail: 'ADMIN@Acme.COM' });

      const row = await db.get<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
        'admin@acme.com',
      ]);
      expect(row).toBeTruthy();
    });

    it('does not duplicate admin on re-run', async () => {
      await request(app).post('/api/setup/step3').send({ adminEmail: 'admin@acme.com' });
      await request(app).post('/api/setup/step3').send({ adminEmail: 'admin@acme.com' });

      const rows = await db.all<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
        'admin@acme.com',
      ]);
      expect(rows).toHaveLength(1);
    });

    it('activates signed license in self_hosted mode', async () => {
      const { createTestApp: createSelfHostedApp } = await import('../helpers/setup');
      // Use a dedicated app with self_hosted mode
      const setup = await createSelfHostedApp();
      // Override by issuing license via entitlements API then activating
      const validFrom = new Date(Date.now() - 86400000).toISOString();
      const validTo = new Date(Date.now() + 180 * 86400000).toISOString();
      const issued = await request(setup.app).post('/api/entitlements/licenses/issue').send({
        tenantId: 'default',
        plan: 'enterprise',
        seatLimit: 500,
        modules: ['attendance', 'leaves'],
        validFrom,
        validTo,
      });
      expect(issued.status).toBe(201);

      // Recreate with self_hosted — simpler: call entitlements activate via step3 with token
      // For default cloud test app, step3 ignores invalid stub keys and starts trial.
      // Test self-hosted path through entitlements activate endpoint directly:
      const activate = await request(setup.app)
        .post('/api/entitlements/default/activate-license')
        .send({ licenseToken: issued.body.licenseToken });
      expect(activate.status).toBe(200);
      expect(activate.body.channel).toBe('self_hosted');
      await setup.db.close();
      await setup.commercial.close();
    });
  });

  // ── Full flow ──

  describe('Complete setup flow', () => {
    it('runs all 3 steps end to end with cloud trial', async () => {
      const s1 = await request(app).post('/api/setup/step1').send({
        companyName: 'Shaavir Technologies',
        tagline: 'Empowering your Technology',
        primaryColor: '#F5A623',
      });
      expect(s1.body.success).toBe(true);

      const s2 = await request(app).post('/api/setup/step2').send({
        authLocalEnabled: true,
        msalClientId: '74454d71-cddc-41f8-8f60-b724917582e9',
        msalTenantId: '69788b51-fdd9-4c1f-a137-6e90b6c57792',
        googleOAuthClientId: '1044441791108-xxx.apps.googleusercontent.com',
      });
      expect(s2.body.success).toBe(true);

      const s3 = await request(app).post('/api/setup/step3').send({
        adminEmail: 'arifalwi@shaavir.onmicrosoft.com',
      });
      expect(s3.body.success).toBe(true);
      expect(s3.body.entitlement.plan).toBe('trial');

      const final = await request(app).get('/api/setup/status');
      expect(final.body.setupComplete).toBe(true);
      expect(final.body.branding.companyName).toBe('Shaavir Technologies');
      expect(final.body.branding.msalClientId).toBe('74454d71-cddc-41f8-8f60-b724917582e9');
      expect(final.body.branding.licenseValid).toBe(true);

      const settings = await request(app)
        .get('/api/settings')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(settings.body.branding).toBeTruthy();
      expect(settings.body.branding.companyName).toBe('Shaavir Technologies');
      expect(settings.body.branding.setupComplete).toBe(true);
    });
  });
});
