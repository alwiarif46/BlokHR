import path from 'path';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { staff } from './helpers/auth';
import pino from 'pino';
import type { Express } from 'express';
import {
  createSchoolSurveysApp,
  type SchoolSurveysSqlite,
} from '../src/index';

const SECRET = 'test-internal-secret';

function guardianHeaders(guardianId: string, students: string[]) {
  return {
    'X-Blok-Internal': SECRET,
    'X-Blok-Principal': 'guardian',
    'X-Blok-Guardian': guardianId,
    'X-Blok-Students': students.join(','),
  };
}

describe('school-surveys', () => {
  let app: Express;
  let db: SchoolSurveysSqlite;

  beforeEach(async () => {
    const created = await createSchoolSurveysApp({
      dbPath: ':memory:',
      migrationsDir: path.resolve(__dirname, '../migrations'),
      logger: pino({ level: 'silent' }),
      internalSecret: SECRET,
    });
    app = created.app;
    db = created.db;
  });

  afterEach(async () => {
    await db.close();
  });

  it('creates, lists, publishes, and closes a survey', async () => {
    const created = await request(app).post('/api/surveys/t1').set(staff('school_admin')).send({
      title: 'Parent pulse',
      questions: [{ key: 'q1', label: 'Happy?', type: 'yesno' }],
    });
    expect(created.status).toBe(201);
    expect(created.body.survey.title).toBe('Parent pulse');
    expect(created.body.survey.status).toBe('draft');

    const list = await request(app).get('/api/surveys/t1').set(staff('school_admin'));
    expect(list.body.surveys).toHaveLength(1);

    const pub = await request(app).post(
      `/api/surveys/t1/${created.body.survey.id}/publish`,
    ).set(staff('school_admin'));
    expect(pub.status).toBe(200);

    const close = await request(app).post(
      `/api/surveys/t1/${created.body.survey.id}/close`,
    ).set(staff('school_admin'));
    expect(close.status).toBe(200);
  });

  it('rejects invalid question type', async () => {
    const res = await request(app).post('/api/surveys/t1').set(staff('school_admin')).send({
      title: 'Bad',
      questions: [{ key: 'q1', label: 'X', type: 'emoji' }],
    });
    expect(res.status).toBe(400);
  });

  it('enforces tenant isolation', async () => {
    const a = await request(app).post('/api/surveys/tA').set(staff('school_admin')).send({ title: 'Secret' });
    const id = a.body.survey.id as string;
    expect((await request(app).get(`/api/surveys/tB/${id}`).set(staff('school_admin'))).status).toBe(404);
    expect((await request(app).get('/api/surveys/tB').set(staff('school_admin'))).body.surveys).toEqual([]);
  });

  it('filters guardian pending by X-Blok-Students and ignores spoofed guardian_ref', async () => {
    const created = await request(app).post('/api/surveys/t1').set(staff('school_admin')).send({
      title: 'Class survey',
      target_kind: 'students',
      student_refs: ['s1', 's2'],
      questions: [{ key: 'nps', label: 'Recommend?', type: 'nps' }],
    });
    const id = created.body.survey.id as string;
    await request(app).post(`/api/surveys/t1/${id}/publish`).set(staff('school_admin'));

    const pending = await request(app)
      .get('/api/surveys/t1/guardian/pending').set(staff('school_admin'))
      .set(guardianHeaders('g-real', ['s1']));
    expect(pending.status).toBe(200);
    expect(pending.body.surveys).toHaveLength(1);

    const none = await request(app)
      .get('/api/surveys/t1/guardian/pending').set(staff('school_admin'))
      .set(guardianHeaders('g-other', ['s9']));
    expect(none.body.surveys).toHaveLength(0);

    const spoof = await request(app)
      .post(`/api/surveys/t1/guardian/surveys/${id}/respond`).set(staff('school_admin'))
      .set(guardianHeaders('g-real', ['s1']))
      .send({
        guardian_ref: 'g-spoof',
        student_ref: 's1',
        answers: { nps: 9 },
      });
    expect(spoof.status).toBe(200);

    const again = await request(app)
      .post(`/api/surveys/t1/guardian/surveys/${id}/respond`).set(staff('school_admin'))
      .set(guardianHeaders('g-real', ['s1']))
      .send({ student_ref: 's1', answers: { nps: 8 } });
    expect(again.status).toBe(400);
    expect(again.body.error).toMatch(/already/i);
  });

  it('returns 401 without X-Blok-Internal for guardian routes', async () => {
    const res = await request(app)
      .get('/api/surveys/t1/guardian/pending')
      .set('X-Blok-Principal', 'guardian')
      .set('X-Blok-Guardian', 'g1');
    expect(res.status).toBe(401);
  });

  it('rejects respond for unlinked student', async () => {
    const created = await request(app).post('/api/surveys/t1').set(staff('school_admin')).send({
      title: 'Targeted',
      target_kind: 'students',
      student_refs: ['s1'],
    });
    const id = created.body.survey.id as string;
    await request(app).post(`/api/surveys/t1/${id}/publish`).set(staff('school_admin'));

    const res = await request(app)
      .post(`/api/surveys/t1/guardian/surveys/${id}/respond`)
      .set(guardianHeaders('g1', ['s1']))
      .send({ student_ref: 's-other', answers: { q: 1 } });
    expect(res.status).toBe(403);
  });
});
