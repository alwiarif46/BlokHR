import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { DatabaseEngine } from '../../src/db/engine';
import { createTestApp, seedMember } from '../helpers/setup';

describe('Time Tracking — Billable/Non-Billable + Project Logging', () => {
  let app: Express;
  let db: DatabaseEngine;

  beforeEach(async () => {
    const setup = await createTestApp();
    app = setup.app;
    db = setup.db;
    await seedMember(db, {
      email: 'alice@shaavir.com',
      name: 'Alice',
      groupId: 'engineering',
      groupName: 'Engineering',
    });
  });

  afterEach(async () => {
    await db.close();
  });

  // ── Clients ──

  describe('Clients', () => {
    it('lists seeded internal client', async () => {
      const res = await request(app).get('/api/clients');
      expect(res.body.clients.length).toBeGreaterThanOrEqual(1);
      expect(res.body.clients.find((c: { id: string }) => c.id === 'internal')).toBeDefined();
    });

    it('creates a new client', async () => {
      const res = await request(app)
        .post('/api/clients')
        .send({ id: 'acme', name: 'Acme Corp', code: 'ACM', billingRate: 150, currency: 'USD' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.client.billingRate).toBe(150);
    });

    it('rejects duplicate client ID', async () => {
      await request(app)
        .post('/api/clients')
        .send({ id: 'dup', name: 'First' })
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app)
        .post('/api/clients')
        .send({ id: 'dup', name: 'Second' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('updates a client', async () => {
      await request(app)
        .post('/api/clients')
        .send({ id: 'upd', name: 'Before' })
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app)
        .put('/api/clients/upd')
        .send({ name: 'After', billingRate: 200 })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });
  });

  // ── Projects ──

  describe('Projects', () => {
    it('lists seeded internal projects', async () => {
      const res = await request(app).get('/api/projects');
      expect(res.body.projects.length).toBeGreaterThanOrEqual(3);
      const adm = res.body.projects.find((p: { id: string }) => p.id === 'admin-overhead');
      expect(adm).toBeDefined();
      expect(adm.billable).toBe(false);
    });

    it('creates a billable project', async () => {
      await request(app)
        .post('/api/clients')
        .send({ id: 'acme2', name: 'Acme' })
        .set('X-User-Email', 'admin@shaavir.com');
      const res = await request(app)
        .post('/api/projects')
        .send({
          id: 'acme-web',
          clientId: 'acme2',
          name: 'Acme Website Redesign',
          code: 'AWR',
          billable: true,
          billingRate: 175,
          budgetHours: 500,
        })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.project.billable).toBe(true);
      expect(res.body.project.billingRate).toBe(175);
    });

    it('creates a non-billable project', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ id: 'rnd', clientId: 'internal', name: 'R&D Spike', billable: false })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.project.billable).toBe(false);
    });

    it('rejects project with nonexistent client', async () => {
      const res = await request(app)
        .post('/api/projects')
        .send({ id: 'ghost', clientId: 'no-such-client', name: 'Orphan' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/[Cc]lient not found/);
    });

    it('filters projects by clientId', async () => {
      const res = await request(app).get('/api/projects?clientId=internal');
      expect(res.body.projects.every((p: { clientId: string }) => p.clientId === 'internal')).toBe(
        true,
      );
    });
  });

  // ── Time entries ──

  describe('Time entries', () => {
    it('logs billable time against a project', async () => {
      await request(app)
        .post('/api/clients')
        .send({ id: 'cl1', name: 'Client1', billingRate: 100 })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/projects')
        .send({ id: 'p1', clientId: 'cl1', name: 'Proj1', billable: true })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'p1',
          date: '2026-03-20',
          hours: 4,
          description: 'Frontend work',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
      expect(res.body.entry.hours).toBe(4);
      expect(res.body.entry.billable).toBe(true);
      expect(res.body.entry.billingRate).toBe(100); // Inherited from client
    });

    it('logs non-billable time against internal project', async () => {
      const res = await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 2,
          description: 'Team standup',
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.entry.billable).toBe(false);
    });

    it('project billing rate overrides client rate', async () => {
      await request(app)
        .post('/api/clients')
        .send({ id: 'cl2', name: 'Client2', billingRate: 100 })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/projects')
        .send({ id: 'p2', clientId: 'cl2', name: 'Premium', billable: true, billingRate: 250 })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post('/api/time-entries')
        .send({ email: 'alice@shaavir.com', projectId: 'p2', date: '2026-03-20', hours: 3 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.entry.billingRate).toBe(250); // Project rate, not client's 100
    });

    it('entry-level billing rate overrides project rate', async () => {
      await request(app)
        .post('/api/clients')
        .send({ id: 'cl3', name: 'Client3' })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/projects')
        .send({ id: 'p3', clientId: 'cl3', name: 'Custom', billable: true, billingRate: 150 })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'p3',
          date: '2026-03-20',
          hours: 2,
          billingRate: 300,
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.entry.billingRate).toBe(300);
    });

    it('rejects zero hours', async () => {
      const res = await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 0,
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects hours > 24', async () => {
      const res = await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 25,
        })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('rejects nonexistent project', async () => {
      const res = await request(app)
        .post('/api/time-entries')
        .send({ email: 'alice@shaavir.com', projectId: 'no-such', date: '2026-03-20', hours: 1 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('updates an unapproved entry', async () => {
      await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 2,
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const list = await request(app).get('/api/time-entries?email=alice@shaavir.com');
      const id = list.body.entries[0].id;

      const res = await request(app)
        .put(`/api/time-entries/${id}`)
        .send({ hours: 3, description: 'Updated' })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('deletes an unapproved entry', async () => {
      await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 1,
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const list = await request(app).get('/api/time-entries?email=alice@shaavir.com');
      const id = list.body.entries[0].id;

      const res = await request(app)
        .delete(`/api/time-entries/${id}`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('approves an entry', async () => {
      await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 2,
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const list = await request(app).get('/api/time-entries?email=alice@shaavir.com');
      const id = list.body.entries[0].id;

      const res = await request(app)
        .post(`/api/time-entries/${id}/approve`)
        .send({ approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');
      expect(res.body.success).toBe(true);
    });

    it('blocks edit of approved entry', async () => {
      await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 2,
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const list = await request(app).get('/api/time-entries?email=alice@shaavir.com');
      const id = list.body.entries[0].id;
      await request(app)
        .post(`/api/time-entries/${id}/approve`)
        .send({ approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .put(`/api/time-entries/${id}`)
        .send({ hours: 5 })
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/approved/);
    });

    it('blocks delete of approved entry', async () => {
      await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 2,
        })
        .set('X-User-Email', 'alice@shaavir.com');

      const list = await request(app).get('/api/time-entries?email=alice@shaavir.com');
      const id = list.body.entries[0].id;
      await request(app)
        .post(`/api/time-entries/${id}/approve`)
        .send({ approverEmail: 'admin@shaavir.com' })
        .set('X-User-Email', 'admin@shaavir.com');

      const res = await request(app)
        .delete(`/api/time-entries/${id}`)
        .set('X-User-Email', 'alice@shaavir.com');
      expect(res.status).toBe(400);
    });

    it('filters entries by date range and billable flag', async () => {
      await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 2,
        })
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app)
        .post('/api/clients')
        .send({ id: 'f1', name: 'FilterClient', billingRate: 50 })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/projects')
        .send({ id: 'fp1', clientId: 'f1', name: 'FilterProj', billable: true })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/time-entries')
        .send({ email: 'alice@shaavir.com', projectId: 'fp1', date: '2026-03-20', hours: 3 })
        .set('X-User-Email', 'alice@shaavir.com');

      const billable = await request(app).get(
        '/api/time-entries?email=alice@shaavir.com&billable=true',
      );
      expect(billable.body.entries.every((e: { billable: boolean }) => e.billable === true)).toBe(
        true,
      );

      const nonBillable = await request(app).get(
        '/api/time-entries?email=alice@shaavir.com&billable=false',
      );
      expect(
        nonBillable.body.entries.every((e: { billable: boolean }) => e.billable === false),
      ).toBe(true);
    });
  });

  // ── Summary / Utilization ──

  describe('Time summary', () => {
    beforeEach(async () => {
      await request(app)
        .post('/api/clients')
        .send({ id: 'sum-cl', name: 'SumClient', billingRate: 100 })
        .set('X-User-Email', 'admin@shaavir.com');
      await request(app)
        .post('/api/projects')
        .send({ id: 'sum-bp', clientId: 'sum-cl', name: 'Billable Proj', billable: true })
        .set('X-User-Email', 'admin@shaavir.com');

      // 6h billable at $100/h + 2h non-billable
      await request(app)
        .post('/api/time-entries')
        .send({ email: 'alice@shaavir.com', projectId: 'sum-bp', date: '2026-03-20', hours: 6 })
        .set('X-User-Email', 'alice@shaavir.com');
      await request(app)
        .post('/api/time-entries')
        .send({
          email: 'alice@shaavir.com',
          projectId: 'admin-overhead',
          date: '2026-03-20',
          hours: 2,
        })
        .set('X-User-Email', 'alice@shaavir.com');
    });

    it('returns correct totals and utilization', async () => {
      const res = await request(app).get('/api/time-summary?email=alice@shaavir.com');
      expect(res.body.totalHours).toBe(8);
      expect(res.body.billableHours).toBe(6);
      expect(res.body.nonBillableHours).toBe(2);
      expect(res.body.billableAmount).toBe(600); // 6h × $100
      expect(res.body.utilizationPercent).toBe(75); // 6/8 = 75%
    });

    it('filters summary by date range', async () => {
      const res = await request(app).get(
        '/api/time-summary?email=alice@shaavir.com&startDate=2026-03-21&endDate=2026-03-31',
      );
      expect(res.body.totalHours).toBe(0);
    });

    it('filters summary by project', async () => {
      const res = await request(app).get('/api/time-summary?projectId=sum-bp');
      expect(res.body.billableHours).toBe(6);
      expect(res.body.nonBillableHours).toBe(0);
    });
  });
});
