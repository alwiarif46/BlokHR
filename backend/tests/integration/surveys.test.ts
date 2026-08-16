import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Employee Surveys Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, { email: 'admin@shaavir.com', name: 'Admin' });
    await seedMember(db, { email: 'alice@shaavir.com', name: 'Alice' });
    await seedMember(db, { email: 'bob@shaavir.com', name: 'Bob' });
    await seedMember(db, { email: 'carol@shaavir.com', name: 'Carol' });
    await db.run('INSERT OR IGNORE INTO admins (email) VALUES (?)', ['admin@shaavir.com']);
  });

  afterEach(async () => {
    await db.close();
  });

  describe('POST /api/surveys', () => {
    it('creates a survey', async () => {
      const res = await request(app)
        .post('/api/surveys')
        .send({
          title: 'Quarterly Pulse',
          questions: [{ key: 'q1', label: 'How satisfied are you?', type: 'scale' }],
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.survey.title).toBe('Quarterly Pulse');
      expect(res.body.survey.status).toBe('draft');
    });

    it('rejects missing title', async () => {
      const res = await request(app)
        .post('/api/surveys')
        .send({})
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects invalid question type', async () => {
      const res = await request(app)
        .post('/api/surveys')
        .send({
          title: 'Bad Q',
          questions: [{ key: 'q1', label: 'Hi', type: 'emoji' }],
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/type/i);
    });

    it('rejects non-admin create', async () => {
      const res = await request(app)
        .post('/api/surveys')
        .send({ title: 'Nope' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/surveys/:id', () => {
    it('updates a draft survey', async () => {
      const created = await request(app)
        .post('/api/surveys')
        .send({ title: 'Draft' })
        .set('X-User-Email', 'admin@shaavir.com');
      const id = created.body.survey.id as string;

      const res = await request(app)
        .put(`/api/surveys/${id}`)
        .send({
          title: 'Updated Draft',
          questions: [{ key: 'nps', label: 'Recommend?', type: 'nps' }],
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.survey.title).toBe('Updated Draft');
      const qs = JSON.parse(res.body.survey.questions_json as string);
      expect(qs[0].key).toBe('nps');
    });

    it('rejects editing an active survey', async () => {
      const created = await request(app)
        .post('/api/surveys')
        .send({ title: 'Live' })
        .set('X-User-Email', 'admin@shaavir.com');
      const id = created.body.survey.id as string;
      await request(app)
        .post(`/api/surveys/${id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put(`/api/surveys/${id}`)
        .send({ title: 'Nope' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('Survey lifecycle', () => {
    let surveyId: string;
    beforeEach(async () => {
      const r = await request(app)
        .post('/api/surveys')
        .send({ title: 'Test Survey' })
        .set('X-User-Email', 'admin@shaavir.com');
      surveyId = r.body.survey.id;
    });

    it('publishes a draft survey', async () => {
      const res = await request(app)
        .post(`/api/surveys/${surveyId}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
      const fetched = await request(app)
        .get(`/api/surveys/${surveyId}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.survey.status).toBe('active');
    });

    it('closes an active survey', async () => {
      await request(app)
        .post(`/api/surveys/${surveyId}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app)
        .post(`/api/surveys/${surveyId}/close`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('deletes a draft survey', async () => {
      const res = await request(app)
        .delete(`/api/surveys/${surveyId}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
    });

    it('rejects deleting an active survey', async () => {
      await request(app)
        .post(`/api/surveys/${surveyId}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app)
        .delete(`/api/surveys/${surveyId}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('Anonymous responses', () => {
    let surveyId: string;
    beforeEach(async () => {
      const r = await request(app)
        .post('/api/surveys')
        .send({ title: 'Anon Survey', anonymous: true })
        .set('X-User-Email', 'admin@shaavir.com');
      surveyId = r.body.survey.id;
      await request(app)
        .post(`/api/surveys/${surveyId}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
    });

    it('accepts a response', async () => {
      const res = await request(app)
        .post(`/api/surveys/${surveyId}/respond`)
        .send({ answers: { q1: 4, q2: 'Great culture' } })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.response.survey_id).toBe(surveyId);
    });

    it('rejects duplicate response', async () => {
      await request(app)
        .post(`/api/surveys/${surveyId}/respond`)
        .send({ answers: { q1: 5 } })
        .set('X-User-Email', 'alice@shaavir.com');
      const res = await request(app)
        .post(`/api/surveys/${surveyId}/respond`)
        .send({ answers: { q1: 3 } })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Aa]lready/);
    });

    it('responses do not contain email', async () => {
      await request(app)
        .post(`/api/surveys/${surveyId}/respond`)
        .send({ answers: { q1: 5 } })
        .set('X-User-Email', 'alice@shaavir.com');
      const res = await request(app)
        .get(`/api/surveys/${surveyId}/responses`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.responses).toHaveLength(1);
      const resp = res.body.responses[0];
      expect(resp.email).toBeUndefined();
      expect(resp.submitted_by).toBeUndefined();
    });

    it('rejects non-admin reading responses', async () => {
      await request(app)
        .post(`/api/surveys/${surveyId}/respond`)
        .send({ answers: { q1: 5 } })
        .set('X-User-Email', 'alice@shaavir.com');
      const res = await request(app)
        .get(`/api/surveys/${surveyId}/responses`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/surveys/pending', () => {
    it('returns pending surveys for user', async () => {
      const r = await request(app)
        .post('/api/surveys')
        .send({ title: 'Pending Test' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/surveys/${r.body.survey.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .get('/api/surveys/pending')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.surveys).toHaveLength(1);
    });

    it('excludes completed surveys', async () => {
      const r = await request(app)
        .post('/api/surveys')
        .send({ title: 'Done Test' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/surveys/${r.body.survey.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post(`/api/surveys/${r.body.survey.id}/respond`)
        .send({ answers: { q1: 5 } })
        .set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app)
        .get('/api/surveys/pending')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.surveys).toHaveLength(0);
    });
  });

  describe('HR targeting', () => {
    it('rejects peer audience on create', async () => {
      const res = await request(app)
        .post('/api/surveys')
        .send({
          title: 'Peer Review',
          audience: 'peer',
          questions: [{ key: 'score', label: 'Overall', type: 'rating' }],
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/peer surveys are not supported/i);
    });

    it('scopes pending surveys by target group ids', async () => {
      await seedMember(db, {
        email: 'eng@shaavir.com',
        name: 'Eng User',
        groupId: 'eng',
        groupName: 'Engineering',
      });
      await seedMember(db, {
        email: 'sales@shaavir.com',
        name: 'Sales User',
        groupId: 'sales',
        groupName: 'Sales',
      });

      const targeted = await request(app)
        .post('/api/surveys')
        .send({
          title: 'Eng only',
          targetGroupIds: ['eng'],
          questions: [{ key: 'q1', label: 'OK?', type: 'yesno' }],
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(targeted.status).toBe(201);
      expect(targeted.body.survey.target_group_ids).toBe('eng');
      expect(targeted.body.survey.audience).toBe('employee');
      const tid = targeted.body.survey.id as string;
      await request(app)
        .post(`/api/surveys/${tid}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const forAll = await request(app)
        .post('/api/surveys')
        .send({ title: 'Everyone', questions: [{ key: 'q1', label: 'OK?', type: 'yesno' }] })
        .set('X-User-Email', 'admin@shaavir.com');
      const aid = forAll.body.survey.id as string;
      await request(app)
        .post(`/api/surveys/${aid}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const engPending = await request(app)
        .get('/api/surveys/pending')
        .set('X-User-Email', 'eng@shaavir.com');
      const engTitles = engPending.body.surveys.map((s: { title: string }) => s.title);
      expect(engTitles).toContain('Eng only');
      expect(engTitles).toContain('Everyone');

      const salesPending = await request(app)
        .get('/api/surveys/pending')
        .set('X-User-Email', 'sales@shaavir.com');
      const salesTitles = salesPending.body.surveys.map((s: { title: string }) => s.title);
      expect(salesTitles).not.toContain('Eng only');
      expect(salesTitles).toContain('Everyone');
    });
  });

  describe('eNPS calculation', () => {
    it('calculates eNPS correctly', async () => {
      const r = await request(app)
        .post('/api/surveys')
        .send({ title: 'eNPS Survey' })
        .set('X-User-Email', 'admin@shaavir.com');
      const sid = r.body.survey.id;
      await request(app)
        .post(`/api/surveys/${sid}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      await request(app)
        .post(`/api/surveys/${sid}/respond`)
        .send({ answers: { nps: 9 } })
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app)
        .post(`/api/surveys/${sid}/respond`)
        .send({ answers: { nps: 5 } })
        .set('X-User-Email', 'bob@shaavir.com');

      const res = await request(app)
        .get(`/api/surveys/${sid}/enps`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.enps.promoters).toBe(1);
      expect(res.body.enps.detractors).toBe(1);
      expect(res.body.enps.enps).toBe(0);
      expect(res.body.enps.total).toBe(2);
    });
  });

  describe('Results summary', () => {
    it('returns averages per question', async () => {
      const r = await request(app)
        .post('/api/surveys')
        .send({ title: 'Results Test' })
        .set('X-User-Email', 'admin@shaavir.com');
      const sid = r.body.survey.id;
      await request(app)
        .post(`/api/surveys/${sid}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      await request(app)
        .post(`/api/surveys/${sid}/respond`)
        .send({ answers: { satisfaction: 4, workload: 3 } })
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app)
        .post(`/api/surveys/${sid}/respond`)
        .send({ answers: { satisfaction: 2, workload: 5 } })
        .set('X-User-Email', 'bob@shaavir.com');

      const res = await request(app)
        .get(`/api/surveys/${sid}/results`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.summary.responseCount).toBe(2);
      expect(res.body.summary.averages.satisfaction).toBe(3);
      expect(res.body.summary.averages.workload).toBe(4);
    });
  });

  describe('Action items', () => {
    it('creates and lists action items for a survey', async () => {
      const r = await request(app)
        .post('/api/surveys')
        .send({ title: 'Action Test' })
        .set('X-User-Email', 'admin@shaavir.com');

      const item = await request(app)
        .post(`/api/surveys/${r.body.survey.id}/action-items`)
        .send({ title: 'Improve onboarding', assignedTo: 'hr@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(item.status).toBe(201);

      const list = await request(app)
        .get(`/api/surveys/${r.body.survey.id}/action-items`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(list.body.actionItems).toHaveLength(1);
      expect(list.body.actionItems[0].title).toBe('Improve onboarding');
    });
  });
});
