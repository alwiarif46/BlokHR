import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import path from 'path';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import * as XLSX from 'xlsx';
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

function workbookBase64(
  sheets: Array<{ name: string; rows: unknown[][] }>,
): string {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(s.rows), s.name);
  }
  return XLSX.write(wb, { type: 'base64', bookType: 'xlsx' }) as string;
}

const SYLLABUS_HEADER = [
  'Class',
  'Subject',
  'Unit',
  'Topic',
  'Planned Weeks',
  'Estimated Periods',
];

function syllabusRows(): unknown[][] {
  return [
    SYLLABUS_HEADER,
    ['8', 'Science', 'Motion', 'Speed', 2, 2],
    ['8', 'Science', 'Motion', 'Velocity', 2, 1],
    ['8', 'Science', 'Force', 'Newton', 2, 2],
    ['9', 'Science', 'Atoms', 'Structure', 2, 2],
    ['9', 'Mathematics', 'Algebra', 'Equations', 2, 2],
  ];
}

describe('syllabus upload (custom + optional lessons)', () => {
  let app: Express;
  let db: SchoolAcademicsSqlite;
  let service: AcademicsService;
  let publisher: RecordingPublisher;

  beforeEach(async () => {
    publisher = new RecordingPublisher();
    const created = await createSchoolAcademicsApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      packsDir: path.resolve(__dirname, 'fixtures/packs-empty'),
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

  it('uploads syllabus-only workbook', async () => {
    const contentBase64 = workbookBase64([
      { name: 'Syllabus', rows: syllabusRows() },
    ]);
    const res = await request(app)
      .post('/api/academics/t1/syllabus/upload').set(staff('school_admin'))
      .send({
        filename: 'own.xlsx',
        contentBase64,
        academic_session_id: 'ay-1',
        installed_by: 'admin@school.test',
        board: 'cbse',
      });
    expect(res.status).toBe(201);
    expect(res.body.courses_created).toBe(3);
    expect(res.body.classes_in_file).toEqual(['8', '9']);
    expect(res.body.lessons_created).toBe(0);

    const courses = await request(app).get('/api/academics/t1/courses').set(staff('school_admin'));
    expect(courses.body.courses).toHaveLength(3);
    expect(publisher.events.some((e) => e.type === 'school.syllabus.uploaded')).toBe(
      true,
    );
  });

  it('filters by selected classes', async () => {
    const contentBase64 = workbookBase64([
      { name: 'Syllabus', rows: syllabusRows() },
    ]);
    const res = await request(app)
      .post('/api/academics/t1/syllabus/upload').set(staff('school_admin'))
      .send({
        filename: 'own.xlsx',
        contentBase64,
        academic_session_id: 'ay-1',
        installed_by: 'admin@school.test',
        board: 'cbse',
        classes: ['8'],
      });
    expect(res.status).toBe(201);
    expect(res.body.courses_created).toBe(1);
  });

  it('skips existing courses', async () => {
    await request(app).post('/api/academics/t1/courses').set(staff('school_admin')).send({
      academic_session_id: 'ay-1',
      board: 'cbse',
      subject_code: 'Science',
      class_label: '8',
      label: 'Science 8 existing',
    });

    const contentBase64 = workbookBase64([
      { name: 'Syllabus', rows: syllabusRows() },
    ]);
    const res = await request(app)
      .post('/api/academics/t1/syllabus/upload').set(staff('school_admin'))
      .send({
        filename: 'own.xlsx',
        contentBase64,
        academic_session_id: 'ay-1',
        installed_by: 'admin@school.test',
        board: 'cbse',
        classes: ['8'],
      });
    expect(res.status).toBe(201);
    expect(res.body.courses_created).toBe(0);
    expect(res.body.courses_skipped).toHaveLength(1);
    expect(res.body.courses_skipped[0].existing_course_id).toBeTruthy();
  });

  it('selection_empty when no matching classes', async () => {
    const contentBase64 = workbookBase64([
      { name: 'Syllabus', rows: syllabusRows() },
    ]);
    const res = await request(app)
      .post('/api/academics/t1/syllabus/upload').set(staff('school_admin'))
      .send({
        filename: 'own.xlsx',
        contentBase64,
        academic_session_id: 'ay-1',
        installed_by: 'admin@school.test',
        board: 'cbse',
        classes: ['99'],
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('selection_empty');
  });

  it('abort leaves zero courses', async () => {
    const orig = service.importSyllabus.bind(service);
    let calls = 0;
    service.importSyllabus = async (tenantId, courseId, payload) => {
      calls += 1;
      if (calls === 1) {
        return { error: { error: 'forced', status: 400, errors: ['bad'] } };
      }
      return orig(tenantId, courseId, payload);
    };

    const contentBase64 = workbookBase64([
      { name: 'Syllabus', rows: syllabusRows() },
    ]);
    const res = await request(app)
      .post('/api/academics/t1/syllabus/upload').set(staff('school_admin'))
      .send({
        filename: 'own.xlsx',
        contentBase64,
        academic_session_id: 'ay-1',
        installed_by: 'admin@school.test',
        board: 'cbse',
      });
    expect(res.status).toBe(400);
    const courses = await request(app).get('/api/academics/t1/courses').set(staff('school_admin'));
    expect(courses.body.courses).toHaveLength(0);
  });

  it('imports optional lesson plans with soft skips', async () => {
    const contentBase64 = workbookBase64([
      { name: 'Syllabus', rows: syllabusRows() },
      {
        name: 'Lesson Plans',
        rows: [
          [
            'Class',
            'Subject',
            'Unit',
            'Topic',
            'Date',
            'Title',
            'Objectives',
            'Activities',
          ],
          // Minimal: only identity + date — body fields empty
          ['8', 'Science', 'Motion', '', '2026-04-07', '', '', ''],
          // Missing date → warning
          ['8', 'Science', 'Motion', 'Speed', '', 'No date', '', ''],
          // Missing class → warning
          ['', 'Science', 'Motion', 'Speed', '2026-04-08', 'Bad', '', ''],
        ],
      },
    ]);

    const res = await request(app)
      .post('/api/academics/t1/syllabus/upload').set(staff('school_admin'))
      .send({
        filename: 'own.xlsx',
        contentBase64,
        academic_session_id: 'ay-1',
        installed_by: 'admin@school.test',
        board: 'cbse',
        classes: ['8'],
      });
    expect(res.status).toBe(201);
    expect(res.body.courses_created).toBe(1);
    expect(res.body.lessons_created).toBe(1);
    expect(res.body.lessons_skipped).toBeGreaterThanOrEqual(2);
    expect(res.body.lesson_warnings.length).toBeGreaterThanOrEqual(2);

    const lessons = await request(app).get(
      '/api/academics/t1/lessons?teacher_member_id=' +
        encodeURIComponent('admin@school.test'),
    ).set(staff('school_admin'));
    expect(lessons.status).toBe(200);
    expect(lessons.body.lessons.length).toBeGreaterThanOrEqual(1);
    const draft = lessons.body.lessons[0];
    expect(draft.state).toBe('draft');
    expect(draft.title).toBe('Lesson plan');
  });

  it('tenant isolation', async () => {
    const contentBase64 = workbookBase64([
      { name: 'Syllabus', rows: syllabusRows() },
    ]);
    await request(app)
      .post('/api/academics/t1/syllabus/upload').set(staff('school_admin'))
      .send({
        filename: 'own.xlsx',
        contentBase64,
        academic_session_id: 'ay-1',
        installed_by: 'a@b.c',
        board: 'cbse',
      });
    const other = await request(app).get('/api/academics/t2/courses').set(staff('school_admin'));
    expect(other.body.courses).toHaveLength(0);
  });
});
