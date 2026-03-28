import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Mobile-Native Features Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice', groupShiftStart: '09:00', groupShiftEnd: '18:00' });
    await seedMember(db, { email: 'bob@shaavir.com', name: 'Bob', groupShiftStart: '09:00', groupShiftEnd: '18:00' });
  });

  afterEach(async () => { await db.close(); });

  // ── Device registration ──

  describe('POST /api/mobile/devices', () => {
    it('registers a device for push notifications', async () => {
      const res = await request(app).post('/api/mobile/devices')
        .send({ platform: 'android', token: 'fcm-token-abc123', appVersion: '2.1.0', deviceName: 'Pixel 7' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.device.platform).toBe('android');
      expect(res.body.device.token).toBe('fcm-token-abc123');
    });

    it('upserts on duplicate email+token', async () => {
      await request(app).post('/api/mobile/devices')
        .send({ platform: 'android', token: 'token-1', appVersion: '1.0' })
        .set('X-User-Email', 'alice@shaavir.com');
      const res = await request(app).post('/api/mobile/devices')
        .send({ platform: 'android', token: 'token-1', appVersion: '2.0' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(201);

      const devices = await request(app).get('/api/mobile/devices')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(devices.body.devices).toHaveLength(1);
      expect(devices.body.devices[0].app_version).toBe('2.0');
    });

    it('rejects invalid platform', async () => {
      const res = await request(app).post('/api/mobile/devices')
        .send({ platform: 'blackberry', token: 'tok' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/platform/i);
    });

    it('requires authentication', async () => {
      const res = await request(app).post('/api/mobile/devices')
        .send({ platform: 'ios', token: 'tok' });
      expect(res.status).toBe(401);
    });
  });

  describe('DELETE /api/mobile/devices', () => {
    it('removes a device token', async () => {
      await request(app).post('/api/mobile/devices')
        .send({ platform: 'ios', token: 'apns-token-xyz' })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app).delete('/api/mobile/devices')
        .send({ token: 'apns-token-xyz' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);

      const devices = await request(app).get('/api/mobile/devices')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(devices.body.devices).toHaveLength(0);
    });
  });

  // ── Biometric auth ──

  describe('Biometric authentication', () => {
    it('registers and authenticates a biometric credential', async () => {
      const reg = await request(app).post('/api/auth/biometric/register')
        .send({ credentialId: 'cred-001', publicKey: 'pk-base64-data', deviceName: 'iPhone 15' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(reg.status).toBe(201);
      expect(reg.body.credential.credential_id).toBe('cred-001');

      const auth = await request(app).post('/api/auth/biometric')
        .send({ credentialId: 'cred-001' });
      expect(auth.status).toBe(200);
      expect(auth.body.email).toBe('alice@shaavir.com');
      expect(auth.body.sessionToken).toBeTruthy();
    });

    it('rejects duplicate credential ID', async () => {
      await request(app).post('/api/auth/biometric/register')
        .send({ credentialId: 'cred-dup', publicKey: 'pk1' })
        .set('X-User-Email', 'alice@shaavir.com');
      const res = await request(app).post('/api/auth/biometric/register')
        .send({ credentialId: 'cred-dup', publicKey: 'pk2' })
        .set('X-User-Email', 'bob@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already registered/);
    });

    it('rejects unknown credential on auth', async () => {
      const res = await request(app).post('/api/auth/biometric')
        .send({ credentialId: 'nonexistent' });
      expect(res.status).toBe(401);
    });

    it('lists and removes credentials', async () => {
      await request(app).post('/api/auth/biometric/register')
        .send({ credentialId: 'cred-del', publicKey: 'pk' })
        .set('X-User-Email', 'alice@shaavir.com');

      const list = await request(app).get('/api/auth/biometric/credentials')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(list.body.credentials).toHaveLength(1);

      await request(app).delete('/api/auth/biometric/cred-del')
        .set('X-User-Email', 'alice@shaavir.com');

      const list2 = await request(app).get('/api/auth/biometric/credentials')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(list2.body.credentials).toHaveLength(0);
    });
  });

  // ── Location breadcrumbs ──

  describe('Location breadcrumbs', () => {
    beforeEach(async () => {
      // Enable location tracking
      await request(app).put('/api/mobile/location/settings')
        .send({ enabled: true, intervalSeconds: 60 })
        .set('X-User-Email', 'admin@shaavir.com');
    });

    it('records a breadcrumb', async () => {
      const res = await request(app).post('/api/mobile/location')
        .send({ latitude: 28.6139, longitude: 77.2090, accuracy: 15 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.breadcrumb.latitude).toBe(28.6139);
    });

    it('rejects when tracking is disabled', async () => {
      await request(app).put('/api/mobile/location/settings')
        .send({ enabled: false }).set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).post('/api/mobile/location')
        .send({ latitude: 28.6, longitude: 77.2 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not enabled/);
    });

    it('rejects invalid coordinates', async () => {
      const res = await request(app).post('/api/mobile/location')
        .send({ latitude: 999, longitude: 77 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Cc]oordinates/);
    });

    it('retrieves breadcrumbs and latest location', async () => {
      await request(app).post('/api/mobile/location')
        .send({ latitude: 28.61, longitude: 77.20 })
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app).post('/api/mobile/location')
        .send({ latitude: 28.62, longitude: 77.21 })
        .set('X-User-Email', 'alice@shaavir.com');

      const all = await request(app).get('/api/mobile/location?email=alice@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(all.body.breadcrumbs).toHaveLength(2);

      const latest = await request(app).get('/api/mobile/location/latest?email=alice@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(latest.body.location.latitude).toBe(28.62);
    });

    it('reads and updates tracking settings', async () => {
      const res = await request(app).get('/api/mobile/location/settings')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.settings.enabled).toBe(true);
      expect(res.body.settings.intervalSeconds).toBe(60);
    });
  });

  // ── Expense receipts ──

  describe('Expense receipts', () => {
    it('creates a receipt', async () => {
      const res = await request(app).post('/api/expenses/receipt')
        .send({ vendor: 'Uber', amount: 350, category: 'travel', receiptDate: '2026-03-20' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.receipt.status).toBe('draft');
      expect(res.body.receipt.vendor).toBe('Uber');
    });

    it('submits, approves, and rejects receipts', async () => {
      const r = await request(app).post('/api/expenses/receipt')
        .send({ vendor: 'Hotel', amount: 5000, category: 'accommodation' })
        .set('X-User-Email', 'alice@shaavir.com');
      const id = r.body.receipt.id;

      // Submit
      await request(app).post(`/api/expenses/receipts/${id}/submit`)
        .set('X-User-Email', 'alice@shaavir.com');

      // Approve
      const approve = await request(app).post(`/api/expenses/receipts/${id}/approve`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(approve.body.success).toBe(true);

      const fetched = await request(app).get(`/api/expenses/receipts/${id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.receipt.status).toBe('approved');
    });

    it('rejects approving a draft receipt', async () => {
      const r = await request(app).post('/api/expenses/receipt')
        .send({ vendor: 'X', amount: 100 })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app).post(`/api/expenses/receipts/${r.body.receipt.id}/approve`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('lists my receipts', async () => {
      await request(app).post('/api/expenses/receipt')
        .send({ vendor: 'A', amount: 100 }).set('X-User-Email', 'alice@shaavir.com');
      await request(app).post('/api/expenses/receipt')
        .send({ vendor: 'B', amount: 200 }).set('X-User-Email', 'bob@shaavir.com');

      const mine = await request(app).get('/api/expenses/receipts/mine')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(mine.body.receipts).toHaveLength(1);
      expect(mine.body.receipts[0].vendor).toBe('A');
    });
  });

  // ── Batch approvals ──

  describe('POST /api/approvals/batch', () => {
    it('processes batch approvals across types', async () => {
      // Seed a leave request and a timesheet to batch-approve
      await db.run(
        `INSERT INTO leave_requests (id, person_name, person_email, leave_type, start_date, end_date, days_requested, status)
         VALUES ('lv-batch-1', 'Alice', 'alice@shaavir.com', 'Casual', '2026-04-01', '2026-04-01', 1, 'Pending')`,
      );

      const res = await request(app).post('/api/approvals/batch')
        .send({
          items: [
            { type: 'leave', id: 'lv-batch-1', action: 'approve' },
          ],
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].success).toBe(true);
    });

    it('returns per-item errors without aborting batch', async () => {
      const res = await request(app).post('/api/approvals/batch')
        .send({
          items: [
            { type: 'leave', id: 'nonexistent', action: 'approve' },
            { type: 'overtime', id: 'also-missing', action: 'reject' },
          ],
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.results).toHaveLength(2);
      expect(res.body.results[0].success).toBe(false);
      expect(res.body.results[1].success).toBe(false);
    });

    it('rejects empty items array', async () => {
      const res = await request(app).post('/api/approvals/batch')
        .send({ items: [] }).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Deep links ──

  describe('GET /api/mobile/deep-link', () => {
    it('generates app and web deep links', async () => {
      const res = await request(app)
        .get('/api/mobile/deep-link?entityType=leave&entityId=lv-123&webBaseUrl=https://app.shaavir.com')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.appLink).toBe('shaavir://leave/lv-123');
      expect(res.body.webLink).toBe('https://app.shaavir.com/leave/lv-123');
    });

    it('generates links without webBaseUrl', async () => {
      const res = await request(app)
        .get('/api/mobile/deep-link?entityType=timesheet&entityId=ts-456')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.appLink).toBe('shaavir://timesheet/ts-456');
      expect(res.body.webLink).toBe('/timesheet/ts-456');
    });

    it('requires entityType and entityId', async () => {
      const res = await request(app).get('/api/mobile/deep-link')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });
  });
});
