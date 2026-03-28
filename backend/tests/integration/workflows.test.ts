import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp } from '../helpers/setup';

describe('Workflow Builder Module', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
  });

  afterEach(async () => { await db.close(); });

  // ── Definitions ──

  describe('POST /api/workflows', () => {
    it('creates a manual workflow', async () => {
      const res = await request(app)
        .post('/api/workflows')
        .send({
          name: 'Leave Approval',
          triggerType: 'manual',
          steps: [
            { type: 'approval', config: { role: 'manager' }, deadline_hours: 24 },
            { type: 'approval', config: { role: 'hr' }, deadline_hours: 48 },
            { type: 'notification', config: { channel: 'email' } },
          ],
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.workflow.name).toBe('Leave Approval');
      expect(res.body.workflow.trigger_type).toBe('manual');
    });

    it('creates an event-triggered workflow', async () => {
      const res = await request(app)
        .post('/api/workflows')
        .send({ name: 'Onboarding', triggerType: 'event', triggerConfig: { eventName: 'member.created' }, steps: [] })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.workflow.trigger_type).toBe('event');
    });

    it('rejects missing name', async () => {
      const res = await request(app)
        .post('/api/workflows')
        .send({ triggerType: 'manual' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects invalid trigger type', async () => {
      const res = await request(app)
        .post('/api/workflows')
        .send({ name: 'Test', triggerType: 'webhook' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/workflows', () => {
    it('lists workflows', async () => {
      await request(app).post('/api/workflows')
        .send({ name: 'WF1' }).set('X-User-Email', 'admin@shaavir.com');
      await request(app).post('/api/workflows')
        .send({ name: 'WF2' }).set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app).get('/api/workflows')
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.workflows).toHaveLength(2);
    });
  });

  describe('PUT /api/workflows/:id', () => {
    it('updates a workflow', async () => {
      const created = await request(app).post('/api/workflows')
        .send({ name: 'Old' }).set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .put(`/api/workflows/${created.body.workflow.id}`)
        .send({ name: 'Updated' })
        .set('X-User-Email', 'admin@shaavir.com');

      const fetched = await request(app)
        .get(`/api/workflows/${created.body.workflow.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.workflow.name).toBe('Updated');
    });
  });

  describe('DELETE /api/workflows/:id', () => {
    it('deletes a workflow', async () => {
      const created = await request(app).post('/api/workflows')
        .send({ name: 'Temp' }).set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app)
        .delete(`/api/workflows/${created.body.workflow.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
    });
  });

  // ── Execution ──

  describe('POST /api/workflows/:id/trigger', () => {
    it('triggers a workflow and creates an instance', async () => {
      const wf = await request(app).post('/api/workflows')
        .send({
          name: 'Simple Flow',
          steps: [{ type: 'notification', config: { message: 'Hello' } }],
        })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/workflows/${wf.body.workflow.id}/trigger`)
        .send({ triggerData: { reason: 'test' } })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(201);
      expect(res.body.instance.workflow_id).toBe(wf.body.workflow.id);
      expect(res.body.instance.status).toBe('running');
    });

    it('rejects triggering an inactive workflow', async () => {
      const wf = await request(app).post('/api/workflows')
        .send({ name: 'Inactive' }).set('X-User-Email', 'admin@shaavir.com');
      await request(app).put(`/api/workflows/${wf.body.workflow.id}`)
        .send({ active: 0 }).set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/workflows/${wf.body.workflow.id}/trigger`)
        .send({}).set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/not active/);
    });
  });

  describe('POST /api/workflow-instances/:id/advance', () => {
    it('advances through steps and completes', async () => {
      const wf = await request(app).post('/api/workflows')
        .send({
          name: 'Two Step',
          steps: [
            { type: 'approval', config: {} },
            { type: 'notification', config: {} },
          ],
        })
        .set('X-User-Email', 'admin@shaavir.com');

      const inst = await request(app)
        .post(`/api/workflows/${wf.body.workflow.id}/trigger`)
        .send({}).set('X-User-Email', 'admin@shaavir.com');

      // First advance was done in trigger, advance again
      await request(app)
        .post(`/api/workflow-instances/${inst.body.instance.id}/advance`)
        .set('X-User-Email', 'admin@shaavir.com');

      const fetched = await request(app)
        .get(`/api/workflow-instances/${inst.body.instance.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.instance.status).toBe('completed');
    });
  });

  describe('POST /api/workflow-instances/:id/cancel', () => {
    it('cancels a running instance', async () => {
      const wf = await request(app).post('/api/workflows')
        .send({ name: 'Long Flow', steps: [{ type: 'approval', config: {} }, { type: 'approval', config: {} }, { type: 'approval', config: {} }] })
        .set('X-User-Email', 'admin@shaavir.com');
      const inst = await request(app)
        .post(`/api/workflows/${wf.body.workflow.id}/trigger`)
        .send({}).set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post(`/api/workflow-instances/${inst.body.instance.id}/cancel`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);

      const fetched = await request(app)
        .get(`/api/workflow-instances/${inst.body.instance.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(fetched.body.instance.status).toBe('cancelled');
    });
  });

  // ── Forms ──

  describe('Workflow forms', () => {
    it('creates a form and accepts a submission', async () => {
      const form = await request(app).post('/api/workflow-forms')
        .send({ name: 'Expense Claim Form', fieldsJson: JSON.stringify([{ name: 'amount', type: 'number' }, { name: 'description', type: 'text' }]) })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(form.status).toBe(201);
      expect(form.body.form.name).toBe('Expense Claim Form');

      const sub = await request(app)
        .post(`/api/workflow-forms/${form.body.form.id}/submit`)
        .send({ data: { amount: 500, description: 'Client dinner' } })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(sub.status).toBe(201);

      const subs = await request(app)
        .get(`/api/workflow-forms/${form.body.form.id}/submissions`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(subs.body.submissions).toHaveLength(1);
    });

    it('deletes a form', async () => {
      const form = await request(app).post('/api/workflow-forms')
        .send({ name: 'Temp Form', fieldsJson: '[]' })
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app)
        .delete(`/api/workflow-forms/${form.body.form.id}`)
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(200);
    });
  });
});
