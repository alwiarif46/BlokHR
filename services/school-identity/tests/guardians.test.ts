import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolIdentityApp } from '../src/index';
import type { SchoolIdentitySqlite } from '../src/db';

function studentPayload(overrides: Record<string, unknown> = {}) {
  return {
    admission_number: 'ADM-G1',
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

function guardianPayload(overrides: Record<string, unknown> = {}) {
  return {
    first_name: 'Meera',
    last_name: 'Rao',
    relation: 'mother',
    phone: '9876543210',
    email: 'meera@example.com',
    preferred_language: 'en',
    ...overrides,
  };
}

describe('school-identity guardians', () => {
  let app: Express;
  let db: SchoolIdentitySqlite;

  beforeEach(async () => {
    const created = await createSchoolIdentityApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('CRUD guardians and validates phone/email', async () => {
    const created = await request(app)
      .post('/api/identity/t1/guardians')
      .send(guardianPayload());
    expect(created.status).toBe(201);
    expect(created.body.phone).toBe('9876543210');

    const e164 = await request(app)
      .post('/api/identity/t1/guardians')
      .send(guardianPayload({ phone: '+919876543210', first_name: 'Ravi', relation: 'father' }));
    expect(e164.status).toBe(201);

    const badPhone = await request(app)
      .post('/api/identity/t1/guardians')
      .send(guardianPayload({ phone: '12345' }));
    expect(badPhone.status).toBe(400);

    const badEmail = await request(app)
      .post('/api/identity/t1/guardians')
      .send(guardianPayload({ email: 'not-an-email', phone: '9123456780' }));
    expect(badEmail.status).toBe(400);

    const patched = await request(app)
      .patch(`/api/identity/t1/guardians/${created.body.id}`)
      .send({ preferred_language: 'hi' });
    expect(patched.status).toBe(200);
    expect(patched.body.preferredLanguage).toBe('hi');

    const list = await request(app).get('/api/identity/t1/guardians');
    expect(list.body.guardians.length).toBeGreaterThanOrEqual(2);
  });

  it('links guardians with primary exclusivity and max-4', async () => {
    const student = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload({ status: 'enquiry' }));
    const studentId = student.body.id as string;

    const ids: string[] = [];
    for (let i = 0; i < 4; i++) {
      const g = await request(app)
        .post('/api/identity/t1/guardians')
        .send(
          guardianPayload({
            first_name: `G${i}`,
            phone: `9${String(i).padStart(9, '0')}`,
            email: null,
          }),
        );
      ids.push(g.body.id);
    }

    await request(app)
      .post(`/api/identity/t1/students/${studentId}/guardians`)
      .send({ guardian_id: ids[0], is_primary: true });
    await request(app)
      .post(`/api/identity/t1/students/${studentId}/guardians`)
      .send({ guardian_id: ids[1], is_primary: true });

    const linked = await request(app).get(`/api/identity/t1/students/${studentId}/guardians`);
    expect(linked.body.guardians).toHaveLength(2);
    const primaries = linked.body.guardians.filter((g: { isPrimary: boolean }) => g.isPrimary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].id).toBe(ids[1]);

    await request(app)
      .post(`/api/identity/t1/students/${studentId}/guardians`)
      .send({ guardian_id: ids[2] });
    await request(app)
      .post(`/api/identity/t1/students/${studentId}/guardians`)
      .send({ guardian_id: ids[3] });

    const fifth = await request(app)
      .post('/api/identity/t1/guardians')
      .send(guardianPayload({ first_name: 'Extra', phone: '9555555555', email: null }));
    const over = await request(app)
      .post(`/api/identity/t1/students/${studentId}/guardians`)
      .send({ guardian_id: fifth.body.id });
    expect(over.status).toBe(400);
  });

  it('refuses removing last guardian of an active student', async () => {
    const student = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload({ status: 'active', admission_number: 'ADM-ACT' }));
    const g = await request(app).post('/api/identity/t1/guardians').send(guardianPayload());
    await request(app)
      .post(`/api/identity/t1/students/${student.body.id}/guardians`)
      .send({ guardian_id: g.body.id, is_primary: true });

    const del = await request(app).delete(
      `/api/identity/t1/students/${student.body.id}/guardians/${g.body.id}`,
    );
    expect(del.status).toBe(409);
    expect(del.body.error).toBe('last_guardian');
  });

  it('lists siblings for a guardian and isolates tenants', async () => {
    const g = await request(app).post('/api/identity/t1/guardians').send(guardianPayload());
    const s1 = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload({ admission_number: 'S1', status: 'enquiry' }));
    const s2 = await request(app)
      .post('/api/identity/t1/students')
      .send(studentPayload({ admission_number: 'S2', status: 'enquiry', first_name: 'Bala' }));
    await request(app)
      .post(`/api/identity/t1/students/${s1.body.id}/guardians`)
      .send({ guardian_id: g.body.id });
    await request(app)
      .post(`/api/identity/t1/students/${s2.body.id}/guardians`)
      .send({ guardian_id: g.body.id });

    const siblings = await request(app).get(`/api/identity/t1/guardians/${g.body.id}/students`);
    expect(siblings.status).toBe(200);
    expect(siblings.body.students).toHaveLength(2);

    const other = await request(app).get(`/api/identity/t2/guardians/${g.body.id}/students`);
    expect(other.status).toBe(404);
  });
});
