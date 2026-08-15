import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createCaptureApp } from '../src/index';
import type { CaptureSqlite } from '../src/db';
import { MODULE_IDS } from '../src/types';

const logger = pino({ level: 'silent' });

describe('@blokhr/capture', () => {
  let app: Express;
  let db: CaptureSqlite;
  const modules = new Set<string>([
    MODULE_IDS.capture_qr,
    MODULE_IDS.capture_nfc,
    MODULE_IDS.capture_fingerprint_staff,
    MODULE_IDS.capture_face_adults,
    MODULE_IDS.school_roll_call,
  ]);
  const consents = new Map<string, string>();

  beforeEach(async () => {
    consents.clear();
    const created = await createCaptureApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger,
      tenantId: 'default',
      consent: {
        async validate(_t, ref, modality) {
          return consents.get(ref) === modality;
        },
      },
      entitlements: {
        async hasModule(_t, moduleId) {
          return modules.has(moduleId);
        },
      },
      routerOptions: { isAdmin: async (e) => e === 'admin@acme.com' },
    });
    app = created.app;
    db = created.db;
    await request(app)
      .put('/api/capture/jurisdiction')
      .send({ country: 'IN', vertical: 'hr', face_adults_enabled: true })
      .set('X-User-Email', 'admin@acme.com');
  });

  afterEach(async () => {
    await db.close();
  });

  it('session-token returns qr for web (empty device caps)', async () => {
    const res = await request(app).get('/api/capture/session-token?subject_type=staff');
    expect(res.body.available_modalities).toContain('qr');
    expect(res.body.available_modalities).not.toContain('fingerprint');
  });

  it('allows student fingerprint when module + DPIA + consent + finger_slot', async () => {
    modules.add(MODULE_IDS.capture_fingerprint_students);
    await request(app)
      .put('/api/capture/jurisdiction')
      .send({
        country: 'IN',
        vertical: 'school',
        face_students_dpia_ref: 'dpia_school_1',
      })
      .set('X-User-Email', 'admin@acme.com');
    consents.set('cns_stu_fp', 'fingerprint');
    const res = await request(app)
      .post('/api/capture/enrolments')
      .send({
        subject_ref: 'stu_1',
        subject_type: 'student',
        modality: 'fingerprint',
        payload_b64: Buffer.from('stu-tpl').toString('base64'),
        consent_ref: 'cns_stu_fp',
        finger_slot: 1,
      })
      .set('X-User-Email', 'admin@acme.com');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const token = await request(app).get(
      '/api/capture/session-token?subject_type=student&device_id=dev_fp',
    );
    // empty device until registered — register device with otg
    await request(app)
      .post('/api/capture/devices')
      .send({ id: 'dev_fp', name: 'Tablet', capabilities: ['otg_fingerprint', 'camera_qr'] })
      .set('X-User-Email', 'admin@acme.com');
    const token2 = await request(app).get(
      '/api/capture/session-token?subject_type=student&device_id=dev_fp',
    );
    expect(token2.body.available_modalities).toContain('fingerprint');
    void token;
  });

  it('blocks student fingerprint without module entitlement', async () => {
    modules.delete(MODULE_IDS.capture_fingerprint_students);
    consents.set('cns_x', 'fingerprint');
    const res = await request(app)
      .post('/api/capture/enrolments')
      .send({
        subject_ref: 'stu_1',
        subject_type: 'student',
        modality: 'fingerprint',
        payload_b64: Buffer.from('tpl').toString('base64'),
        consent_ref: 'cns_x',
        finger_slot: 1,
      })
      .set('X-User-Email', 'admin@acme.com');
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not entitled/i);
  });

  it('QR enrol + event match is idempotent', async () => {
    const payload = Buffer.from('CARD-001').toString('base64');
    const enrol = await request(app)
      .post('/api/capture/enrolments')
      .send({
        subject_ref: 'stu_1',
        subject_type: 'student',
        modality: 'qr',
        payload_b64: payload,
      })
      .set('X-User-Email', 'admin@acme.com');
    expect(enrol.body.success).toBe(true);

    const ev1 = await request(app)
      .post('/api/capture/events')
      .send({
        modality: 'qr',
        payload_b64: payload,
        idempotency_key: 'idem-1',
        context: { period_id: 'prd_1' },
      });
    expect(ev1.body.decision).toBe('matched');
    expect(ev1.body.subject_ref).toBe('stu_1');

    const ev2 = await request(app)
      .post('/api/capture/events')
      .send({
        modality: 'qr',
        payload_b64: payload,
        idempotency_key: 'idem-1',
      });
    expect(ev2.body.idempotent_replay).toBe(true);
  });

  it('requires consent_ref for biometric enrol', async () => {
    const res = await request(app)
      .post('/api/capture/enrolments')
      .send({
        subject_ref: 'mem_1',
        subject_type: 'staff',
        modality: 'face',
        payload_b64: Buffer.from('face').toString('base64'),
      })
      .set('X-User-Email', 'admin@acme.com');
    expect(res.status).toBe(400);
  });

  it('hard-blocks face in EU jurisdiction', async () => {
    await request(app)
      .put('/api/capture/jurisdiction')
      .send({ country: 'DE', face_adults_enabled: true })
      .set('X-User-Email', 'admin@acme.com');
    consents.set('cns_f', 'face');
    const res = await request(app)
      .post('/api/capture/enrolments')
      .send({
        subject_ref: 'mem_1',
        subject_type: 'staff',
        modality: 'face',
        payload_b64: Buffer.from('face').toString('base64'),
        consent_ref: 'cns_f',
      })
      .set('X-User-Email', 'admin@acme.com');
    expect(res.status).toBe(400);
    expect(String(res.body.error)).toMatch(/jurisdiction/i);
  });

  it('manual override after no_match', async () => {
    const miss = await request(app)
      .post('/api/capture/events')
      .send({
        modality: 'qr',
        payload_b64: Buffer.from('unknown').toString('base64'),
        idempotency_key: 'miss-1',
      });
    expect(miss.body.decision).toBe('no_match');
    const ov = await request(app)
      .post(`/api/capture/events/${miss.body.event_id}/manual-override`)
      .send({ subject_ref: 'stu_manual', reason: 'reader failed' })
      .set('X-User-Email', 'admin@acme.com');
    expect(ov.body.success).toBe(true);
  });

  it('issues temporary QR for lost card', async () => {
    const res = await request(app)
      .post('/api/capture/temporary-qr')
      .send({ subject_ref: 'stu_1', subject_type: 'student' })
      .set('X-User-Email', 'admin@acme.com');
    expect(res.body.success).toBe(true);
    expect(res.body.payloadB64).toBeTruthy();
  });
});
