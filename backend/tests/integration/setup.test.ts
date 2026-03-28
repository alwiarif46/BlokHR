import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';

describe('Setup Wizard Module', () => {
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

  // ── GET /api/setup/status ──

  describe('GET /api/setup/status', () => {
    it('returns setupComplete false on fresh install', async () => {
      const res = await request(app).get('/api/setup/status');
      expect(res.status).toBe(200);
      expect(res.body.setupComplete).toBe(false);
      expect(res.body.currentStep).toBe(1);
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
        .send({ licenseKey: 'LICENSE-12345678', adminEmail: 'admin@acme.com' });

      const res = await request(app).get('/api/setup/status');
      expect(res.body.setupComplete).toBe(true);
      expect(res.body.currentStep).toBe(3);
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

    it('accepts both providers simultaneously', async () => {
      const res = await request(app).post('/api/setup/step2').send({
        msalClientId: 'ms-id',
        msalTenantId: 'ms-tenant',
        googleOAuthClientId: 'google-id',
      });
      expect(res.body.success).toBe(true);
    });
  });

  // ── POST /api/setup/step3 ──

  describe('POST /api/setup/step3', () => {
    it('saves license key, creates admin, and marks setup complete', async () => {
      const res = await request(app).post('/api/setup/step3').send({
        licenseKey: 'SHAAVIR-ENTERPRISE-2026',
        adminEmail: 'boss@acme.com',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify setup is complete
      const status = await request(app).get('/api/setup/status');
      expect(status.body.setupComplete).toBe(true);
      expect(status.body.branding.licenseKey).toBe('SHAAVIR-ENTERPRISE-2026');
      expect(status.body.branding.licenseValid).toBe(true);

      // Verify admin was created
      const row = await db.get<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
        'boss@acme.com',
      ]);
      expect(row).toBeTruthy();
      expect(row!.email).toBe('boss@acme.com');
    });

    it('rejects missing admin email', async () => {
      const res = await request(app).post('/api/setup/step3').send({ licenseKey: 'SOME-KEY' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/adminEmail/i);
    });

    it('normalizes admin email to lowercase', async () => {
      await request(app)
        .post('/api/setup/step3')
        .send({ licenseKey: 'KEY-12345678', adminEmail: 'ADMIN@Acme.COM' });

      const row = await db.get<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
        'admin@acme.com',
      ]);
      expect(row).toBeTruthy();
    });

    it('marks license invalid for short keys', async () => {
      await request(app)
        .post('/api/setup/step3')
        .send({ licenseKey: 'short', adminEmail: 'admin@acme.com' });

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.licenseValid).toBe(false);
      expect(status.body.setupComplete).toBe(true);
    });

    it('handles empty license key gracefully', async () => {
      const res = await request(app)
        .post('/api/setup/step3')
        .send({ adminEmail: 'admin@acme.com' });
      expect(res.body.success).toBe(true);

      const status = await request(app).get('/api/setup/status');
      expect(status.body.branding.licenseValid).toBe(false);
      expect(status.body.setupComplete).toBe(true);
    });

    it('does not duplicate admin on re-run', async () => {
      await request(app)
        .post('/api/setup/step3')
        .send({ licenseKey: 'KEY-AAAABBBB', adminEmail: 'admin@acme.com' });
      await request(app)
        .post('/api/setup/step3')
        .send({ licenseKey: 'KEY-CCCCDDDD', adminEmail: 'admin@acme.com' });

      const rows = await db.all<{ email: string }>('SELECT email FROM admins WHERE email = ?', [
        'admin@acme.com',
      ]);
      expect(rows).toHaveLength(1);
    });
  });

  // ── Full flow ──

  describe('Complete setup flow', () => {
    it('runs all 3 steps end to end', async () => {
      // Step 1
      const s1 = await request(app).post('/api/setup/step1').send({
        companyName: 'Shaavir Technologies',
        tagline: 'Empowering your Technology',
        primaryColor: '#F5A623',
      });
      expect(s1.body.success).toBe(true);

      // Step 2
      const s2 = await request(app).post('/api/setup/step2').send({
        msalClientId: '74454d71-cddc-41f8-8f60-b724917582e9',
        msalTenantId: '69788b51-fdd9-4c1f-a137-6e90b6c57792',
        googleOAuthClientId: '1044441791108-xxx.apps.googleusercontent.com',
      });
      expect(s2.body.success).toBe(true);

      // Step 3
      const s3 = await request(app).post('/api/setup/step3').send({
        licenseKey: 'SHAAVIR-ENT-2026-PROD',
        adminEmail: 'arifalwi@shaavir.onmicrosoft.com',
      });
      expect(s3.body.success).toBe(true);

      // Verify complete state
      const final = await request(app).get('/api/setup/status');
      expect(final.body.setupComplete).toBe(true);
      expect(final.body.branding.companyName).toBe('Shaavir Technologies');
      expect(final.body.branding.msalClientId).toBe('74454d71-cddc-41f8-8f60-b724917582e9');
      expect(final.body.branding.licenseValid).toBe(true);

      // Settings bundle should reflect branding
      const settings = await request(app)
        .get('/api/settings')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(settings.body.branding).toBeTruthy();
      expect(settings.body.branding.companyName).toBe('Shaavir Technologies');
      expect(settings.body.branding.setupComplete).toBe(true);
    });
  });
});
