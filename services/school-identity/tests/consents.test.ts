import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolIdentityApp, type DomainEvent, type EventPublisher } from '../src/index';
import { staff, guardian, internalOnly, SECRET } from './helpers/auth';
import type { SchoolIdentitySqlite } from '../src/db';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

function studentPayload(overrides: Record<string, unknown> = {}) {
  return {
    admission_number: 'ADM-C1',
    first_name: 'Asha',
    last_name: 'Rao',
    dob: '2015-06-15',
    gender: 'female',
    admission_date: '2025-04-01',
    status: 'active',
    category: 'GEN',
    mother_name: 'Meera',
    father_name: 'Ravi',
    guardian_contact: '9876543210',
    ...overrides,
  };
}

describe('school-identity consents', () => {
  let app: Express;
  let db: SchoolIdentitySqlite;
  let publisher: RecordingPublisher;

  beforeEach(async () => {
    publisher = new RecordingPublisher();
    const created = await createSchoolIdentityApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      eventPublisher: publisher,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  async function seedStudent(admission = 'ADM-C1') {
    const res = await request(app)
      .post('/api/identity/t1/students').set(staff('admin'))
      .send(studentPayload({ admission_number: admission }));
    return res.body.id as string;
  }

  async function seedGuardian() {
    const res = await request(app).post('/api/identity/t1/guardians').set(staff('admin')).send({
      first_name: 'Meera',
      last_name: 'Rao',
      relation: 'mother',
      phone: '9876543210',
    });
    return res.body.id as string;
  }

  async function seedSession() {
    const res = await request(app).post('/api/identity/t1/sessions').set(staff('school_admin')).send({
      label: '2025-26',
      starts_on: '2025-04-01',
      ends_on: '2026-03-31',
    });
    return res.body.id as string;
  }

  it('lists implicit not_sought for all kinds', async () => {
    const studentId = await seedStudent();
    const res = await request(app).get(`/api/identity/t1/students/${studentId}/consents`).set(staff('admin'));
    expect(res.status).toBe(200);
    expect(res.body.consents).toHaveLength(5);
    expect(res.body.consents.every((c: { state: string }) => c.state === 'not_sought')).toBe(true);
  });

  it('allows valid transitions and writes audit + event', async () => {
    const studentId = await seedStudent('ADM-T1');
    const guardianId = await seedGuardian();

    const refuse = await request(app)
      .post(`/api/identity/t1/students/${studentId}/consents`).set(staff('admin'))
      .send({ kind: 'photo', state: 'refused', noted_by: 'admin@school' });
    expect(refuse.status).toBe(201);
    expect(refuse.body.state).toBe('refused');

    const grantPhoto = await request(app)
      .post(`/api/identity/t1/students/${studentId}/consents`).set(staff('admin'))
      .send({ kind: 'photo', state: 'granted', noted_by: 'admin@school' });
    expect(grantPhoto.status).toBe(201);

    const grantApaar = await request(app)
      .post(`/api/identity/t1/students/${studentId}/consents`).set(staff('admin'))
      .send({
        kind: 'apaar',
        state: 'granted',
        noted_by: 'admin@school',
        granted_by_guardian_id: guardianId,
        verification_method: 'digilocker',
        artefact_ref: 'storage://forms/apaar-1',
      });
    expect(grantApaar.status).toBe(201);

    const withdraw = await request(app)
      .post(`/api/identity/t1/students/${studentId}/consents`).set(staff('admin'))
      .send({ kind: 'apaar', state: 'withdrawn', noted_by: 'admin@school' });
    expect(withdraw.status).toBe(201);

    const audits = await db.all<{ to_state: string }>(
      'SELECT to_state FROM consent_audit WHERE tenant_id = ? AND consent_id = ?',
      [ 't1', grantApaar.body.id ],
    );
    expect(audits.length).toBeGreaterThanOrEqual(2);
    expect(publisher.events.some((e) => e.type === 'school.consent.changed')).toBe(true);
  });

  it('rejects invalid transitions and strict grant requirements', async () => {
    const studentId = await seedStudent('ADM-T2');
    const invalid = await request(app)
      .post(`/api/identity/t1/students/${studentId}/consents`).set(staff('admin'))
      .send({ kind: 'photo', state: 'withdrawn', noted_by: 'admin' });
    expect(invalid.status).toBe(409);

    const missing = await request(app)
      .post(`/api/identity/t1/students/${studentId}/consents`).set(staff('admin'))
      .send({ kind: 'apaar', state: 'granted', noted_by: 'admin' });
    expect(missing.status).toBe(400);
  });

  it('does not block enrolment when apaar is refused', async () => {
    const studentId = await seedStudent('ADM-REF');
    const sessionId = await seedSession();
    await request(app)
      .post(`/api/identity/t1/students/${studentId}/consents`).set(staff('admin'))
      .send({ kind: 'apaar', state: 'refused', noted_by: 'admin' });

    const enrol = await request(app)
      .post(`/api/identity/t1/students/${studentId}/enrol`).set(staff('admin'))
      .send({
        academic_session_id: sessionId,
        class_label: '5',
        section: 'A',
        roll_number: '1',
      });
    expect(enrol.status).toBe(201);
  });

  it('returns consent summary counts and isolates tenants', async () => {
    const s1 = await seedStudent('ADM-S1');
    await seedStudent('ADM-S2');
    await request(app)
      .post(`/api/identity/t1/students/${s1}/consents`).set(staff('admin'))
      .send({ kind: 'photo', state: 'refused', noted_by: 'admin' });

    const summary = await request(app).get('/api/identity/t1/consents/summary').set(staff('admin'));
    expect(summary.status).toBe(200);
    expect(summary.body.summary.photo.refused).toBe(1);
    expect(summary.body.summary.photo.not_sought).toBe(1);
    expect(summary.body.summary.apaar.not_sought).toBe(2);

    const other = await request(app).get('/api/identity/t2/consents/summary').set(staff('admin'));
    expect(other.body.summary.photo.refused).toBe(0);
    expect(other.body.summary.photo.not_sought).toBe(0);
  });
});
