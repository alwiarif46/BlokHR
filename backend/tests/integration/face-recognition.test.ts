import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';
import type { MockFaceApiClient } from '../../src/services/face-recognition';

describe('Facial Recognition Module', () => {
  let app: Express;
  let db: DatabaseEngine;
  let mockFaceApi: MockFaceApiClient;

  const EMAIL = 'alice@shaavir.com';
  // A tiny valid base64 string (1x1 white pixel PNG)
  const FAKE_IMAGE =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    mockFaceApi = setup.mockFaceApi;

    await seedMember(db, {
      email: EMAIL,
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
      groupShiftStart: '00:00',
      groupShiftEnd: '23:59',
    });

    // Default mock: returns a single detected face with high-confidence match
    mockFaceApi.setConfig({
      createPersonResult: 'azure-person-alice',
      addFaceResult: 'azure-face-001',
      detectResult: [
        { faceId: 'detected-face-001', faceRectangle: { top: 0, left: 0, width: 100, height: 100 } },
      ],
      identifyResult: [
        {
          faceId: 'detected-face-001',
          candidates: [{ personId: 'azure-person-alice', confidence: 0.92 }],
        },
      ],
    });
  });

  afterEach(async () => {
    mockFaceApi.resetCalls();
    await db.close();
  });

  // ── Enrollment ──

  describe('POST /api/face/enroll', () => {
    it('enrolls a face for an active employee', async () => {
      const res = await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.enrollment.email).toBe(EMAIL);
      expect(res.body.enrollment.status).toBe('enrolled');
      expect(res.body.enrollment.azure_person_id).toBe('azure-person-alice');

      // Verify API calls were made in order
      const methods = mockFaceApi.calls.map((c) => c.method);
      expect(methods).toContain('createPersonGroup');
      expect(methods).toContain('createPerson');
      expect(methods).toContain('addPersonFace');
      expect(methods).toContain('trainPersonGroup');
    });

    it('rejects duplicate enrollment', async () => {
      await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      const res = await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('already enrolled');
    });

    it('rejects enrollment for non-existent employee', async () => {
      const res = await request(app)
        .post('/api/face/enroll')
        .send({ email: 'nobody@shaavir.com', image: FAKE_IMAGE });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('not found');
    });

    it('rejects missing email', async () => {
      const res = await request(app)
        .post('/api/face/enroll')
        .send({ image: FAKE_IMAGE });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('email');
    });

    it('rejects missing image', async () => {
      const res = await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('image');
    });

    it('saves failed enrollment when API throws', async () => {
      mockFaceApi.setConfig({
        shouldThrow: new Error('Azure service unavailable'),
      });

      const res = await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Enrollment failed');

      // Verify the enrollment is recorded as failed
      const statusRes = await request(app).get(`/api/face/status/${EMAIL}`);
      expect(statusRes.body.status).toBe('failed');
      expect(statusRes.body.errorMessage).toContain('Azure service unavailable');
    });

    it('allows re-enrollment after a failed attempt', async () => {
      // First attempt: fails
      mockFaceApi.setConfig({ shouldThrow: new Error('temp failure') });
      await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      // Second attempt: succeeds
      mockFaceApi.setConfig({ createPersonResult: 'azure-person-alice-v2' });
      const res = await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      expect(res.status).toBe(201);
      expect(res.body.enrollment.status).toBe('enrolled');
    });
  });

  // ── Identification + Clock ──

  describe('POST /api/clock/face', () => {
    /** Enroll alice before identification tests. */
    async function enrollAlice(): Promise<void> {
      mockFaceApi.setConfig({ createPersonResult: 'azure-person-alice' });
      await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      // Reset calls and set identification config
      mockFaceApi.resetCalls();
      mockFaceApi.setConfig({
        detectResult: [
          { faceId: 'det-001', faceRectangle: { top: 0, left: 0, width: 100, height: 100 } },
        ],
        identifyResult: [
          {
            faceId: 'det-001',
            candidates: [{ personId: 'azure-person-alice', confidence: 0.92 }],
          },
        ],
      });
    }

    it('identifies and clocks in via face', async () => {
      await enrollAlice();

      const res = await request(app)
        .post('/api/clock/face')
        .send({ image: FAKE_IMAGE, action: 'in' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe(EMAIL);
      expect(res.body.name).toBe('Alice');
      expect(res.body.confidence).toBe(0.92);
      expect(res.body.clockResult.success).toBe(true);
    });

    it('identifies and clocks out via face', async () => {
      await enrollAlice();

      // Clock in first
      await request(app)
        .post('/api/clock/face')
        .send({ image: FAKE_IMAGE, action: 'in' });

      const res = await request(app)
        .post('/api/clock/face')
        .send({ image: FAKE_IMAGE, action: 'out' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe(EMAIL);
    });

    it('rejects when no face is detected', async () => {
      await enrollAlice();
      mockFaceApi.setConfig({ detectResult: [] });

      const res = await request(app)
        .post('/api/clock/face')
        .send({ image: FAKE_IMAGE, action: 'in' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('No face detected');
    });

    it('rejects when multiple faces are detected', async () => {
      await enrollAlice();
      mockFaceApi.setConfig({
        detectResult: [
          { faceId: 'f1', faceRectangle: { top: 0, left: 0, width: 50, height: 50 } },
          { faceId: 'f2', faceRectangle: { top: 0, left: 60, width: 50, height: 50 } },
        ],
      });

      const res = await request(app)
        .post('/api/clock/face')
        .send({ image: FAKE_IMAGE, action: 'in' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Multiple faces');
    });

    it('rejects when confidence is below threshold', async () => {
      await enrollAlice();
      mockFaceApi.setConfig({
        detectResult: [
          { faceId: 'det-001', faceRectangle: { top: 0, left: 0, width: 100, height: 100 } },
        ],
        identifyResult: [
          {
            faceId: 'det-001',
            candidates: [{ personId: 'azure-person-alice', confidence: 0.3 }],
          },
        ],
      });

      const res = await request(app)
        .post('/api/clock/face')
        .send({ image: FAKE_IMAGE, action: 'in' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('confidence too low');
      expect(res.body.confidence).toBe(0.3);
    });

    it('rejects when face is not recognized (no candidates)', async () => {
      await enrollAlice();
      mockFaceApi.setConfig({
        detectResult: [
          { faceId: 'det-001', faceRectangle: { top: 0, left: 0, width: 100, height: 100 } },
        ],
        identifyResult: [
          { faceId: 'det-001', candidates: [] },
        ],
      });

      const res = await request(app)
        .post('/api/clock/face')
        .send({ image: FAKE_IMAGE, action: 'in' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('not recognized');
    });

    it('rejects invalid action', async () => {
      const res = await request(app)
        .post('/api/clock/face')
        .send({ image: FAKE_IMAGE, action: 'dance' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid action');
    });

    it('rejects missing image', async () => {
      const res = await request(app)
        .post('/api/clock/face')
        .send({ action: 'in' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('image');
    });

    it('rejects missing action', async () => {
      const res = await request(app)
        .post('/api/clock/face')
        .send({ image: FAKE_IMAGE });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('action');
    });

    it('handles data URI prefix in base64 image', async () => {
      await enrollAlice();

      const res = await request(app)
        .post('/api/clock/face')
        .send({ image: `data:image/png;base64,${FAKE_IMAGE}`, action: 'in' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.email).toBe(EMAIL);
    });
  });

  // ── Status ──

  describe('GET /api/face/status/:email', () => {
    it('returns not_enrolled for unknown employee', async () => {
      const res = await request(app).get(`/api/face/status/${EMAIL}`);

      expect(res.status).toBe(200);
      expect(res.body.enrolled).toBe(false);
      expect(res.body.status).toBe('not_enrolled');
    });

    it('returns enrolled after successful enrollment', async () => {
      await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      const res = await request(app).get(`/api/face/status/${EMAIL}`);

      expect(res.status).toBe(200);
      expect(res.body.enrolled).toBe(true);
      expect(res.body.status).toBe('enrolled');
      expect(res.body.enrolledAt).toBeTruthy();
    });
  });

  // ── Deletion ──

  describe('DELETE /api/face/enrollment/:email', () => {
    it('removes an existing enrollment', async () => {
      await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      const res = await request(app).delete(`/api/face/enrollment/${EMAIL}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify it's gone
      const statusRes = await request(app).get(`/api/face/status/${EMAIL}`);
      expect(statusRes.body.enrolled).toBe(false);
      expect(statusRes.body.status).toBe('not_enrolled');
    });

    it('returns 404 when no enrollment exists', async () => {
      const res = await request(app).delete(`/api/face/enrollment/${EMAIL}`);
      expect(res.status).toBe(404);
    });

    it('allows re-enrollment after deletion', async () => {
      // Enroll, delete, re-enroll
      await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      await request(app).delete(`/api/face/enrollment/${EMAIL}`);

      mockFaceApi.setConfig({ createPersonResult: 'azure-person-alice-v2' });
      const res = await request(app)
        .post('/api/face/enroll')
        .send({ email: EMAIL, image: FAKE_IMAGE });

      expect(res.status).toBe(201);
      expect(res.body.enrollment.status).toBe('enrolled');
    });
  });
});
