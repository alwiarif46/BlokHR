import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import type { Express } from 'express';
import {
  createSchoolAcademicsApp,
  type DomainEvent,
  type EventPublisher,
  type SchoolAcademicsSqlite,
  type AcademicsService,
} from '../src/index';

class RecordingPublisher implements EventPublisher {
  events: DomainEvent[] = [];
  async publish(e: DomainEvent): Promise<void> {
    this.events.push(e);
  }
}

describe('syllabus pack install (P11-02)', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;
  let service: AcademicsService;
  let publisher: RecordingPublisher;

  beforeEach(async () => {
    publisher = new RecordingPublisher();
    const created = await createSchoolAcademicsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      packsDir: path.resolve(__dirname, 'fixtures/packs-install'),
      logger: pino({ level: 'silent' }),
      eventPublisher: publisher,
    });
    app = created.app;
    db = created.db;
    service = created.service;
  });

  afterEach(async () => {
    await db.close();
  });

  it('installs full pack and emits event', async () => {
    const res = await request(app)
      .post('/api/academics/t1/packs/cbse-2026-27/install').set(staff('school_admin'))
      .send({ academic_session_id: 'ay-1', installed_by: 'admin@school.test' });
    expect(res.status).toBe(201);
    expect(res.body.courses_created).toBe(3);
    expect(res.body.courses_skipped).toEqual([]);
    expect(res.body.installed_pack_id).toBeTruthy();

    const courses = await request(app).get('/api/academics/t1/courses').set(staff('school_admin'));
    expect(courses.body.courses).toHaveLength(3);

    expect(publisher.events.some((e) => e.type === 'school.pack.installed')).toBe(true);
  });

  it('installs subset by class/subject', async () => {
    const res = await request(app)
      .post('/api/academics/t1/packs/cbse-2026-27/install').set(staff('school_admin'))
      .send({
        academic_session_id: 'ay-1',
        installed_by: 'admin@school.test',
        classes: ['8'],
        subjects: ['Science'],
      });
    expect(res.status).toBe(201);
    expect(res.body.courses_created).toBe(1);
  });

  it('skips existing courses and returns ids', async () => {
    await request(app).post('/api/academics/t1/courses').set(staff('school_admin')).send({
      academic_session_id: 'ay-1',
      board: 'cbse',
      subject_code: 'Science',
      class_label: '8',
      label: 'Science 8 existing',
    });

    const res = await request(app)
      .post('/api/academics/t1/packs/cbse-2026-27/install').set(staff('school_admin'))
      .send({ academic_session_id: 'ay-1', installed_by: 'admin@school.test' });
    expect(res.status).toBe(201);
    expect(res.body.courses_created).toBe(2);
    expect(res.body.courses_skipped).toHaveLength(1);
    expect(res.body.courses_skipped[0]).toMatchObject({
      class_label: '8',
      subject_code: 'Science',
    });
    expect(res.body.courses_skipped[0].existing_course_id).toBeTruthy();
  });

  it('abort-on-invalid leaves zero new courses', async () => {
    const orig = service.importSyllabus.bind(service);
    let calls = 0;
    service.importSyllabus = async (tenantId, courseId, payload) => {
      calls += 1;
      if (calls === 2) {
        return { error: { error: 'forced_invalid', status: 400, errors: ['bad'] } };
      }
      return orig(tenantId, courseId, payload);
    };

    const res = await request(app)
      .post('/api/academics/t1/packs/cbse-2026-27/install').set(staff('school_admin'))
      .send({ academic_session_id: 'ay-1', installed_by: 'admin@school.test' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('install_failed');
    expect(res.body.errors?.length).toBeGreaterThan(0);

    const courses = await request(app).get('/api/academics/t1/courses').set(staff('school_admin'));
    expect(courses.body.courses).toHaveLength(0);
  });

  it('selection_empty returns 400', async () => {
    const res = await request(app)
      .post('/api/academics/t1/packs/cbse-2026-27/install').set(staff('school_admin'))
      .send({
        academic_session_id: 'ay-1',
        installed_by: 'admin@school.test',
        classes: ['99'],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('selection_empty');
  });

  it('lists installed with update_available', async () => {
    await db.close();
    publisher = new RecordingPublisher();
    const created = await createSchoolAcademicsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      packsDir: path.resolve(__dirname, 'fixtures/packs-update'),
      logger: pino({ level: 'silent' }),
      eventPublisher: publisher,
    });
    app = created.app;
    db = created.db;

    await request(app)
      .post('/api/academics/t1/packs/cbse-2026-27/install').set(staff('school_admin'))
      .send({ academic_session_id: 'ay-1', installed_by: 'a@b.c' });

    const list = await request(app).get('/api/academics/t1/packs/installed').set(staff('school_admin'));
    expect(list.status).toBe(200);
    expect(list.body.installed).toHaveLength(1);
    expect(list.body.installed[0].update_available).toBe('cbse-2027-28');
    expect(list.body.installed[0].course_count).toBe(1);

    const other = await request(app).get('/api/academics/t2/packs/installed').set(staff('school_admin'));
    expect(other.body.installed).toEqual([]);
  });

  it('404 unknown pack', async () => {
    const res = await request(app)
      .post('/api/academics/t1/packs/missing/install').set(staff('school_admin'))
      .send({ academic_session_id: 'ay-1', installed_by: 'a@b.c' });
    expect(res.status).toBe(404);
  });
});
