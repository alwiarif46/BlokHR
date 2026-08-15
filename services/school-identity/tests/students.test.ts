import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolIdentityApp, type DomainEvent, type EventPublisher } from '../src/index';
import type { SchoolIdentitySqlite } from '../src/db';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

function studentPayload(overrides: Record<string, unknown> = {}) {
  return {
    admission_number: 'ADM-001',
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
    aadhaar_last4: '1234',
    ...overrides,
  };
}

describe('school-identity students', () => {
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

  async function seedSession(tenant = 't1') {
    const res = await request(app).post(`/api/identity/${tenant}/sessions`).send({
      label: '2025-26',
      starts_on: '2025-04-01',
      ends_on: '2026-03-31',
      is_current: true,
    });
    return res.body.id as string;
  }

  it('creates, reads, and patches a student', async () => {
    const created = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload());
    expect(created.status).toBe(201);
    expect(created.body.firstName).toBe('Asha');
    expect(created.body.aadhaarLast4).toBe('1234');

    const got = await request(app).get(`/api/identity/t1/students/${created.body.id}`);
    expect(got.status).toBe(200);
    expect(got.body.admissionNumber).toBe('ADM-001');

    const patched = await request(app)
      .patch(`/api/identity/t1/students/${created.body.id}`)
      .send({ first_name: 'Ashaa', status: 'admitted' });
    expect(patched.status).toBe(200);
    expect(patched.body.firstName).toBe('Ashaa');
    expect(patched.body.status).toBe('admitted');
  });

  it('rejects invalid enums and full aadhaar', async () => {
    const badGender = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload({ gender: 'nb' }));
    expect(badGender.status).toBe(400);

    const full = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload({ aadhaar: '123456789012' }));
    expect(full.status).toBe(400);
    expect(full.body.error).toBe('aadhaar_not_accepted');

    const twelveInField = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload({ mother_name: '123456789012' }));
    expect(twelveInField.status).toBe(400);
    expect(twelveInField.body.error).toBe('aadhaar_not_accepted');
  });

  it('rejects duplicate admission_number with 409', async () => {
    await request(app).post('/api/identity/t1/students').send(studentPayload());
    const dup = await request(app).post('/api/identity/t1/students').send(studentPayload());
    expect(dup.status).toBe(409);
  });

  it('rejects immutable admission_number on patch', async () => {
    const created = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload());
    const res = await request(app)
      .patch(`/api/identity/t1/students/${created.body.id}`)
      .send({ admission_number: 'OTHER' });
    expect(res.status).toBe(400);
  });

  it('enrols, rejects duplicate enrol, exits with events', async () => {
    const sessionId = await seedSession();
    const created = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload({ admission_number: 'ADM-E1' }));
    const studentId = created.body.id as string;

    const enrol = await request(app)
      .post(`/api/identity/t1/students/${studentId}/enrol`)
      .send({
        academic_session_id: sessionId,
        class_label: '5',
        section: 'A',
        roll_number: '12',
      });
    expect(enrol.status).toBe(201);
    expect(publisher.events.some((e) => e.type === 'school.student.enrolled')).toBe(true);

    const dup = await request(app)
      .post(`/api/identity/t1/students/${studentId}/enrol`)
      .send({
        academic_session_id: sessionId,
        class_label: '5',
        section: 'A',
        roll_number: '13',
      });
    expect(dup.status).toBe(409);

    const exit = await request(app)
      .post(`/api/identity/t1/students/${studentId}/exit`)
      .send({
        exited_on: '2025-12-01',
        exit_reason: 'Transferred',
        new_status: 'transferred',
      });
    expect(exit.status).toBe(200);
    expect(exit.body.status).toBe('transferred');
    expect(publisher.events.some((e) => e.type === 'school.student.exited')).toBe(true);
  });

  it('paginates student list', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/identity/t1/students')
        .send(studentPayload({ admission_number: `ADM-P${i}`, first_name: `Kid${i}` }));
    }
    const page = await request(app).get('/api/identity/t1/students?limit=2&offset=0');
    expect(page.status).toBe(200);
    expect(page.body.items).toHaveLength(2);
    expect(page.body.total).toBe(3);

    const q = await request(app).get('/api/identity/t1/students?q=Kid1');
    expect(q.body.total).toBe(1);
  });

  it('isolates students by tenant', async () => {
    await request(app)
      .post('/api/identity/tenant-a/students')
      .send(studentPayload({ admission_number: 'A-1' }));
    const b = await request(app).get('/api/identity/tenant-b/students');
    expect(b.body.total).toBe(0);
    const a = await request(app).get('/api/identity/tenant-a/students');
    expect(a.body.total).toBe(1);
  });
});
