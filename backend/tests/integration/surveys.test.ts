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
  });

  afterEach(async () => { await db.close(); });

  describe('POST /api/surveys', () => {
    it('creates a survey', async () => {
      const res = await request(app).post('/api/surveys')
        .send({ title: 'Quarterly Pulse', questionsJson: JSON.stringify([{ key: 'q1', text: 'How satisfied are you?', type: 'scale' }]) })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.survey.title).toBe('Quarterly Pulse');
      expect(res.body.survey.status).toBe('draft');
    });

    it('rejects missing title', async () => {
      const res = await request(app).post('/api/surveys')
        .send({}).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('Survey lifecycle', () => {
    let surveyId: string;
    beforeEach(async () => {
      const r = await request(app).post('/api/surveys')
        .send({ title: 'Test Survey' }).set('X-User-Email', 'admin@shaavir.com');
      surveyId = r.body.survey.id;
    });

    it('publishes a draft survey', async () => {
      const res = await request(app).post(`/api/surveys/${surveyId}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
      const fetched = await request(app).get(`/api/surveys/${surveyId}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.survey.status).toBe('active');
    });

    it('closes an active survey', async () => {
      await request(app).post(`/api/surveys/${surveyId}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app).post(`/api/surveys/${surveyId}/close`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('deletes a draft survey', async () => {
      const res = await request(app).delete(`/api/surveys/${surveyId}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
    });

    it('rejects deleting an active survey', async () => {
      await request(app).post(`/api/surveys/${surveyId}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app).delete(`/api/surveys/${surveyId}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('Anonymous responses', () => {
    let surveyId: string;
    beforeEach(async () => {
      const r = await request(app).post('/api/surveys')
        .send({ title: 'Anon Survey', anonymous: true }).set('X-User-Email', 'admin@shaavir.com');
      surveyId = r.body.survey.id;
      await request(app).post(`/api/surveys/${surveyId}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
    });

    it('accepts a response', async () => {
      const res = await request(app).post(`/api/surveys/${surveyId}/respond`)
        .send({ answers: { q1: 4, q2: 'Great culture' } })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(200);
      expect(res.body.response.survey_id).toBe(surveyId);
    });

    it('rejects duplicate response', async () => {
      await request(app).post(`/api/surveys/${surveyId}/respond`)
        .send({ answers: { q1: 5 } }).set('X-User-Email', 'alice@shaavir.com');
      const res = await request(app).post(`/api/surveys/${surveyId}/respond`)
        .send({ answers: { q1: 3 } }).set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Aa]lready/);
    });

    it('responses do not contain email', async () => {
      await request(app).post(`/api/surveys/${surveyId}/respond`)
        .send({ answers: { q1: 5 } }).set('X-User-Email', 'alice@shaavir.com');
      const res = await request(app).get(`/api/surveys/${surveyId}/responses`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.responses).toHaveLength(1);
      // Verify no email field in response data
      const resp = res.body.responses[0];
      expect(resp.email).toBeUndefined();
      expect(resp.submitted_by).toBeUndefined();
    });
  });

  describe('GET /api/surveys/pending', () => {
    it('returns pending surveys for user', async () => {
      const r = await request(app).post('/api/surveys')
        .send({ title: 'Pending Test' }).set('X-User-Email', 'admin@shaavir.com');
      await request(app).post(`/api/surveys/${r.body.survey.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).get('/api/surveys/pending')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.surveys).toHaveLength(1);
    });

    it('excludes completed surveys', async () => {
      const r = await request(app).post('/api/surveys')
        .send({ title: 'Done Test' }).set('X-User-Email', 'admin@shaavir.com');
      await request(app).post(`/api/surveys/${r.body.survey.id}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app).post(`/api/surveys/${r.body.survey.id}/respond`)
        .send({ answers: { q1: 5 } }).set('X-User-Email', 'alice@shaavir.com');

      const res = await request(app).get('/api/surveys/pending')
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.surveys).toHaveLength(0);
    });
  });

  describe('eNPS calculation', () => {
    it('calculates eNPS correctly', async () => {
      const r = await request(app).post('/api/surveys')
        .send({ title: 'eNPS Survey' }).set('X-User-Email', 'admin@shaavir.com');
      const sid = r.body.survey.id;
      await request(app).post(`/api/surveys/${sid}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      // Alice = promoter (9), Bob = detractor (5)
      await request(app).post(`/api/surveys/${sid}/respond`)
        .send({ answers: { nps: 9 } }).set('X-User-Email', 'alice@shaavir.com');
      await request(app).post(`/api/surveys/${sid}/respond`)
        .send({ answers: { nps: 5 } }).set('X-User-Email', 'bob@shaavir.com');

      const res = await request(app).get(`/api/surveys/${sid}/enps`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.enps.promoters).toBe(1);
      expect(res.body.enps.detractors).toBe(1);
      expect(res.body.enps.enps).toBe(0); // (1-1)/2 * 100 = 0
      expect(res.body.enps.total).toBe(2);
    });
  });

  describe('Results summary', () => {
    it('returns averages per question', async () => {
      const r = await request(app).post('/api/surveys')
        .send({ title: 'Results Test' }).set('X-User-Email', 'admin@shaavir.com');
      const sid = r.body.survey.id;
      await request(app).post(`/api/surveys/${sid}/publish`)
        .set('X-User-Email', 'admin@shaavir.com');

      await request(app).post(`/api/surveys/${sid}/respond`)
        .send({ answers: { satisfaction: 4, workload: 3 } }).set('X-User-Email', 'alice@shaavir.com');
      await request(app).post(`/api/surveys/${sid}/respond`)
        .send({ answers: { satisfaction: 2, workload: 5 } }).set('X-User-Email', 'bob@shaavir.com');

      const res = await request(app).get(`/api/surveys/${sid}/results`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.summary.responseCount).toBe(2);
      expect(res.body.summary.averages.satisfaction).toBe(3);
      expect(res.body.summary.averages.workload).toBe(4);
    });
  });

  describe('Action items', () => {
    it('creates and lists action items for a survey', async () => {
      const r = await request(app).post('/api/surveys')
        .send({ title: 'Action Test' }).set('X-User-Email', 'admin@shaavir.com');

      const item = await request(app).post(`/api/surveys/${r.body.survey.id}/action-items`)
        .send({ title: 'Improve onboarding', assignedTo: 'hr@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(item.status).toBe(201);

      const list = await request(app).get(`/api/surveys/${r.body.survey.id}/action-items`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(list.body.actionItems).toHaveLength(1);
      expect(list.body.actionItems[0].title).toBe('Improve onboarding');
    });
  });
});
