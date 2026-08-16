import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import pino from 'pino';
import path from 'path';
import type { Express } from 'express';
import { createSchoolAcademicsApp } from '../src/index';
import type { SchoolAcademicsSqlite } from '../src/db';
import { StubTimetableClient } from '../src/clients/timetable-client';
import { staff } from './helpers/auth';

describe('school-academics L5 teacher scope (P12-05)', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;
  let timetable: StubTimetableClient;
  let topicId: string;

  beforeEach(async () => {
    timetable = new StubTimetableClient();
    const created = await createSchoolAcademicsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      timetableClient: timetable,
    });
    app = created.app;
    db = created.db;

    const course = await request(app)
      .post('/api/academics/t1/courses')
      .set(staff('school_admin'))
      .send({
        academic_session_id: 'ay-2025',
        board: 'cbse',
        subject_code: 'Sc',
        class_label: '8',
        label: 'Science 8',
      });
    expect(course.status).toBe(201);
    const unit = await request(app)
      .post(`/api/academics/t1/courses/${course.body.id}/units`)
      .set(staff('school_admin'))
      .send({ label: 'Unit 1', planned_weeks: 2 });
    expect(unit.status).toBe(201);
    const topic = await request(app)
      .post(`/api/academics/t1/units/${unit.body.id}/topics`)
      .set(staff('school_admin'))
      .send({ label: 'Topic A' });
    expect(topic.status).toBe(201);
    topicId = topic.body.id;
  });

  afterEach(async () => {
    await db.close();
  });

  it('teacher delivery allowed / denied / unverifiable; admin bypasses', async () => {
    timetable.allowed = true;
    const ok = await request(app)
      .post('/api/academics/t1/delivery')
      .set(staff('teacher', 'member-teacher-1'))
      .send({
        topic_id: topicId,
        period_instance_id: 'pi-1',
        section_ref: '8A',
        date: '2025-09-10',
        teacher_member_id: 'member-teacher-1',
      });
    expect(ok.status).toBe(201);
    expect(timetable.calls[0].sectionRef).toBe('8A');

    timetable.allowed = false;
    const denied = await request(app)
      .post('/api/academics/t1/delivery')
      .set(staff('teacher', 'member-teacher-1'))
      .send({
        topic_id: topicId,
        period_instance_id: 'pi-2',
        section_ref: '8B',
        date: '2025-09-11',
        teacher_member_id: 'member-teacher-1',
      });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('scope_denied');

    timetable.unverifiable = true;
    const down = await request(app)
      .post('/api/academics/t1/delivery')
      .set(staff('teacher', 'member-teacher-1'))
      .send({
        topic_id: topicId,
        period_instance_id: 'pi-3',
        section_ref: '8A',
        date: '2025-09-12',
        teacher_member_id: 'member-teacher-1',
      });
    expect(down.status).toBe(403);
    expect(down.body.error).toBe('scope_unverifiable');

    const before = timetable.calls.length;
    timetable.unverifiable = false;
    timetable.allowed = false;
    const admin = await request(app)
      .post('/api/academics/t1/delivery')
      .set(staff('school_admin'))
      .send({
        topic_id: topicId,
        period_instance_id: 'pi-4',
        section_ref: '8B',
        date: '2025-09-13',
        teacher_member_id: 'admin',
      });
    expect(admin.status).toBe(201);
    expect(timetable.calls.length).toBe(before);
  });
});
