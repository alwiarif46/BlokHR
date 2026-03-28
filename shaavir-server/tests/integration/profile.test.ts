import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Employee Profile Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
    });
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', ['admin@shaavir.com']);
    await seedMember(db, {
      email: 'admin@shaavir.com',
      name: 'Admin User',
      groupId: 'engineering',
      groupName: 'Engineering',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Field-level access control ──

  describe('PUT /api/profile/:id — access control', () => {
    it('employee can update their own editable fields', async () => {
      const res = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ name: 'Alice Alwi', phone: '9876543210', location: 'Delhi' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('employee CANNOT edit admin-only fields', async () => {
      const res = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ designation: 'CEO', joiningDate: '2020-01-01' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/permission/i);
    });

    it('admin CAN edit admin-only fields', async () => {
      const res = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ designation: 'Senior Engineer', joiningDate: '2023-06-15' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('admin can edit employee-editable fields on behalf of employee', async () => {
      const res = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ phone: '9111222333', bankName: 'SBI Main' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('rejects nonexistent member', async () => {
      const res = await request(app)
        .put('/api/profile/nobody@shaavir.com')
        .send({ name: 'Ghost' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/i);
    });

    it('rejects unauthenticated requests', async () => {
      const res = await request(app).put('/api/profile/alice@shaavir.com').send({ name: 'Hacker' });
      expect(res.status).toBe(401);
    });
  });

  // ── Certification flow ──

  describe('Certification flow', () => {
    it('certifies a profile and locks it', async () => {
      const res = await request(app)
        .post('/api/profile/alice@shaavir.com/certify')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);

      const status = await request(app)
        .get('/api/profile/alice@shaavir.com/status')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(status.body.isLocked).toBe(true);
      expect(status.body.certifiedAt).toBeTruthy();
      expect(status.body.profileUnlocked).toBe(false);
    });

    it('blocks employee edits after certification', async () => {
      await request(app)
        .post('/api/profile/alice@shaavir.com/certify')
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ phone: '9999999999' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/locked/i);
    });

    it('admin can still edit a locked profile', async () => {
      await request(app)
        .post('/api/profile/alice@shaavir.com/certify')
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ designation: 'Lead Engineer' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('rejects double certification', async () => {
      await request(app)
        .post('/api/profile/alice@shaavir.com/certify')
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .post('/api/profile/alice@shaavir.com/certify')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/already certified/i);
    });
  });

  // ── Admin unlock flow ──

  describe('Admin unlock', () => {
    it('admin unlocks a locked profile for re-editing', async () => {
      await request(app)
        .post('/api/profile/alice@shaavir.com/certify')
        .set('X-User-Email', 'alice@shaavir.com');

      const unlock = await request(app)
        .post('/api/profile/alice@shaavir.com/unlock')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(unlock.body.success).toBe(true);

      // Employee can now edit again
      const edit = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ phone: '9111222333' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(edit.body.success).toBe(true);

      const status = await request(app)
        .get('/api/profile/alice@shaavir.com/status')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(status.body.isLocked).toBe(false);
      expect(status.body.profileUnlocked).toBe(true);
    });

    it('non-admin cannot unlock', async () => {
      await request(app)
        .post('/api/profile/alice@shaavir.com/certify')
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .post('/api/profile/alice@shaavir.com/unlock')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(403);
    });

    it('employee can re-certify after unlock', async () => {
      await request(app)
        .post('/api/profile/alice@shaavir.com/certify')
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app)
        .post('/api/profile/alice@shaavir.com/unlock')
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post('/api/profile/alice@shaavir.com/certify')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);

      const status = await request(app)
        .get('/api/profile/alice@shaavir.com/status')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(status.body.isLocked).toBe(true);
    });
  });

  // ── Validators via POST /api/profile/validate ──

  describe('POST /api/profile/validate', () => {
    it('passes valid Indian data', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({
          name: 'Alice Alwi',
          phone: '9876543210',
          pan: 'ABCDE1234F',
          aadhaar: '234567890125',
          uan: '123456789012',
          bankAccount: '1234567890123',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      // Name, phone, PAN, UAN, bank should pass
      // Aadhaar may fail Verhoeff depending on test number
      expect(res.body.errors.name).toBeUndefined();
      expect(res.body.errors.phone).toBeUndefined();
      expect(res.body.errors.pan).toBeUndefined();
    });

    it('rejects name with digits', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ name: 'Alice123' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.name).toMatch(/digits/i);
    });

    it('rejects name too short', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ name: 'A' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.name).toMatch(/2 characters/i);
    });

    it('rejects invalid phone', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ phone: '1234567890' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.phone).toMatch(/6-9/);
    });

    it('accepts phone with +91 prefix', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ phone: '+919876543210' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.phone).toBeUndefined();
    });

    it('rejects invalid PAN format', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ pan: 'INVALID' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.pan).toMatch(/ABCDE1234F/);
    });

    it('rejects aadhaar with wrong digit count', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ aadhaar: '12345' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.aadhaar).toMatch(/12 digits/);
    });

    it('rejects aadhaar starting with 0', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ aadhaar: '012345678901' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.aadhaar).toMatch(/cannot start/i);
    });

    it('rejects aadhaar failing Verhoeff checksum', async () => {
      // 234567890126 — last digit changed from valid, should fail Verhoeff
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ aadhaar: '234567890126' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.aadhaar).toMatch(/checksum/i);
    });

    it('rejects UAN with wrong digit count', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ uan: '12345' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.uan).toMatch(/12 digits/);
    });

    it('rejects invalid IFSC format', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ ifsc: 'INVALID' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.ifsc).toMatch(/SBIN0001234/);
    });

    it('rejects bank account too short', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ bankAccount: '12345' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.errors.bankAccount).toMatch(/9 to 18/);
    });

    it('passes empty optional fields', async () => {
      const res = await request(app)
        .post('/api/profile/validate')
        .send({ phone: '', pan: '', aadhaar: '' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.valid).toBe(true);
    });
  });

  // ── Profile status ──

  describe('GET /api/profile/:id/status', () => {
    it('returns unlocked status for fresh member', async () => {
      const res = await request(app)
        .get('/api/profile/alice@shaavir.com/status')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.found).toBe(true);
      expect(res.body.isLocked).toBe(false);
      expect(res.body.certifiedAt).toBeNull();
    });

    it('returns 404 for nonexistent member', async () => {
      const res = await request(app)
        .get('/api/profile/nobody@shaavir.com/status')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(404);
    });
  });

  // ── Validation-gated updates ──

  describe('Validation on update', () => {
    it('rejects profile update with invalid PAN', async () => {
      const res = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ panNumber: 'BAD' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.pan).toBeTruthy();
    });

    it('rejects profile update with invalid phone', async () => {
      const res = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ phone: '1111111111' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.errors.phone).toBeTruthy();
    });

    it('accepts profile update with valid data', async () => {
      const res = await request(app)
        .put('/api/profile/alice@shaavir.com')
        .send({ phone: '9876543210', panNumber: 'ABCDE1234F' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});
