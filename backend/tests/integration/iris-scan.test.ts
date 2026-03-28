import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';
import { hammingDistance, findBestMatch } from '../../src/services/iris-scan';

describe('Iris Scan Clock-In Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  // Two distinct "iris templates" for testing.
  // Template A: repeating 0xAA bytes (10101010 pattern)
  // Template B: repeating 0x55 bytes (01010101 pattern) — maximum Hamming distance from A
  // Template A2: identical to A — zero Hamming distance
  const templateA = Buffer.alloc(256, 0xaa).toString('base64');
  const templateA2 = Buffer.alloc(256, 0xaa).toString('base64');
  const templateB = Buffer.alloc(256, 0x55).toString('base64');
  // Template similar to A: one byte different
  const templateAClose = Buffer.alloc(256, 0xaa);
  templateAClose[0] = 0xab; // 1 bit different out of 2048 = distance ~0.0005
  const templateACloseB64 = templateAClose.toString('base64');

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice', groupShiftStart: '09:00', groupShiftEnd: '18:00' });
    await seedMember(db, { email: 'bob@shaavir.com', name: 'Bob', groupShiftStart: '09:00', groupShiftEnd: '18:00' });
  });

  afterEach(async () => { await db.close(); });

  // ── Unit: Hamming distance ──

  describe('hammingDistance()', () => {
    it('returns 0 for identical templates', () => {
      expect(hammingDistance(templateA, templateA2)).toBe(0);
    });

    it('returns 0.5 for maximally different templates', () => {
      // 0xAA vs 0x55 = every bit is different = distance 1.0
      // Actually 10101010 XOR 01010101 = 11111111 → all bits differ → distance 1.0
      expect(hammingDistance(templateA, templateB)).toBe(1.0);
    });

    it('returns a small distance for nearly identical templates', () => {
      const dist = hammingDistance(templateA, templateACloseB64);
      expect(dist).toBeGreaterThan(0);
      expect(dist).toBeLessThan(0.01);
    });

    it('returns 1.0 for empty templates', () => {
      const empty = Buffer.alloc(0).toString('base64');
      expect(hammingDistance(empty, empty)).toBe(1.0);
    });
  });

  describe('findBestMatch()', () => {
    it('finds an exact match', () => {
      const enrolled = [
        { email: 'alice@shaavir.com', template: templateA },
        { email: 'bob@shaavir.com', template: templateB },
      ];
      const result = findBestMatch(templateA2, enrolled, 0.32);
      expect(result).not.toBeNull();
      expect(result!.email).toBe('alice@shaavir.com');
      expect(result!.distance).toBe(0);
    });

    it('finds a close match within threshold', () => {
      const enrolled = [{ email: 'alice@shaavir.com', template: templateA }];
      const result = findBestMatch(templateACloseB64, enrolled, 0.32);
      expect(result).not.toBeNull();
      expect(result!.email).toBe('alice@shaavir.com');
    });

    it('returns null when no match is within threshold', () => {
      const enrolled = [{ email: 'alice@shaavir.com', template: templateA }];
      const result = findBestMatch(templateB, enrolled, 0.32);
      expect(result).toBeNull();
    });
  });

  // ── Enrollment ──

  describe('POST /api/iris/enroll', () => {
    it('enrolls an iris template for an employee', async () => {
      const res = await request(app)
        .post('/api/iris/enroll')
        .send({ email: 'alice@shaavir.com', template: templateA })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.enrollment.status).toBe('enrolled');
    });

    it('re-enrolls (updates) an existing enrollment', async () => {
      await request(app).post('/api/iris/enroll')
        .send({ email: 'alice@shaavir.com', template: templateA })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).post('/api/iris/enroll')
        .send({ email: 'alice@shaavir.com', template: templateACloseB64 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('rejects missing email', async () => {
      const res = await request(app).post('/api/iris/enroll')
        .send({ template: templateA }).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing template', async () => {
      const res = await request(app).post('/api/iris/enroll')
        .send({ email: 'alice@shaavir.com' }).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects nonexistent employee', async () => {
      const res = await request(app).post('/api/iris/enroll')
        .send({ email: 'ghost@shaavir.com', template: templateA })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not found/i);
    });
  });

  // ── Status ──

  describe('GET /api/iris/status/:email', () => {
    it('returns not_enrolled for unregistered employee', async () => {
      const res = await request(app).get('/api/iris/status/alice@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.enrolled).toBe(false);
      expect(res.body.status).toBe('not_enrolled');
    });

    it('returns enrolled after enrollment', async () => {
      await request(app).post('/api/iris/enroll')
        .send({ email: 'alice@shaavir.com', template: templateA })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).get('/api/iris/status/alice@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.enrolled).toBe(true);
      expect(res.body.status).toBe('enrolled');
      expect(res.body.enrolledAt).toBeTruthy();
    });
  });

  // ── Removal ──

  describe('DELETE /api/iris/enrollment/:email', () => {
    it('removes an enrollment', async () => {
      await request(app).post('/api/iris/enroll')
        .send({ email: 'alice@shaavir.com', template: templateA })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).delete('/api/iris/enrollment/alice@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const status = await request(app).get('/api/iris/status/alice@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(status.body.enrolled).toBe(false);
    });

    it('returns error for non-enrolled employee', async () => {
      const res = await request(app).delete('/api/iris/enrollment/alice@shaavir.com')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  // ── Identification + Clock ──

  describe('POST /api/clock/iris', () => {
    beforeEach(async () => {
      // Enroll Alice and Bob with distinct templates
      await request(app).post('/api/iris/enroll')
        .send({ email: 'alice@shaavir.com', template: templateA })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app).post('/api/iris/enroll')
        .send({ email: 'bob@shaavir.com', template: templateB })
        .set('X-User-Email', 'admin@shaavir.com');
    });

    it('identifies Alice and clocks in', async () => {
      const res = await request(app).post('/api/clock/iris')
        .send({ template: templateA, action: 'in' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe('alice@shaavir.com');
      expect(res.body.name).toBe('Alice');
      expect(res.body.distance).toBe(0);
    });

    it('identifies Bob with his template', async () => {
      const res = await request(app).post('/api/clock/iris')
        .send({ template: templateB, action: 'in' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.email).toBe('bob@shaavir.com');
    });

    it('identifies Alice with a near-match template', async () => {
      const res = await request(app).post('/api/clock/iris')
        .send({ template: templateACloseB64, action: 'in' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.email).toBe('alice@shaavir.com');
      expect(res.body.distance).toBeGreaterThan(0);
      expect(res.body.distance).toBeLessThan(0.01);
    });

    it('rejects unknown template', async () => {
      const unknown = Buffer.alloc(256, 0x00).toString('base64');
      const res = await request(app).post('/api/clock/iris')
        .send({ template: unknown, action: 'in' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Nn]o matching/);
    });

    it('rejects missing template', async () => {
      const res = await request(app).post('/api/clock/iris')
        .send({ action: 'in' }).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects missing action', async () => {
      const res = await request(app).post('/api/clock/iris')
        .send({ template: templateA }).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('strips data URI prefix from template', async () => {
      const dataUri = 'data:application/octet-stream;base64,' + templateA;
      const res = await request(app).post('/api/clock/iris')
        .send({ template: dataUri, action: 'in' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.email).toBe('alice@shaavir.com');
    });
  });
});
